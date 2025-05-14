import { firestore as db } from "../config/firebaseAdmin";
import { 
  FirebaseComment, 
  FirebaseCommentStatus
  // FirebaseUserProfile, // For author details - Removed as direct import, type is inferred or not directly used
  // FirebaseArticle // For article context - Removed as direct import, type is inferred or not directly used
} from "../types/firebaseTypes";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getArticleById, updateArticleCommentCount } from "./firebaseArticleService"; // To update comment count on article
import { getUserProfile } from "./firebaseUserService"; // To get author details

const ARTICLE_COMMENTS_COLLECTION = "articleComments";

/**
 * Creates a new article comment.
 * Also increments the commentCount on the parent article.
 */
export const createArticleComment = async (
  data: Omit<FirebaseComment, "id" | "createdAt" | "updatedAt" | "authorName" | "authorProfileImage" | "likeCount">
): Promise<FirebaseComment> => {
  const { articleId, authorId, parentId, ...restData } = data;

  if (!articleId) {
    throw new Error("Article ID is required");
  }

  // Validate article existence
  const article = await getArticleById(articleId);
  if (!article) {
    throw new Error(`Article with ID ${articleId} not found.`);
  }

  // Validate author existence and get details
  if (!authorId) {
    throw new Error("Author ID is required");
  }
  
  const authorProfile = await getUserProfile(authorId);
  if (!authorProfile) {
    throw new Error(`User (author) with ID ${authorId} not found.`);
  }

  // Validate parent comment existence if parentId is provided
  if (parentId) {
    const parentCommentDoc = await db.collection(ARTICLE_COMMENTS_COLLECTION).doc(parentId).get();
    if (!parentCommentDoc.exists) {
      throw new Error(`Parent comment with ID ${parentId} not found.`);
    }
    // Ensure parent comment belongs to the same article
    if (parentCommentDoc.data()?.articleId !== articleId) {
      throw new Error(`Parent comment ${parentId} does not belong to article ${articleId}.`);
    }
  }

  const now = Timestamp.now();
  const id = db.collection(ARTICLE_COMMENTS_COLLECTION).doc().id;

  const newComment: FirebaseComment = {
    id,
    ...restData,
    articleId,
    authorId,
    authorName: authorProfile.name, // Denormalized
    authorProfileImage: authorProfile.profileImage || null, // Denormalized
    parentId: parentId || null,
    status: data.status || FirebaseCommentStatus.PENDING, // Default to pending if not provided
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(ARTICLE_COMMENTS_COLLECTION).doc(id).set(newComment);
  
  // Increment comment count on the article
  if (articleId) {
    await updateArticleCommentCount(articleId, 1);
  }

  return newComment;
};



/**
 * Retrieves a specific article comment by its ID.
 */
export const getArticleCommentById = async (commentId: string): Promise<FirebaseComment | null> => {
  const doc = await db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as FirebaseComment;
};

/**
 * Retrieves all comments (top-level or all) for a given article ID, sorted by creation date.
 * Supports pagination.
 */
export const getArticleCommentsByArticleId = async (
  articleId: string, 
  options: { 
    limit?: number; 
    startAfter?: string; // Document ID to start after for pagination
    includeReplies?: boolean; // If false, only fetches top-level comments
  } = {}
): Promise<{ comments: FirebaseComment[]; lastVisibleId?: string }> => {
  let query = db.collection(ARTICLE_COMMENTS_COLLECTION)
                .where("articleId", "==", articleId)
                .orderBy("createdAt", "desc");

  if (!options.includeReplies) {
    query = query.where("parentId", "==", null);
  }

  if (options.startAfter) {
    const startAfterDoc = await db.collection(ARTICLE_COMMENTS_COLLECTION).doc(options.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  const comments: FirebaseComment[] = [];
  snapshot.forEach(doc => comments.push(doc.data() as FirebaseComment));
  
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return {
    comments,
    lastVisibleId: lastVisible ? lastVisible.id : undefined,
  };
};

/**
 * Retrieves all direct replies for a given parent comment ID, sorted by creation date.
 * Supports pagination.
 */
export const getRepliesByParentId = async (
  parentId: string, 
  options: { 
    limit?: number; 
    startAfter?: string; // Document ID to start after for pagination
  } = {}
): Promise<{ replies: FirebaseComment[]; lastVisibleId?: string }> => {
  let query = db.collection(ARTICLE_COMMENTS_COLLECTION)
                .where("parentId", "==", parentId)
                .orderBy("createdAt", "asc"); // Replies usually shown oldest to newest

  if (options.startAfter) {
    const startAfterDoc = await db.collection(ARTICLE_COMMENTS_COLLECTION).doc(options.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  const replies: FirebaseComment[] = [];
  snapshot.forEach(doc => replies.push(doc.data() as FirebaseComment));
  
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  return {
    replies,
    lastVisibleId: lastVisible ? lastVisible.id : undefined,
  };
};



/**
 * Updates the content of an existing article comment.
 * Only the author or an admin should be able to update.
 */
export const updateArticleComment = async (
  commentId: string, 
  authorId: string, // Used to verify ownership for update
  newContent: string
): Promise<boolean> => {
  const commentRef = db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId);
  const doc = await commentRef.get();

  if (!doc.exists) {
    throw new Error(`Comment with ID ${commentId} not found.`);
  }

  const commentData = doc.data() as FirebaseComment;
  // Basic ownership check (can be expanded with admin roles)
  if (commentData.authorId && authorId && commentData.authorId !== authorId) {
    throw new Error(`User ${authorId} is not authorized to update comment ${commentId}.`);
  }

  await commentRef.update({
    content: newContent,
    updatedAt: Timestamp.now(),
  });
  return true;
};

/**
 * Updates the status of an article comment.
 */
export const updateArticleCommentStatus = async (
  commentId: string,
  newStatus: FirebaseCommentStatus
): Promise<boolean> => {
  const commentRef = db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId);
  const doc = await commentRef.get();

  if (!doc.exists) {
    throw new Error(`Comment with ID ${commentId} not found.`);
  }

  await commentRef.update({
    status: newStatus,
    updatedAt: Timestamp.now(),
  });
  return true;
};

/**
 * Deletes an article comment.
 * Also decrements the commentCount on the parent article.
 * If the comment has replies, they should also be deleted (or handled according to policy).
 * For simplicity, this version will delete the comment and decrement count.
 * A more robust version would handle replies recursively.
 */
export const deleteArticleComment = async (commentId: string): Promise<boolean> => {
  const commentRef = db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId);
  const doc = await commentRef.get();

  if (!doc.exists) {
    throw new Error(`Comment with ID ${commentId} not found.`);
  }

  const commentData = doc.data() as FirebaseComment;
  const articleId = commentData.articleId || "";

  // Recursively delete replies (simple version: only direct replies)
  // A more robust solution would use a batched write or a Cloud Function for deep deletes.
  const repliesSnapshot = await db.collection(ARTICLE_COMMENTS_COLLECTION)
                                .where("parentId", "==", commentId)
                                .get();
  
  const batch = db.batch();
  let repliesCountForDecrement = 0;

  repliesSnapshot.forEach(replyDoc => {
    batch.delete(replyDoc.ref);
    repliesCountForDecrement++;
  });
  
  await batch.commit(); // Delete replies first

  // Now delete the main comment
  await commentRef.delete();

  // Decrement comment count on the article for the main comment and its direct replies
  if (articleId) {
    await updateArticleCommentCount(articleId, -(1 + repliesCountForDecrement));
  }

  return true;
};

/**
 * Increments the like count for an article comment.
 */
export const incrementArticleCommentLikeCount = async (commentId: string): Promise<boolean> => {
  const commentRef = db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId);
  await commentRef.update({
    likeCount: FieldValue.increment(1),
    updatedAt: Timestamp.now(),
  });
  return true;
};

/**
 * Decrements the like count for an article comment.
 */
export const decrementArticleCommentLikeCount = async (commentId: string): Promise<boolean> => {
  const commentRef = db.collection(ARTICLE_COMMENTS_COLLECTION).doc(commentId);
  await commentRef.update({
    likeCount: FieldValue.increment(-1),
    updatedAt: Timestamp.now(),
  });
  return true;
};
