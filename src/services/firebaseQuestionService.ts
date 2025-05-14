import { firestore } from "../config/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { FirebaseQuestion, FirebaseQuestionStatus, FirebaseQuestionAlternative } from "../types/firebaseTypes";
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = "questions";

export const createQuestion = async (
  data: Omit<FirebaseQuestion, "id" | "createdAt" | "updatedAt" | "reviewCount" | "averageRating" | "alternatives">
  & { alternatives: Omit<FirebaseQuestionAlternative, 'id'>[] } // Ensure alternatives are passed without IDs initially
): Promise<FirebaseQuestion> => {
  const docRef = firestore.collection(COLLECTION_NAME).doc();
  const now = Timestamp.now();

  const alternativesWithIds: FirebaseQuestionAlternative[] = data.alternatives.map(alt => ({
    ...alt,
    id: uuidv4(), // Generate UUID for each alternative
  }));

  const newQuestion: FirebaseQuestion = {
    id: docRef.id,
    ...data,
    alternatives: alternativesWithIds,
    status: data.status || FirebaseQuestionStatus.DRAFT, // Default to DRAFT if not provided
    isAnnulled: data.isAnnulled === undefined ? false : data.isAnnulled,
    isActive: data.isActive === undefined ? true : data.isActive, // Default to true
    reviewCount: 0,
    averageRating: 0,
    createdAt: now,
    updatedAt: now,
  };
  await docRef.set(newQuestion);
  return newQuestion;
};

export const getQuestionById = async (id: string): Promise<FirebaseQuestion | null> => {
  const docRef = firestore.collection(COLLECTION_NAME).doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return null;
  }
  const questionData = docSnap.data() as FirebaseQuestion;
  // Ensure alternatives always exist, even if empty, for type consistency
  return { ...questionData, alternatives: questionData.alternatives || [] };
};

export const updateQuestion = async (
  id: string,
  updateData: Partial<Omit<FirebaseQuestion, "id" | "createdAt" | "updatedAt">>
): Promise<FirebaseQuestion | null> => {
  const docRef = firestore.collection(COLLECTION_NAME).doc(id);
  const docSnap = await docRef.get(); // Check if document exists first

  if (!docSnap.exists) {
    return null; // Return null if document does not exist, as per test expectation
  }
  
  // Ensure alternatives are handled correctly during updates
  let processedUpdateData: any = { ...updateData };
  if (updateData.alternatives) {
    processedUpdateData.alternatives = updateData.alternatives.map(alt => 
      alt.id ? alt : { ...alt, id: uuidv4() } // Add ID if missing for new alternatives
    );
  }

  const dataToUpdate = { ...processedUpdateData, updatedAt: Timestamp.now() };
  await docRef.update(dataToUpdate);
  const updatedDoc = await docRef.get();
  // No need to check updatedDoc.exists again, as we updated it.
  const questionData = updatedDoc.data() as FirebaseQuestion;
  return { ...questionData, alternatives: questionData.alternatives || [] };
};

// Implements soft delete by setting status to ARCHIVED and isActive to false
export const deleteQuestion = async (id: string): Promise<FirebaseQuestion | null> => {
  const docRef = firestore.collection(COLLECTION_NAME).doc(id);
  const docSnap = await docRef.get(); // Check if document exists first

  if (!docSnap.exists) {
    return null; // Return null if document does not exist, as per test expectation
  }

  const updateData = {
    status: FirebaseQuestionStatus.ARCHIVED,
    isActive: false,
    updatedAt: Timestamp.now(),
  };
  await docRef.update(updateData);
  const updatedDoc = await docRef.get(); // Re-fetch the document to return its updated state
  return updatedDoc.exists ? (updatedDoc.data() as FirebaseQuestion) : null; // Should exist as we just updated it
};

interface ListQuestionsOptions {
  limit?: number;
  startAfter?: string; // Document ID to start after
  status?: FirebaseQuestionStatus;
  difficulty?: string; // Using string to match FirebaseQuestionDifficulty enum values
  tags?: string[]; // For array-contains-any query on tags
  filterIds?: string[]; // For array-contains-any query on filterIds
  subFilterIds?: string[]; // For array-contains-any query on subFilterIds
  isAnnulled?: boolean;
  isActive?: boolean;
  source?: string;
  year?: number;
  orderBy?: string; // Field to order by (e.g., "createdAt")
  orderDirection?: "asc" | "desc";
}

export const getQuestions = async (options?: ListQuestionsOptions): Promise<{ questions: FirebaseQuestion[]; nextPageStartAfter?: string }> => {
  // Alias para manter compatibilidade com código existente
  return listQuestions(options);
};

export const listQuestions = async (options?: ListQuestionsOptions): Promise<{ questions: FirebaseQuestion[]; nextPageStartAfter?: string }> => {
  let query: any = firestore.collection(COLLECTION_NAME);

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }
  if (options?.difficulty) {
    query = query.where("difficulty", "==", options.difficulty);
  }
  if (options?.isAnnulled !== undefined) {
    query = query.where("isAnnulled", "==", options.isAnnulled);
  }
  if (options?.isActive !== undefined) {
    query = query.where("isActive", "==", options.isActive);
  }
  if (options?.source) {
    query = query.where("source", "==", options.source);
  }
  if (options?.year) {
    query = query.where("year", "==", options.year);
  }
  // Firestore does not support multiple array-contains-any or mixing array-contains with other non-equality filters on different fields in the same query.
  // For tags, filterIds, subFilterIds, you might need to perform client-side filtering or denormalize data for more complex queries.
  // Simple array-contains for a single tag/filterId for demonstration:
  if (options?.tags && options.tags.length > 0) {
    // This will only work for a single tag if using 'array-contains'. 
    // For multiple tags (OR logic), Firestore requires multiple queries or a different data structure.
    // Using 'array-contains-any' for multiple values in 'tags', 'filterIds', 'subFilterIds' requires specific index configuration and careful query construction.
    // For simplicity, this example might need adjustment for full 'array-contains-any' across multiple fields.
    // Let's assume for now we filter by the first tag if multiple are provided, or adjust if a single field is targeted for array-contains-any
    query = query.where("tags", "array-contains", options.tags[0]); 
  }
  if (options?.filterIds && options.filterIds.length > 0) {
     query = query.where("filterIds", "array-contains-any", options.filterIds);
  }
   if (options?.subFilterIds && options.subFilterIds.length > 0) {
     query = query.where("subFilterIds", "array-contains-any", options.subFilterIds);
  }

  if (options?.orderBy) {
    query = query.orderBy(options.orderBy, options.orderDirection || "asc");
  }

  if (options?.startAfter) {
    const startAfterDoc = await firestore.collection(COLLECTION_NAME).doc(options.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 10;
  query = query.limit(limit + 1); // Fetch one extra to check for next page

  const snapshot = await query.get();
  const questions = snapshot.docs.map((doc: any) => {
    const data = doc.data() as FirebaseQuestion;
    return { ...data, alternatives: data.alternatives || [] }; // Ensure alternatives array
  });

  let nextPageStartAfter: string | undefined = undefined;
  if (questions.length > limit) {
    nextPageStartAfter = questions[limit -1]?.id; // The ID of the last item on the current page
    questions.pop(); // Remove the extra item used for pagination check
  }

  return { questions, nextPageStartAfter };
};

