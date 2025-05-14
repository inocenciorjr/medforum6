import { firestore } from "../config/firebaseAdmin";
import { Timestamp, DocumentReference, Query } from "firebase-admin/firestore";
import { 
  FirebaseUserQuestionResponse, 
  FirebaseProgrammedReviewContentType, 
  FirebaseProgrammedReviewStatus,
  ReviewQuality
} from "../types/firebaseTypes";
import { AppError } from "../utils/errors";
import { createProgrammedReview, updateProgrammedReview, deleteProgrammedReviewByContentId } from "./firebaseProgrammedReviewService";

const USER_QUESTION_RESPONSES_COLLECTION = "userQuestionResponses";

/**
 * Cria uma nova resposta de usuário para uma questão
 * @param payload Dados da resposta
 * @returns ID da resposta criada
 */
export const createUserQuestionResponse = async (
  payload: Omit<FirebaseUserQuestionResponse, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  const docRef = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION).doc();
  const now = Timestamp.now();
  
  const newResponse: FirebaseUserQuestionResponse = {
    id: docRef.id,
    ...payload,
    createdAt: now,
    updatedAt: now
  };
  
  await docRef.set(newResponse);
  
  // Se a resposta estiver associada a um sistema de revisão programada
  if (payload.nextReviewDate) {
    try {
      // Garantir que nextReviewDate não seja null
      const nextReviewAt = payload.nextReviewDate || Timestamp.now();
      
      const programmedReviewData = {
        userId: newResponse.userId,
        contentId: newResponse.id,
        contentType: FirebaseProgrammedReviewContentType.QUESTION,
        originalAnswerCorrect: newResponse.isCorrect,
        nextReviewAt: nextReviewAt,
        intervalDays: payload.reviewCount ? payload.reviewCount : 1,
        easeFactor: 2.5, // Valor padrão
        repetitions: payload.reviewCount || 0,
        lapses: 0,
        status: FirebaseProgrammedReviewStatus.LEARNING,
      };
      
      const createdProgrammedReview = await createProgrammedReview(programmedReviewData);
      await docRef.update({ 
        programmedReviewId: createdProgrammedReview.id, 
        updatedAt: Timestamp.now() 
      });
    } catch (error) {
      console.error("Erro ao criar revisão programada associada:", error);
    }
  }
  
  return docRef.id;
};

/**
 * Obtém uma resposta de usuário pelo ID
 * @param id ID da resposta
 * @returns Resposta ou null se não encontrada
 */
export const getUserQuestionResponseById = async (
  id: string
): Promise<FirebaseUserQuestionResponse | null> => {
  const docRef = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    return null;
  }
  
  return docSnap.data() as FirebaseUserQuestionResponse;
};

/**
 * Atualiza uma resposta de usuário
 * @param id ID da resposta
 * @param updateData Dados a serem atualizados
 * @returns true se atualizado com sucesso, false se não encontrado
 */
export const updateUserQuestionResponse = async (
  id: string,
  updateData: Partial<Omit<FirebaseUserQuestionResponse, "id" | "createdAt">>
): Promise<boolean> => {
  const docRef = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.warn(`Resposta de questão com ID "${id}" não encontrada para atualização.`);
    return false;
  }
  
  const dataToUpdate = {
    ...updateData,
    updatedAt: Timestamp.now()
  };
  
  await docRef.update(dataToUpdate);
  return true;
};

/**
 * Exclui uma resposta de usuário
 * @param id ID da resposta
 * @returns true se excluído com sucesso, false se não encontrado
 */
export const deleteUserQuestionResponse = async (id: string): Promise<boolean> => {
  const docRef = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.warn(`Resposta de questão com ID "${id}" não encontrada para exclusão.`);
    return false;
  }
  
  const response = docSnap.data() as FirebaseUserQuestionResponse;
  
  // Se houver uma revisão programada associada, exclua-a também
  if (response.programmedReviewId) {
    try {
      await deleteProgrammedReviewByContentId(
        response.id, 
        FirebaseProgrammedReviewContentType.QUESTION, 
        response.userId
      );
    } catch (error) {
      console.error(`Falha ao excluir revisão programada associada ${response.programmedReviewId}:`, error);
    }
  }
  
  await docRef.delete();
  return true;
};

/**
 * Registra uma revisão para uma resposta de questão
 * @param responseId ID da resposta
 * @param quality Qualidade da revisão (0-5)
 * @param userId ID do usuário
 * @returns Resposta atualizada ou false se falhar
 */
export const recordUserQuestionReview = async (
  responseId: string,
  quality: ReviewQuality,
  userId: string
): Promise<FirebaseUserQuestionResponse | false> => {
  const docRef = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION).doc(responseId);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.warn(`Resposta de questão com ID "${responseId}" não encontrada para revisão.`);
    return false;
  }
  
  const response = docSnap.data() as FirebaseUserQuestionResponse;
  
  if (response.userId !== userId) {
    console.error(`Incompatibilidade de usuário: Tentativa de revisar resposta ${responseId} pelo usuário ${userId}, mas pertence a ${response.userId}`);
    return false;
  }
  
  if (!response.programmedReviewId) {
    console.error(`ID de revisão programada ausente para resposta ${responseId}. Não é possível registrar revisão.`);
    return false;
  }
  
  try {
    const updatedProgrammedReview = await updateProgrammedReview(response.programmedReviewId, quality);
    
    if (!updatedProgrammedReview) {
      console.error(`Falha ao atualizar revisão programada ${response.programmedReviewId}.`);
      return false;
    }
    
    const updates: Partial<FirebaseUserQuestionResponse> = {
      lastReviewDate: updatedProgrammedReview.lastReviewedAt || null,
      nextReviewDate: updatedProgrammedReview.nextReviewAt,
      srsLevel: updatedProgrammedReview.intervalDays,
      reviewCount: (response.reviewCount || 0) + 1,
      updatedAt: Timestamp.now()
    };
    
    await docRef.update(updates);
    const updatedDocSnap = await docRef.get();
    return updatedDocSnap.data() as FirebaseUserQuestionResponse;
  } catch (error) {
    console.error(`Erro ao registrar revisão para resposta ${responseId}:`, error);
    return false;
  }
};

/**
 * Obtém todas as respostas de um usuário
 * @param userId ID do usuário
 * @param options Opções de consulta (ordenação, limite, etc.)
 * @returns Lista de respostas
 */
export const getUserQuestionResponsesByUserId = async (
  userId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    startAfter?: any;
    isCorrect?: boolean;
    questionId?: string;
    questionListId?: string;
  }
): Promise<{
  responses: FirebaseUserQuestionResponse[];
  lastDoc?: any;
}> => {
  let query: Query = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("userId", "==", userId);
  
  if (options?.isCorrect !== undefined) {
    query = query.where("isCorrect", "==", options.isCorrect);
  }
  
  if (options?.questionId) {
    query = query.where("questionId", "==", options.questionId);
  }
  
  if (options?.questionListId) {
    query = query.where("questionListId", "==", options.questionListId);
  }
  
  const orderBy = options?.orderBy || "createdAt";
  const orderDirection = options?.orderDirection || "desc";
  query = query.orderBy(orderBy, orderDirection);
  
  if (options?.startAfter) {
    query = query.startAfter(options.startAfter);
  }
  
  const limit = options?.limit || 20;
  query = query.limit(limit);
  
  const querySnapshot = await query.get();
  const responses: FirebaseUserQuestionResponse[] = [];
  
  querySnapshot.forEach((doc) => {
    responses.push(doc.data() as FirebaseUserQuestionResponse);
  });
  
  const lastDoc = querySnapshot.docs.length > 0 
    ? querySnapshot.docs[querySnapshot.docs.length - 1] 
    : undefined;
  
  return { responses, lastDoc };
};

/**
 * Obtém todas as respostas para uma questão específica
 * @param questionId ID da questão
 * @param options Opções de consulta
 * @returns Lista de respostas
 */
export const getUserQuestionResponsesByQuestionId = async (
  questionId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    startAfter?: any;
    isCorrect?: boolean;
    userId?: string;
  }
): Promise<{
  responses: FirebaseUserQuestionResponse[];
  lastDoc?: any;
}> => {
  let query: Query = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("questionId", "==", questionId);
  
  if (options?.isCorrect !== undefined) {
    query = query.where("isCorrect", "==", options.isCorrect);
  }
  
  if (options?.userId) {
    query = query.where("userId", "==", options.userId);
  }
  
  const orderBy = options?.orderBy || "createdAt";
  const orderDirection = options?.orderDirection || "desc";
  query = query.orderBy(orderBy, orderDirection);
  
  if (options?.startAfter) {
    query = query.startAfter(options.startAfter);
  }
  
  const limit = options?.limit || 20;
  query = query.limit(limit);
  
  const querySnapshot = await query.get();
  const responses: FirebaseUserQuestionResponse[] = [];
  
  querySnapshot.forEach((doc) => {
    responses.push(doc.data() as FirebaseUserQuestionResponse);
  });
  
  const lastDoc = querySnapshot.docs.length > 0 
    ? querySnapshot.docs[querySnapshot.docs.length - 1] 
    : undefined;
  
  return { responses, lastDoc };
};

/**
 * Obtém as estatísticas de respostas para um usuário
 * @param userId ID do usuário
 * @returns Estatísticas de respostas
 */
export const getUserQuestionResponseStats = async (
  userId: string
): Promise<{
  totalResponses: number;
  correctResponses: number;
  incorrectResponses: number;
  accuracyRate: number;
  pendingReviews: number;
}> => {
  const totalQuery = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("userId", "==", userId);
  
  const correctQuery = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("userId", "==", userId)
    .where("isCorrect", "==", true);
  
  const pendingReviewsQuery = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("userId", "==", userId)
    .where("nextReviewDate", "<=", Timestamp.now());
  
  const [totalSnapshot, correctSnapshot, pendingReviewsSnapshot] = await Promise.all([
    totalQuery.count().get(),
    correctQuery.count().get(),
    pendingReviewsQuery.count().get()
  ]);
  
  const totalResponses = totalSnapshot.data().count;
  const correctResponses = correctSnapshot.data().count;
  const incorrectResponses = totalResponses - correctResponses;
  const accuracyRate = totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0;
  const pendingReviews = pendingReviewsSnapshot.data().count;
  
  return {
    totalResponses,
    correctResponses,
    incorrectResponses,
    accuracyRate,
    pendingReviews
  };
};

/**
 * Obtém as respostas de questões que precisam ser revisadas
 * @param userId ID do usuário
 * @param options Opções de consulta
 * @returns Lista de respostas para revisão
 */
export const getDueUserQuestionResponses = async (
  userId: string,
  options?: {
    limit?: number;
    startAfter?: any;
  }
): Promise<{
  responses: FirebaseUserQuestionResponse[];
  lastDoc?: any;
}> => {
  let query: Query = firestore.collection(USER_QUESTION_RESPONSES_COLLECTION)
    .where("userId", "==", userId)
    .where("nextReviewDate", "<=", Timestamp.now())
    .orderBy("nextReviewDate", "asc");
  
  if (options?.startAfter) {
    query = query.startAfter(options.startAfter);
  }
  
  const limit = options?.limit || 20;
  query = query.limit(limit);
  
  const querySnapshot = await query.get();
  const responses: FirebaseUserQuestionResponse[] = [];
  
  querySnapshot.forEach((doc) => {
    responses.push(doc.data() as FirebaseUserQuestionResponse);
  });
  
  const lastDoc = querySnapshot.docs.length > 0 
    ? querySnapshot.docs[querySnapshot.docs.length - 1] 
    : undefined;
  
  return { responses, lastDoc };
};

// Exporta o serviço
export const firebaseUserQuestionResponseService = {
  createUserQuestionResponse,
  getUserQuestionResponseById,
  updateUserQuestionResponse,
  deleteUserQuestionResponse,
  recordUserQuestionReview,
  getUserQuestionResponsesByUserId,
  getUserQuestionResponsesByQuestionId,
  getUserQuestionResponseStats,
  getDueUserQuestionResponses
};