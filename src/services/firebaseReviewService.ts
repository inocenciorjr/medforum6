import { Firestore, Timestamp } from "firebase-admin/firestore";
import { FirebaseReview, FirebaseReviewStatus } from "../types/firebaseTypes";

// Função para inicializar o serviço com a instância do Firestore
let db: Firestore;
export const initReviewService = (firestoreInstance: Firestore) => {
  db = firestoreInstance;
};

/**
 * Cria uma nova avaliação (review) no Firestore.
 * @param reviewData Dados para a nova avaliação.
 * @returns A avaliação criada.
 */
export const createReview = async (reviewData: {
  userId: string;
  targetId: string; // Renomeado de entityId
  targetType: string; // Renomeado de entityType e tipo ajustado
  rating: number;
  comment: string;
  // title?: string | null; // Removido - não existe em FirebaseReview
  // authorName?: string; // Removido - não existe em FirebaseReview
  // authorProfileImage?: string | null; // Removido - não existe em FirebaseReview
  // isAnonymous?: boolean; // Removido - não existe em FirebaseReview
}): Promise<FirebaseReview> => {
  if (!db) throw new Error("ReviewService não inicializado. Chame initReviewService primeiro.");
  if (!reviewData.userId) throw new Error("O ID do usuário (autor) é obrigatório.");
  if (!reviewData.targetId) throw new Error("O ID da entidade avaliada é obrigatório.");
  if (!reviewData.targetType) throw new Error("O tipo da entidade avaliada é obrigatório.");
  if (reviewData.rating === undefined || reviewData.rating < 1 || reviewData.rating > 5) {
    throw new Error("A nota (rating) deve ser um número entre 1 e 5.");
  }
  if (!reviewData.comment || reviewData.comment.trim() === "") {
    throw new Error("O comentário da avaliação não pode estar vazio.");
  }

  const newReviewRef = db.collection("reviews").doc();
  const now = Timestamp.now();

  // Lógica para authorName e authorProfileImage foi removida pois não existem no tipo FirebaseReview

  const newReview: FirebaseReview = {
    id: newReviewRef.id,
    userId: reviewData.userId,
    targetId: reviewData.targetId,
    targetType: reviewData.targetType,
    rating: reviewData.rating,
    comment: reviewData.comment,
    status: FirebaseReviewStatus.APPROVED, // Padrão, pode mudar conforme política de moderação
    createdAt: now,
    updatedAt: now,
    // Propriedades como authorName, title, isEdited, etc., foram removidas para alinhar com FirebaseReview
  };

  await newReviewRef.set(newReview);
  
  return newReview;
};

/**
 * Busca uma avaliação (review) pelo ID.
 * @param id ID da avaliação.
 * @returns A avaliação encontrada ou null se não existir.
 */
export const getReviewById = async (id: string): Promise<FirebaseReview | null> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  const docRef = db.collection("reviews").doc(id);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseReview;
  }
  return null;
};

/**
 * Atualiza uma avaliação existente.
 * @param id ID da avaliação a ser atualizada.
 * @param userId ID do usuário tentando realizar a atualização.
 * @param updateData Dados para atualizar (rating, comment, status).
 * @returns A avaliação atualizada.
 */
export const updateReview = async (
  id: string,
  userId: string,
  updateData: {
    rating?: number;
    // title?: string | null; // Removido
    comment?: string;
    status?: FirebaseReviewStatus;
  }
): Promise<FirebaseReview> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  const reviewRef = db.collection("reviews").doc(id);
  const reviewDoc = await reviewRef.get();

  if (!reviewDoc.exists) {
    throw new Error(`Avaliação com ID "${id}" não encontrada.`);
  }

  const currentData = reviewDoc.data() as FirebaseReview;

  if (currentData.userId !== userId) {
    if (updateData.rating || updateData.comment /*|| updateData.title !== undefined*/ ) { // title removido
        throw new Error("Usuário não autorizado a modificar o conteúdo desta avaliação.");
    }
  }

  const dataToUpdate: Partial<FirebaseReview> = {
    updatedAt: Timestamp.now(),
  };

  // let contentChanged = false; // isEdited foi removido
  if (updateData.rating !== undefined && updateData.rating !== currentData.rating) {
    if (updateData.rating < 1 || updateData.rating > 5) throw new Error("A nota (rating) deve ser entre 1 e 5.");
    dataToUpdate.rating = updateData.rating;
    // contentChanged = true;
  }
  // if (updateData.title !== undefined && updateData.title !== currentData.title) { // title removido
  //   dataToUpdate.title = updateData.title;
  //   contentChanged = true;
  // }
  if (updateData.comment && updateData.comment !== currentData.comment) {
    dataToUpdate.comment = updateData.comment;
    // contentChanged = true;
  }

  // if (contentChanged) { // isEdited foi removido
  //   dataToUpdate.isEdited = true;
  // }

  if (updateData.status && updateData.status !== currentData.status) {
    // Apenas permitir mudança de status se o usuário NÃO for o autor.
    // (No futuro, adicionar lógica para permitir se for admin)
    if (currentData.userId !== userId) {
      dataToUpdate.status = updateData.status;
    }
    // Se for o autor (currentData.userId === userId), a tentativa de mudar o status é ignorada.
    // O status em dataToUpdate não será definido, então o status da review não mudará.
  }

  if (Object.keys(dataToUpdate).length === 1 && dataToUpdate.updatedAt) {
      return currentData; 
  }

  await reviewRef.update(dataToUpdate);
  
  const updatedDoc = await reviewRef.get();
  return updatedDoc.data() as FirebaseReview;
};

/**
 * Deleta uma avaliação.
 * @param id ID da avaliação a ser deletada.
 * @param userId ID do usuário tentando realizar a deleção.
 */
export const deleteReview = async (id: string, userId: string): Promise<void> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  const reviewRef = db.collection("reviews").doc(id);
  const reviewDoc = await reviewRef.get();

  if (!reviewDoc.exists) {
    throw new Error(`Avaliação com ID "${id}" não encontrada.`);
  }

  const currentData = reviewDoc.data() as FirebaseReview;

   if (currentData.userId !== userId) {
     throw new Error("Usuário não autorizado a deletar esta avaliação.");
   }

  await reviewRef.delete();
};

/**
 * Lista avaliações para uma entidade específica.
 */
export const listReviewsByEntity = async (targetId: string, targetType: string, options?: {
  limit?: number;
  startAfter?: FirebaseReview;
  sortBy?: "createdAt" | "rating"; // helpfulCount removido
  sortDirection?: "asc" | "desc";
  status?: FirebaseReviewStatus;
  minRating?: number;
}): Promise<{ reviews: FirebaseReview[]; nextPageStartAfter?: FirebaseReview }> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  if (!targetId || !targetType) throw new Error("ID e Tipo da Entidade são obrigatórios.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("reviews")
                                                                      .where("targetId", "==", targetId)
                                                                      .where("targetType", "==", targetType);

  query = query.where("status", "==", options?.status || FirebaseReviewStatus.APPROVED);

  if (options?.minRating !== undefined) {
    query = query.where("rating", ">=", options.minRating);
  }

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);
  if (sortBy !== "createdAt") { 
      query = query.orderBy("createdAt", "desc"); 
  }

  if (options?.startAfter) {
    const startAfterDoc = await db.collection("reviews").doc(options.startAfter.id).get();
    if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 10;
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const reviews = snapshot.docs.map(doc => doc.data() as FirebaseReview);
  
  let nextPageStartAfter: FirebaseReview | undefined = undefined;
  if (reviews.length > limit) {
    nextPageStartAfter = reviews.pop();
  }

  return { reviews, nextPageStartAfter };
};

/**
 * Lista avaliações feitas por um usuário específico.
 */
export const listReviewsByUserId = async (userId: string, options?: {
  limit?: number;
  startAfter?: FirebaseReview;
  sortBy?: "createdAt" | "rating";
  sortDirection?: "asc" | "desc";
}): Promise<{ reviews: FirebaseReview[]; nextPageStartAfter?: FirebaseReview }> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  if (!userId) throw new Error("ID do Usuário é obrigatório.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("reviews")
                                                                      .where("userId", "==", userId);

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);
   if (sortBy !== "createdAt") {
      query = query.orderBy("createdAt", "desc"); 
  }

  if (options?.startAfter) {
    const startAfterDoc = await db.collection("reviews").doc(options.startAfter.id).get();
     if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 10;
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const reviews = snapshot.docs.map(doc => doc.data() as FirebaseReview);
  
  let nextPageStartAfter: FirebaseReview | undefined = undefined;
  if (reviews.length > limit) {
    nextPageStartAfter = reviews.pop();
  }

  return { reviews, nextPageStartAfter };
};

/**
 * Marca uma avaliação como "útil".
 */
export const markReviewAsHelpful = async (_reviewId: string): Promise<void> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  // const reviewRef = db.collection("reviews").doc(reviewId); // Removido pois não era utilizado
  // helpfulCount não existe em FirebaseReview, removendo a lógica
  // await reviewRef.update({
  //   helpfulCount: FieldValue.increment(1),
  //   updatedAt: Timestamp.now(),
  // });
  console.warn("Funcionalidade markReviewAsHelpful desativada pois 'helpfulCount' não existe em FirebaseReview.");
};

/**
 * Marca uma avaliação como "não útil".
 */
export const markReviewAsNotHelpful = async (_reviewId: string): Promise<void> => {
  if (!db) throw new Error("ReviewService não inicializado.");
  // const reviewRef = db.collection("reviews").doc(reviewId); // Removido pois não era utilizado
  // notHelpfulCount não existe em FirebaseReview, removendo a lógica
  // await reviewRef.update({
  //   notHelpfulCount: FieldValue.increment(1),
  //   updatedAt: Timestamp.now(),
  // });
  console.warn("Funcionalidade markReviewAsNotHelpful desativada pois 'notHelpfulCount' não existe em FirebaseReview.");
};

