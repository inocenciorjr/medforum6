import { firestore as db } from "../config/firebaseAdmin";
import {
  FirebaseUserTopicPerformance
} from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

const USER_TOPIC_PERFORMANCE_COLLECTION = "user_topic_performances";

/**
 * Creates or retrieves a user's performance record for a specific topic (subFilter).
 * If the record doesn't exist, it's initialized.
 * This version uses a unique generated ID for each record and relies on queries for userId + subFilterId uniqueness if needed,
 * or a separate function to find by userId and subFilterId.
 */
export const getOrCreateUserTopicPerformance = async (
  userId: string,
  subFilterId: string
): Promise<FirebaseUserTopicPerformance> => {
  // First, try to find an existing record for this specific user and subFilter
  const querySnapshot = await db
    .collection(USER_TOPIC_PERFORMANCE_COLLECTION)
    .where("userId", "==", userId)
    .where("subFilterId", "==", subFilterId)
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as FirebaseUserTopicPerformance;
  }

  // Initialize new user topic performance record
  const now = Timestamp.now();
  const id = uuidv4();
  const newUserTopicPerformance: FirebaseUserTopicPerformance = {
    id,
    userId,
    subFilterId,
    totalQuestionsAnswered: 0,
    correctAnswers: 0,
    totalTimeSpentSeconds: 0,
    lastAnsweredAt: now, // Set to now on creation, will be updated with actual answers
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(USER_TOPIC_PERFORMANCE_COLLECTION).doc(id).set(newUserTopicPerformance);
  console.log(`UserTopicPerformance for user (ID: ${userId}), subFilter (ID: ${subFilterId}) created with ID: ${id}.`);
  return newUserTopicPerformance;
};

/**
 * Updates specific fields in a user's topic performance document.
 */
export const updateUserTopicPerformance = async (
  userTopicPerformanceId: string,
  updates: Partial<Omit<FirebaseUserTopicPerformance, "id" | "userId" | "subFilterId" | "createdAt">>
): Promise<FirebaseUserTopicPerformance | null> => {
  const docRef = db.collection(USER_TOPIC_PERFORMANCE_COLLECTION).doc(userTopicPerformanceId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await docRef.update(updateData);
    console.log(`UserTopicPerformance (ID: ${userTopicPerformanceId}) updated successfully.`);
    const updatedDoc = await docRef.get();
    return updatedDoc.exists ? ({ id: updatedDoc.id, ...updatedDoc.data() } as FirebaseUserTopicPerformance) : null;
  } catch (error) {
    console.error(`Error updating UserTopicPerformance (ID: ${userTopicPerformanceId}):`, error);
    if ((error as any).code === 5) { // Firestore error code for NOT_FOUND
        console.warn(`Attempted to update non-existent UserTopicPerformance ID: ${userTopicPerformanceId}.`);
    }
    throw error;
  }
};



/**
 * Records an answer for a specific topic, updating the performance metrics.
 */
export const recordAnswerInTopic = async (
  userId: string,
  subFilterId: string,
  isCorrect: boolean,
  timeSpentSeconds: number
): Promise<FirebaseUserTopicPerformance | null> => {
  const performanceRecord = await getOrCreateUserTopicPerformance(userId, subFilterId);
  
  const updates: Partial<Omit<FirebaseUserTopicPerformance, "id" | "userId" | "subFilterId" | "createdAt">> = {
    totalQuestionsAnswered: (performanceRecord.totalQuestionsAnswered || 0) + 1,
    correctAnswers: performanceRecord.correctAnswers + (isCorrect ? 1 : 0),
    totalTimeSpentSeconds: (performanceRecord.totalTimeSpentSeconds || 0) + timeSpentSeconds,
    lastAnsweredAt: Timestamp.now(),
  };

  return updateUserTopicPerformance(performanceRecord.id, updates);
};

/**
 * Retrieves all topic performance records for a specific user.
 */
export const getTopicPerformancesByUserId = async (userId: string): Promise<FirebaseUserTopicPerformance[]> => {
  const snapshot = await db
    .collection(USER_TOPIC_PERFORMANCE_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("lastAnsweredAt", "desc") // Optional: order by most recently active topic
    .get();

  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUserTopicPerformance));
};

/**
 * Retrieves a specific UserTopicPerformance record by its ID.
 */
export const getTopicPerformanceById = async (userTopicPerformanceId: string): Promise<FirebaseUserTopicPerformance | null> => {
  const docRef = db.collection(USER_TOPIC_PERFORMANCE_COLLECTION).doc(userTopicPerformanceId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return { id: docSnap.id, ...docSnap.data() } as FirebaseUserTopicPerformance;
  }
  return null;
};

/**
 * Deletes a specific UserTopicPerformance record.
 */
export const deleteUserTopicPerformance = async (userTopicPerformanceId: string): Promise<void> => {
  const docRef = db.collection(USER_TOPIC_PERFORMANCE_COLLECTION).doc(userTopicPerformanceId);
  try {
    await docRef.delete();
    console.log(`UserTopicPerformance (ID: ${userTopicPerformanceId}) deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting UserTopicPerformance (ID: ${userTopicPerformanceId}):`, error);
    throw error;
  }
};

// Helper functions to calculate accuracy and average time, can be used by frontend or other services
export const calculateTopicAccuracy = (performance: FirebaseUserTopicPerformance): number => {
  const totalQuestions = performance.totalQuestionsAnswered || 0;
  if (totalQuestions === 0) {
    return 0;
  }
  return parseFloat(((performance.correctAnswers / totalQuestions) * 100).toFixed(2));
};

export const calculateAverageTimePerQuestionInTopic = (performance: FirebaseUserTopicPerformance): number => {
  const totalQuestions = performance.totalQuestionsAnswered || 0;
  const totalTime = performance.totalTimeSpentSeconds || 0;
  if (totalQuestions === 0) {
    return 0;
  }
  return parseFloat((totalTime / totalQuestions).toFixed(2));
};

