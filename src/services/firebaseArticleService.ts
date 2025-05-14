import { firestore as db } from "../config/firebaseAdmin";
import { FirebaseArticle, FirebaseArticleStatus } from "../types/firebaseTypes";
import { Timestamp, FieldValue, Query, DocumentData } from "firebase-admin/firestore";

const ARTICLES_COLLECTION = "articles";

// Helper function to generate searchable text
const generateSearchableText = (title: string, excerpt?: string | null, tags?: string[] | null): string => {
  let text = title.toLowerCase();
  if (excerpt) {
    text += " " + excerpt.toLowerCase();
  }
  if (tags && tags.length > 0) {
    text += " " + tags.join(" ").toLowerCase();
  }
  return text;
};

/**
 * Creates a new article in Firestore.
 * @param data - The article data to create.
 * @returns The created article with its ID.
 */
export const createArticle = async (
  data: Omit<FirebaseArticle, "id" | "createdAt" | "updatedAt" | "viewCount" | "likeCount" | "commentCount" | "publishedAt" | "searchableText">
): Promise<FirebaseArticle> => {
  const now = Timestamp.now();
  const articleRef = db.collection(ARTICLES_COLLECTION).doc();
  const searchableText = generateSearchableText(data.title, data.excerpt, data.tags);

  const newArticle: FirebaseArticle = {
    id: articleRef.id,
    ...data,
    searchableText, // Added searchable text
    status: data.status || FirebaseArticleStatus.DRAFT, 
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    publishedAt: data.status === FirebaseArticleStatus.PUBLISHED ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  await articleRef.set(newArticle);
  return newArticle;
};

/**
 * Retrieves an article by its ID from Firestore.
 */
export const getArticleById = async (id: string): Promise<FirebaseArticle | null> => {
  const doc = await db.collection(ARTICLES_COLLECTION).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as FirebaseArticle;
};

/**
 * Retrieves an article by its slug from Firestore.
 */
export const getArticleBySlug = async (slug: string): Promise<FirebaseArticle | null> => {
  const snapshot = await db.collection(ARTICLES_COLLECTION).where("slug", "==", slug).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0].data() as FirebaseArticle;
};

/**
 * Updates an existing article in Firestore.
 */
export const updateArticle = async (
  id: string,
  data: Partial<Omit<FirebaseArticle, "id" | "createdAt" | "authorId" | "searchableText">>
): Promise<boolean> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  const doc = await articleRef.get();
  if (!doc.exists) {
    return false;
  }
  const currentData = doc.data() as FirebaseArticle;
  const updateData: Partial<FirebaseArticle> & { updatedAt: Timestamp } = { 
      ...data, 
      updatedAt: Timestamp.now() 
  };

  // Regenerate searchableText if relevant fields are updated
  const newTitle = data.title ?? currentData.title;
  const newExcerpt = data.excerpt !== undefined ? data.excerpt : currentData.excerpt;
  const newTags = data.tags !== undefined ? data.tags : currentData.tags;
  if (data.title || data.excerpt !== undefined || data.tags !== undefined) {
    updateData.searchableText = generateSearchableText(newTitle, newExcerpt, newTags);
  }

  if (data.status === FirebaseArticleStatus.PUBLISHED && !currentData.publishedAt) {
    updateData.publishedAt = Timestamp.now();
  }

  await articleRef.update(updateData);
  return true;
};

/**
 * Deletes an article from Firestore.
 */
export const deleteArticle = async (id: string): Promise<boolean> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  const doc = await articleRef.get();
  if (!doc.exists) {
    return false;
  }
  await articleRef.delete();
  return true;
};

/**
 * Lists articles with pagination and optional filters, including text search.
 */
export const listArticles = async (
  options: {
    limit?: number;
    startAfter?: string; 
    status?: FirebaseArticleStatus;
    categoryId?: string;
    authorId?: string;
    tags?: string[]; 
    searchQuery?: string; // Added for text search
    sortBy?: keyof FirebaseArticle | "publishedAt" | "createdAt" | "title"; // Added title for sorting
    sortDirection?: "asc" | "desc";
  } = {}
): Promise<{ articles: FirebaseArticle[]; nextCursor?: string }> => {
  let query: Query<DocumentData> = db.collection(ARTICLES_COLLECTION);

  if (options.status) {
    query = query.where("status", "==", options.status);
  }
  if (options.categoryId) {
    query = query.where("categoryId", "==", options.categoryId);
  }
  if (options.authorId) {
    query = query.where("authorId", "==", options.authorId);
  }
  if (options.tags && options.tags.length > 0) {
    query = query.where("tags", "array-contains-any", options.tags.slice(0, 10)); // Max 10 for array-contains-any
  }
  if (options.searchQuery) {
    const searchQueryLower = options.searchQuery.toLowerCase();
    query = query.where("searchableText", ">=", searchQueryLower)
                 .where("searchableText", "<=", searchQueryLower + "\uf8ff");
    // When using text search, Firestore requires the first orderBy to be on the same field as the inequality filter.
    // So, if searchQuery is present, we must order by searchableText first.
    // This might override user's sortBy preference if it's not searchableText.
    // For a better UX, one might disable other sort options when text search is active or use a dedicated search engine.
    query = query.orderBy("searchableText").orderBy(options.sortBy || "publishedAt", options.sortDirection || "desc");
  } else {
    query = query.orderBy(options.sortBy || "publishedAt", options.sortDirection || "desc");
    if ((options.sortBy || "publishedAt") !== "createdAt") { // Add secondary sort for stability if primary is not unique enough
        query = query.orderBy("createdAt", options.sortDirection || "desc");
    }
  }

  let articles: FirebaseArticle[] = [];
  let nextCursor: string | undefined = undefined;
  const limit = options.limit || 10;

  if (options.startAfter) {
    const startAfterDoc = await db.collection(ARTICLES_COLLECTION).doc(options.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  query = query.limit(limit + 1); // Fetch one extra to check for next page
  const snapshot = await query.get();
  articles = snapshot.docs.map(doc => doc.data() as FirebaseArticle);
  
  if (articles.length > limit) {
    const lastDoc = articles.pop(); // Remove the extra one
    if (lastDoc) {
        nextCursor = lastDoc.id;
    }
  }

  return { articles, nextCursor };
};

/**
 * Increments the view count of an article.
 */
export const incrementArticleViewCount = async (id: string): Promise<void> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  await articleRef.update({ viewCount: FieldValue.increment(1), updatedAt: Timestamp.now() });
};

/**
 * Increments the like count of an article.
 */
export const incrementArticleLikeCount = async (id: string): Promise<void> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  await articleRef.update({ likeCount: FieldValue.increment(1), updatedAt: Timestamp.now() });
};

/**
 * Decrements the like count of an article.
 */
export const decrementArticleLikeCount = async (id: string): Promise<void> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  await articleRef.update({ likeCount: FieldValue.increment(-1), updatedAt: Timestamp.now() });
};

/**
 * Updates the comment count of an article by a given amount (positive or negative).
 */
export const updateArticleCommentCount = async (id: string, amount: number): Promise<void> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  await articleRef.update({ commentCount: FieldValue.increment(amount), updatedAt: Timestamp.now() });
};

/**
 * Changes the status of an article (e.g., to publish, archive).
 */
export const updateArticleStatus = async (
  id: string,
  status: FirebaseArticleStatus
): Promise<boolean> => {
  const articleRef = db.collection(ARTICLES_COLLECTION).doc(id);
  const doc = await articleRef.get();
  if (!doc.exists) {
    return false;
  }
  const currentData = doc.data() as FirebaseArticle;
  const updatePayload: Partial<FirebaseArticle> & { updatedAt: Timestamp } = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === FirebaseArticleStatus.PUBLISHED && !currentData.publishedAt) {
    updatePayload.publishedAt = Timestamp.now();
  }
  // If status changes, searchableText might need re-evaluation if status was part of it, but it's not currently.

  await articleRef.update(updatePayload);
  return true;
};

