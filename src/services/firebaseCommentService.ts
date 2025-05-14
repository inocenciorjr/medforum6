import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore as db } from "../config/firebaseAdmin"; 
import { FirebaseComment, FirebaseCommentStatus, FirebaseCommentContentType, FirebaseUserProfile, FirebaseUser } from "../types/firebaseTypes";

export const createComment = async (commentData: {
  postId: string; 
  contentType: FirebaseCommentContentType; 
  userId: string;
  content: string;
  parentId?: string | null;
  authorName?: string; 
  authorProfileImage?: string | null;
}): Promise<FirebaseComment> => {
  if (!commentData.postId) throw new Error("O ID do post é obrigatório.");
  if (!commentData.userId) throw new Error("O ID do usuário (autor) é obrigatório.");
  if (!commentData.content || commentData.content.trim() === "") {
    throw new Error("O conteúdo do comentário não pode estar vazio.");
  }

  const newCommentRef = db.collection("comments").doc();
  const now = Timestamp.now();

  let authorNameToStore = commentData.authorName;
  let authorProfileImageToStore = commentData.authorProfileImage;

  if (!authorNameToStore || authorProfileImageToStore === undefined) {
    try {
      const userDoc = await db.collection("users").doc(commentData.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as FirebaseUser; // Use FirebaseUser which has displayName
        if (!authorNameToStore) {
            authorNameToStore = userData.displayName || undefined; // Prefer displayName
        }
        if (authorProfileImageToStore === undefined) { // Only fetch if not explicitly passed (even if null)
            authorProfileImageToStore = userData.profileImage || null;
        }
      }
    } catch (error) {
      console.warn(`Não foi possível buscar dados do autor ${commentData.userId} para denormalização:`, error);
    }
  }

  const newCommentObject: Omit<FirebaseComment, "authorProfileImage"> & { authorProfileImage?: string | null } = {
    id: newCommentRef.id,
    postId: commentData.postId,
    contentId: commentData.postId, 
    contentType: commentData.contentType,
    userId: commentData.userId,
    authorName: authorNameToStore || "Usuário Anônimo", 
    parentId: commentData.parentId || null,
    content: commentData.content,
    likeCount: 0,
    replyCount: 0,
    status: FirebaseCommentStatus.PENDING, 
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // Adiciona authorProfileImage apenas se não for undefined.
  // Se for null, será enviado como null, o que é permitido.
  if (authorProfileImageToStore !== undefined) {
    newCommentObject.authorProfileImage = authorProfileImageToStore;
  }

  await newCommentRef.set(newCommentObject);

  if (newCommentObject.parentId) {
    const parentCommentRef = db.collection("comments").doc(newCommentObject.parentId);
    await parentCommentRef.update({
      replyCount: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });
  }
  
  return newCommentObject as FirebaseComment; // Cast back to FirebaseComment
};

export const getCommentById = async (id: string, includeDeleted: boolean = false): Promise<FirebaseComment | null> => {
  const docRef = db.collection("comments").doc(id);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    const comment = docSnap.data() as FirebaseComment;
    if (!comment.isDeleted || includeDeleted) {
      return comment;
    }
  }
  return null;
};

export const updateComment = async (
  id: string, 
  userId: string, 
  updateData: { content?: string; status?: FirebaseCommentStatus }
): Promise<FirebaseComment> => {
  const commentRef = db.collection("comments").doc(id);
  const commentDoc = await commentRef.get();

  if (!commentDoc.exists) {
    throw new Error(`Comentário com ID "${id}" não encontrado.`);
  }

  const currentData = commentDoc.data() as FirebaseComment;

  if (currentData.isDeleted) {
    throw new Error("Não é possível atualizar um comentário deletado.");
  }

  if (currentData.userId !== userId) { 
     if (updateData.content) throw new Error("Usuário não autorizado a atualizar o conteúdo deste comentário.");
  }

  const dataToUpdate: Partial<FirebaseComment> = {
    updatedAt: Timestamp.now(),
  };

  if (updateData.content && updateData.content !== currentData.content) {
    dataToUpdate.content = updateData.content;
    dataToUpdate.isEdited = true;
  }

  if (updateData.status && updateData.status !== currentData.status) {
    dataToUpdate.status = updateData.status;
  }
  
  if (Object.keys(dataToUpdate).length === 1 && dataToUpdate.updatedAt) {
      return currentData; 
  }

  await commentRef.update(dataToUpdate);
  const updatedDoc = await commentRef.get();
  return updatedDoc.data() as FirebaseComment;
};

export const deleteComment = async (id: string, userId: string): Promise<void> => {
  const commentRef = db.collection("comments").doc(id);
  const commentDoc = await commentRef.get();

  if (!commentDoc.exists) {
    throw new Error(`Comentário com ID "${id}" não encontrado.`);
  }

  const currentData = commentDoc.data() as FirebaseComment;

  if (currentData.isDeleted) {
    console.warn(`Comentário com ID "${id}" já está deletado.`);
    return;
  }

  if (currentData.userId !== userId) {
    throw new Error("Usuário não autorizado a deletar este comentário.");
  }

  const now = Timestamp.now();
  await commentRef.update({
    isDeleted: true,
    deletedAt: now,
    updatedAt: now, 
  });

  if (currentData.parentId) {
    const parentCommentRef = db.collection("comments").doc(currentData.parentId);
    const parentDoc = await parentCommentRef.get();
    const parentData = parentDoc.data() as FirebaseComment | undefined;
    if (parentDoc.exists && parentData && typeof parentData.replyCount === 'number' && parentData.replyCount > 0) {
        await parentCommentRef.update({
            replyCount: FieldValue.increment(-1),
            updatedAt: Timestamp.now(),
        });
    }
  }
};

export const listCommentsByPostId = async (postId: string, options?: {
  limit?: number;
  startAfter?: FirebaseComment; 
  sortBy?: "createdAt" | "likeCount";
  sortDirection?: "asc" | "desc";
  status?: FirebaseCommentStatus;
  includeDeleted?: boolean;
  parentId?: string | null; 
}): Promise<{ comments: FirebaseComment[]; nextPageStartAfter?: FirebaseComment }> => {
  if (!postId) throw new Error("ID do Post é obrigatório para listar comentários.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("comments")
                                                                      .where("postId", "==", postId);

  if (!options?.includeDeleted) {
    query = query.where("isDeleted", "==", false);
  }

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }

  if (options?.parentId !== undefined) {
      query = query.where("parentId", "==", options.parentId);
  }

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "asc"; 
  query = query.orderBy(sortBy, sortDirection);
  if (sortBy !== "createdAt") { 
      query = query.orderBy("createdAt", sortDirection); 
  }


  if (options?.startAfter) {
    const startAfterDoc = await db.collection("comments").doc(options.startAfter.id).get();
    if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 20;
  query = query.limit(limit + 1); 

  const snapshot = await query.get();
  const comments = snapshot.docs.map(doc => doc.data() as FirebaseComment);
  
  let nextPageStartAfter: FirebaseComment | undefined = undefined;
  if (comments.length > limit) {
    nextPageStartAfter = comments.pop(); 
  }

  return { comments, nextPageStartAfter };
};

export const likeComment = async (commentId: string): Promise<void> => {
  const commentRef = db.collection("comments").doc(commentId);
  await commentRef.update({
    likeCount: FieldValue.increment(1),
    updatedAt: Timestamp.now(),
  });
};

export const unlikeComment = async (commentId: string): Promise<void> => {
  const commentRef = db.collection("comments").doc(commentId);
  const commentDoc = await commentRef.get();
  const commentData = commentDoc.data() as FirebaseComment | undefined;
  if (commentDoc.exists && commentData && typeof commentData.likeCount === 'number' && commentData.likeCount > 0) {
    await commentRef.update({
      likeCount: FieldValue.increment(-1),
      updatedAt: Timestamp.now(),
    });
  } else if (commentDoc.exists) {
    await commentRef.update({ updatedAt: Timestamp.now() });
  }
};



export const updateCommentStatus = async (
  commentId: string,
  newStatus: FirebaseCommentStatus
): Promise<FirebaseComment> => {
  const commentRef = db.collection("comments").doc(commentId);
  const commentDoc = await commentRef.get();

  if (!commentDoc.exists) {
    throw new Error(`Comentário com ID "${commentId}" não encontrado.`);
  }

  const currentData = commentDoc.data() as FirebaseComment;

  if (currentData.isDeleted) {
    throw new Error("Não é possível atualizar o status de um comentário deletado.");
  }

  if (currentData.status === newStatus) {
    return currentData; // No change needed
  }

  const dataToUpdate: Partial<FirebaseComment> = {
    status: newStatus,
    updatedAt: Timestamp.now(),
  };

  await commentRef.update(dataToUpdate);
  const updatedDoc = await commentRef.get();
  return updatedDoc.data() as FirebaseComment;
};

export const getCommentsByPostId = async (
  postId: string,
  contentType: FirebaseCommentContentType,
  page: number = 1,
  limit: number = 10
): Promise<{ comments: FirebaseComment[]; total: number; page: number; limit: number }> => {
  if (!postId) throw new Error("O ID do post é obrigatório.");
  
  const startAt = (page - 1) * limit;
  
  // Consulta para obter comentários de primeiro nível (sem parentId)
  let query = db.collection("comments")
    .where("postId", "==", postId)
    .where("contentType", "==", contentType)
    .where("parentId", "==", null)
    .where("isDeleted", "==", false)
    .orderBy("createdAt", "desc");
  
  // Obter o total de comentários para paginação
  const totalSnapshot = await query.get();
  const total = totalSnapshot.size;
  
  // Aplicar paginação
  query = query.limit(limit).offset(startAt);
  
  const commentsSnapshot = await query.get();
  const comments: FirebaseComment[] = [];
  
  commentsSnapshot.forEach(doc => {
    comments.push(doc.data() as FirebaseComment);
  });
  
  return {
    comments,
    total,
    page,
    limit
  };
};

