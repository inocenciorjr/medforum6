import { firestore } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import {
  FirebaseProgrammedReview,
  FirebaseProgrammedReviewContentType,
  FirebaseProgrammedReviewStatus,
  ReviewQuality,
  FirebaseQuestion, // Adicionado para buscar questões por subFilterIds
  FirebaseUserStatistics // Adicionado para buscar weakestFilters
} from "../types/firebaseTypes";
import { getOrCreateUserStatistics } from "./firebaseUserStatisticsService"; // Adicionado

// Constantes para o algoritmo SRS (SM-2 ajustado)
const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const INITIAL_INTERVAL_DAYS_FAIL = 1; // Intervalo após uma falha
const FIRST_PASS_INTERVAL_DAYS = 1;   // Intervalo após o primeiro acerto (qualidade >= 3)
const SECOND_PASS_INTERVAL_DAYS = 6;  // Intervalo após o segundo acerto consecutivo
const MASTERED_THRESHOLD_INTERVAL_DAYS = 16; // Exemplo de intervalo para considerar "mastered"
const MASTERED_THRESHOLD_REPETITIONS = 3; // Exemplo de repetições para considerar "mastered"

const PROGRAMMED_REVIEWS_COLLECTION = "programmedReviews";
const QUESTIONS_COLLECTION = "questions"; // Adicionado

export const createProgrammedReview = async (reviewData: Omit<FirebaseProgrammedReview, "id" | "createdAt" | "updatedAt" | "lastReviewedAt">): Promise<FirebaseProgrammedReview> => {
  if (!reviewData.userId) throw new Error("O ID do usuário é obrigatório.");
  if (!reviewData.contentId) throw new Error("O ID do conteúdo é obrigatório.");
  if (!reviewData.contentType) throw new Error("O tipo de conteúdo é obrigatório.");
  if (!reviewData.nextReviewAt) throw new Error("A data da próxima revisão é obrigatória.");

  const newReviewRef = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION).doc();
  const now = Timestamp.now();

  const newProgrammedReview: FirebaseProgrammedReview = {
    id: newReviewRef.id,
    userId: reviewData.userId,
    contentId: reviewData.contentId,
    contentType: reviewData.contentType,
    deckId: reviewData.deckId || null,
    originalAnswerCorrect: reviewData.originalAnswerCorrect === undefined ? null : reviewData.originalAnswerCorrect,
    lastReviewedAt: null, 
    nextReviewAt: reviewData.nextReviewAt,
    intervalDays: reviewData.intervalDays !== undefined ? reviewData.intervalDays : FIRST_PASS_INTERVAL_DAYS,
    easeFactor: reviewData.easeFactor !== undefined ? reviewData.easeFactor : DEFAULT_EASE_FACTOR,
    repetitions: reviewData.repetitions !== undefined ? reviewData.repetitions : 0,
    lapses: reviewData.lapses !== undefined ? reviewData.lapses : 0,
    status: reviewData.status || FirebaseProgrammedReviewStatus.LEARNING,
    notes: reviewData.notes || null,
    createdAt: now,
    updatedAt: now,
  };

  await newReviewRef.set(newProgrammedReview);
  return newProgrammedReview;
};

export const getProgrammedReviewById = async (id: string): Promise<FirebaseProgrammedReview | null> => {
  const docRef = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION).doc(id);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseProgrammedReview;
  }
  return null;
};

export const getProgrammedReviewByContentId = async (contentId: string, contentType: FirebaseProgrammedReviewContentType, userId: string): Promise<FirebaseProgrammedReview | null> => {
  const querySnapshot = await firestore.collection(PROGRAMMED_REVIEWS_COLLECTION)
    .where("contentId", "==", contentId)
    .where("contentType", "==", contentType)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data() as FirebaseProgrammedReview;
  }
  return null;
};

export const updateProgrammedReview = async (
  id: string,
  quality: ReviewQuality,
  notes?: string | null
): Promise<FirebaseProgrammedReview | null> => {
  if (quality < 0 || quality > 5) {
    throw new Error("A qualidade da revisão deve estar entre 0 e 5.");
  }

  const reviewRef = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION).doc(id);
  const reviewDoc = await reviewRef.get();

  if (!reviewDoc.exists) {
    console.warn(`Item de revisão programada com ID "${id}" não encontrado para atualização.`);
    return null;
  }

  const currentData = reviewDoc.data() as FirebaseProgrammedReview;

  let {
    easeFactor: currentEF,
    intervalDays: currentInterval,
    repetitions: currentRepetitions,
    lapses: currentLapses,
    status: currentStatus
  } = currentData;

  currentEF = currentEF !== undefined ? currentEF : DEFAULT_EASE_FACTOR;
  currentInterval = currentInterval !== undefined ? currentInterval : 0;
  currentRepetitions = currentRepetitions !== undefined ? currentRepetitions : 0;
  currentLapses = currentLapses !== undefined ? currentLapses : 0;
  currentStatus = currentStatus !== undefined ? currentStatus : FirebaseProgrammedReviewStatus.LEARNING;

  const now = Timestamp.now();
  let nextIntervalDays: number;
  let newEaseFactor = currentEF;
  let newRepetitions = currentRepetitions;
  let newLapses = currentLapses;
  let newStatus = currentStatus;

  if (quality < 3) { // Falha
    newRepetitions = 0;
    newLapses += 1;
    nextIntervalDays = INITIAL_INTERVAL_DAYS_FAIL;
    newStatus = FirebaseProgrammedReviewStatus.LEARNING;
    newEaseFactor = Math.max(MIN_EASE_FACTOR, currentEF - 0.20);
  } else { // Acerto (quality >= 3)
    newEaseFactor = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEaseFactor < MIN_EASE_FACTOR) {
      newEaseFactor = MIN_EASE_FACTOR;
    }

    if (currentRepetitions === 0) {
      newRepetitions = 1;
      nextIntervalDays = FIRST_PASS_INTERVAL_DAYS;
    } else if (currentRepetitions === 1) {
      newRepetitions = 2;
      nextIntervalDays = SECOND_PASS_INTERVAL_DAYS;
    } else {
      newRepetitions = currentRepetitions + 1;
      nextIntervalDays = Math.round(currentInterval * newEaseFactor);
    }
    newStatus = FirebaseProgrammedReviewStatus.REVIEWING;

    if (newStatus === FirebaseProgrammedReviewStatus.REVIEWING &&
        nextIntervalDays >= MASTERED_THRESHOLD_INTERVAL_DAYS &&
        newRepetitions >= MASTERED_THRESHOLD_REPETITIONS) {
      newStatus = FirebaseProgrammedReviewStatus.MASTERED;
    }
  }

  if (nextIntervalDays < 1) {
    nextIntervalDays = 1;
  }

  const finalIntervalDays = nextIntervalDays;
  const nextReviewAt = Timestamp.fromMillis(now.toMillis() + finalIntervalDays * 24 * 60 * 60 * 1000);

  const dataToUpdate: Partial<FirebaseProgrammedReview> & { updatedAt: Timestamp; lastReviewedAt: Timestamp } = {
    lastReviewedAt: now,
    nextReviewAt: nextReviewAt,
    intervalDays: finalIntervalDays,
    easeFactor: parseFloat(newEaseFactor.toFixed(4)),
    repetitions: newRepetitions,
    lapses: newLapses,
    status: newStatus,
    updatedAt: Timestamp.now(),
  };

  if (notes !== undefined) {
    dataToUpdate.notes = notes;
  }

  await reviewRef.update(dataToUpdate);
  const updatedDoc = await reviewRef.get();
  return updatedDoc.data() as FirebaseProgrammedReview;
};

export const deleteProgrammedReview = async (id: string): Promise<boolean> => {
  const reviewRef = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION).doc(id);
  const reviewDoc = await reviewRef.get();

  if (!reviewDoc.exists) {
    console.warn(`Item de revisão programada com ID "${id}" não encontrado para deleção.`);
    return false;
  }
  await reviewRef.delete();
  return true;
};

export const deleteProgrammedReviewByContentId = async (contentId: string, contentType: FirebaseProgrammedReviewContentType, userId: string): Promise<boolean> => {
  const reviewItem = await getProgrammedReviewByContentId(contentId, contentType, userId);
  if (reviewItem && reviewItem.id) {
    return deleteProgrammedReview(reviewItem.id);
  }
  console.warn(`Nenhum ProgrammedReview encontrado para contentId: ${contentId}, contentType: ${contentType}, userId: ${userId} para deleção.`);
  return false;
};

export const listProgrammedReviewsByUser = async (userId: string, options?: {
  limit?: number;
  startAfter?: FirebaseFirestore.DocumentSnapshot;
  sortBy?: "nextReviewAt" | "createdAt" | "updatedAt";
  sortDirection?: "asc" | "desc";
  status?: FirebaseProgrammedReviewStatus | FirebaseProgrammedReviewStatus[];
  contentType?: FirebaseProgrammedReviewContentType | FirebaseProgrammedReviewContentType[];
  deckId?: string;
}): Promise<{ reviews: FirebaseProgrammedReview[]; nextPageStartAfter?: FirebaseFirestore.DocumentSnapshot }> => {
  if (!userId) throw new Error("ID do Usuário é obrigatório.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION)
                                                                      .where("userId", "==", userId);
  if (options?.status) {
    if (Array.isArray(options.status)) {
      if (options.status.length > 0 && options.status.length <= 10) {
        query = query.where("status", "in", options.status);
      }
    } else {
      query = query.where("status", "==", options.status);
    }
  }
  if (options?.contentType) {
     if (Array.isArray(options.contentType)) {
      if (options.contentType.length > 0 && options.contentType.length <= 10) {
        query = query.where("contentType", "in", options.contentType);
      }
    } else {
      query = query.where("contentType", "==", options.contentType);
    }
  }
  if (options?.deckId) {
    query = query.where("deckId", "==", options.deckId);
  }

  const sortBy = options?.sortBy || "nextReviewAt";
  const sortDirection = options?.sortDirection || "asc";
  query = query.orderBy(sortBy, sortDirection);
  
  if (options?.startAfter) {
      query = query.startAfter(options.startAfter);
  }

  const limit = options?.limit || 20;
  query = query.limit(limit);

  const snapshot = await query.get();
  const reviews = snapshot.docs.map(doc => doc.data() as FirebaseProgrammedReview);
  
  const nextPageStartAfter = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1] : undefined;

  return { reviews, nextPageStartAfter };
};

export const listDueReviewsByUser = async (userId: string, options?: {
  limit?: number;
  contentType?: FirebaseProgrammedReviewContentType | FirebaseProgrammedReviewContentType[];
  deckId?: string;
  startAfter?: FirebaseFirestore.DocumentSnapshot;
  // Opção para controlar a priorização, caso seja necessário desabilitá-la para algum caso de uso.
  prioritizeByWeakestFilters?: boolean; 
}): Promise<{ reviews: FirebaseProgrammedReview[]; nextPageStartAfter?: FirebaseFirestore.DocumentSnapshot }> => {
  if (!userId) throw new Error("ID do Usuário é obrigatório.");

  const prioritize = options?.prioritizeByWeakestFilters !== false; // Prioriza por padrão
  let weakestFilterQuestionIds: string[] = [];

  if (prioritize) {
    try {
      const userStats = await getOrCreateUserStatistics(userId);
      if (userStats && userStats.weakestFilters && userStats.weakestFilters.length > 0) {
        const questionSnapshots = await firestore.collection(QUESTIONS_COLLECTION)
          .where("subFilterIds", "array-contains-any", userStats.weakestFilters)
          .get();
        if (!questionSnapshots.empty) {
          weakestFilterQuestionIds = questionSnapshots.docs.map(doc => doc.id);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar weakestFilters ou questões associadas para priorização:", error);
      // Continua sem priorização em caso de erro
    }
  }

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = firestore.collection(PROGRAMMED_REVIEWS_COLLECTION)
    .where("userId", "==", userId)
    .where("nextReviewAt", "<=", Timestamp.now())
    .where("status", "in", [FirebaseProgrammedReviewStatus.LEARNING, FirebaseProgrammedReviewStatus.REVIEWING]);

  if (options?.contentType) {
    if (Array.isArray(options.contentType)) {
      if (options.contentType.length > 0 && options.contentType.length <= 10) {
         query = query.where("contentType", "in", options.contentType);
      }
    } else {
      query = query.where("contentType", "==", options.contentType);
    }
  }
  if (options?.deckId) {
    query = query.where("deckId", "==", options.deckId);
  }

  // Ordenação base: mais antigos primeiro. A priorização será feita no código se aplicável.
  query = query.orderBy("nextReviewAt", "asc"); 

  if (options?.startAfter && !prioritize) { // Paginação direta só se não houver priorização complexa
    query = query.startAfter(options.startAfter);
  }

  // Para priorização, buscamos um pouco mais para ter margem para reordenar, depois cortamos.
  // Se não houver priorização, usamos o limite direto.
  const effectiveLimit = options?.limit || 50;
  const queryLimit = prioritize && weakestFilterQuestionIds.length > 0 ? effectiveLimit * 2 : effectiveLimit; 
  query = query.limit(queryLimit);

  const snapshot = await query.get();
  let reviews = snapshot.docs.map(doc => doc.data() as FirebaseProgrammedReview);
  let nextPageStartAfter = snapshot.docs.length === queryLimit ? snapshot.docs[snapshot.docs.length - 1] : undefined;

  if (prioritize && weakestFilterQuestionIds.length > 0 && reviews.length > 0) {
    const prioritizedReviews: FirebaseProgrammedReview[] = [];
    const otherReviews: FirebaseProgrammedReview[] = [];

    reviews.forEach(review => {
      if (review.contentType === FirebaseProgrammedReviewContentType.QUESTION && weakestFilterQuestionIds.includes(review.contentId)) {
        prioritizedReviews.push(review);
      } else {
        otherReviews.push(review);
      }
    });
    
    // A ordenação interna de prioritizedReviews e otherReviews já é por nextReviewAt ASC
    reviews = [...prioritizedReviews, ...otherReviews];
    
    // Aplica o limite final após a reordenação
    if (reviews.length > effectiveLimit) {
        // Se cortamos, o startAfter para a próxima página deve ser o último item da lista *antes* do corte
        // Esta lógica de paginação com reordenação no servidor pode ser complexa.
        // Uma abordagem mais simples para paginação com priorização seria carregar todos os devidos
        // e paginar no cliente, ou usar cursores baseados no último item *após* a reordenação.
        // Por ora, se a lista reordenada exceder o limite, o nextPageStartAfter pode não ser o ideal
        // para uma consulta subsequente que também tenta priorizar. 
        // Para simplificar, se cortamos, o startAfter será o último da lista cortada.
        nextPageStartAfter = reviews[effectiveLimit -1] ? snapshot.docs.find(doc => doc.id === reviews[effectiveLimit-1].id) : undefined;
        reviews = reviews.slice(0, effectiveLimit);
    } else {
        // Se não cortamos, o nextPageStartAfter original (se houver) é válido se não houve priorização, 
        // ou indefinido se houve priorização e todos os itens couberam.
        if(prioritizedReviews.length === 0) {
            // não houve priorização de fato, o nextpagestartafter original é válido
        } else {
            // houve priorização, e todos couberam. Se snapshot.docs.length < queryLimit, não há próxima página.
            if (snapshot.docs.length < queryLimit) nextPageStartAfter = undefined;
            // se snapshot.docs.length == queryLimit, mas todos couberam após priorização e corte, então o último da lista cortada é o cursor.
            else if (reviews.length === effectiveLimit) nextPageStartAfter = snapshot.docs.find(doc => doc.id === reviews[effectiveLimit-1].id);
        }
    }
  }
  // Se não houve priorização (prioritize = false ou weakestFilterQuestionIds vazio), e cortamos, o startAfter é o último da lista original.
  else if (!prioritize || weakestFilterQuestionIds.length === 0) {
      if (reviews.length > effectiveLimit) {
          nextPageStartAfter = reviews[effectiveLimit-1] ? snapshot.docs.find(doc => doc.id === reviews[effectiveLimit-1].id) : undefined;
          reviews = reviews.slice(0, effectiveLimit);
      } else if (snapshot.docs.length < queryLimit) {
          nextPageStartAfter = undefined;
      }
  }

  return { reviews, nextPageStartAfter };
};

