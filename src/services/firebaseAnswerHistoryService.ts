import { db } from "../firebase_config/firebaseAdmin";
import { 
    FirebaseAnswerHistory,
    FirebaseAnswerHistorySource
} from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { AppError } from "../utils/errors";

const ANSWER_HISTORY_COLLECTION = "answerHistories";

/**
 * Creates a new answer history record.
 * @param userId - The ID of the user who answered.
 * @param questionId - The ID of the question that was answered.
 * @param isCorrect - Whether the answer was correct.
 * @param source - The source of the answer (web, mobile, simulation, etc.).
 * @param options - Optional details like selectedOptionId, timeTaken, simulationId, listId, studySessionId.
 * @returns The created FirebaseAnswerHistory object.
 */
const createAnswerHistory = async (
    userId: string,
    questionId: string,
    isCorrect: boolean,
    source: FirebaseAnswerHistorySource,
    options?: {
        selectedOptionId?: string | null;
        timeTaken?: number | null; // in milliseconds
        simulationId?: string | null;
        listId?: string | null;
        studySessionId?: string | null;
    }
): Promise<FirebaseAnswerHistory> => {
    if (!userId || !questionId || isCorrect === undefined || !source) {
        throw new AppError("User ID, Question ID, isCorrect status, and Source are required.", 400);
    }
    if (!Object.values(FirebaseAnswerHistorySource).includes(source)) {
        throw new AppError("Invalid answer history source provided.", 400);
    }

    const newHistoryRef = db.collection(ANSWER_HISTORY_COLLECTION).doc();
    const now = Timestamp.now();

    const newHistoryData: FirebaseAnswerHistory = {
        id: newHistoryRef.id,
        userId,
        questionId,
        selectedOptionId: options?.selectedOptionId !== undefined ? options.selectedOptionId : null,
        isCorrect,
        answeredAt: now, // Default to now, can be overridden if historical import
        timeTaken: options?.timeTaken !== undefined ? options.timeTaken : null,
        source,
        simulationId: options?.simulationId !== undefined ? options.simulationId : null,
        listId: options?.listId !== undefined ? options.listId : null,
        studySessionId: options?.studySessionId !== undefined ? options.studySessionId : null,
        createdAt: now,
        updatedAt: now,
    };

    await newHistoryRef.set(newHistoryData);
    return newHistoryData;
};

/**
 * Retrieves an answer history record by its ID.
 * @param historyId - The ID of the answer history record.
 * @returns The FirebaseAnswerHistory object or null if not found.
 */
const getAnswerHistoryById = async (historyId: string): Promise<FirebaseAnswerHistory | null> => {
    if (!historyId) {
        throw new AppError("History ID is required.", 400);
    }
    const historyDoc = await db.collection(ANSWER_HISTORY_COLLECTION).doc(historyId).get();
    if (!historyDoc.exists) {
        return null;
    }
    return { id: historyDoc.id, ...historyDoc.data() } as FirebaseAnswerHistory;
};

/**
 * Retrieves all answer history records for a specific user.
 * Can be filtered by questionId, source, simulationId, listId, studySessionId.
 * Ordered by answeredAt (desc by default).
 * @param userId - The ID of the user.
 * @param options - Optional filters and pagination.
 * @returns An array of FirebaseAnswerHistory objects.
 */
const getUserAnswerHistories = async (
    userId: string,
    options?: {
        questionId?: string;
        source?: FirebaseAnswerHistorySource;
        simulationId?: string;
        listId?: string;
        studySessionId?: string;
        limit?: number;
        startAfter?: FirebaseAnswerHistory; // For pagination based on answeredAt
    }
): Promise<FirebaseAnswerHistory[]> => {
    if (!userId) {
        throw new AppError("User ID is required.", 400);
    }

    let query = db.collection(ANSWER_HISTORY_COLLECTION).where("userId", "==", userId);

    if (options?.questionId) {
        query = query.where("questionId", "==", options.questionId);
    }
    if (options?.source) {
        query = query.where("source", "==", options.source);
    }
    if (options?.simulationId) {
        query = query.where("simulationId", "==", options.simulationId);
    }
    if (options?.listId) {
        query = query.where("listId", "==", options.listId);
    }
    if (options?.studySessionId) {
        query = query.where("studySessionId", "==", options.studySessionId);
    }

    query = query.orderBy("answeredAt", "desc");

    if (options?.startAfter?.answeredAt) {
        query = query.startAfter(options.startAfter.answeredAt);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAnswerHistory));
};

/**
 * Deletes an answer history record.
 * @param historyId - The ID of the answer history record to delete.
 */
const deleteAnswerHistory = async (historyId: string): Promise<void> => {
    if (!historyId) {
        throw new AppError("History ID is required.", 400);
    }
    const historyRef = db.collection(ANSWER_HISTORY_COLLECTION).doc(historyId);
    const historyDoc = await historyRef.get();

    if (!historyDoc.exists) {
        throw new AppError(`Answer history with ID ${historyId} not found for deletion.`, 404);
    }

    await historyRef.delete();
};

// Note: Update operations for AnswerHistory are generally not provided as history records are typically immutable.
// If updates are needed (e.g., correcting an import error), specific functions for those scenarios should be added.

export default {
    createAnswerHistory,
    getAnswerHistoryById,
    getUserAnswerHistories,
    deleteAnswerHistory,
};
