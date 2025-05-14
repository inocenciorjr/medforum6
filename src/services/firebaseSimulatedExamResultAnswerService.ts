import { db } from "../firebase_config/firebaseAdmin";
import { 
    FirebaseSimulatedExamResultAnswer
} from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { AppError } from "../utils/errors";

const SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION = "simulatedExamResultAnswers";

/**
 * Records or updates an answer for a question within a simulated exam result.
 * If an answer for this question in this result already exists, it will be updated.
 * Otherwise, a new answer record will be created.
 *
 * @param resultId - The ID of the SimulatedExamResult.
 * @param questionId - The ID of the Question.
 * @param isCorrect - Whether the answer was correct.
 * @param isSkipped - Whether the question was skipped.
 * @param timeSpent - Time spent on the answer in seconds.
 * @param options - Optional details like selectedOptionId or answerText.
 * @returns The created or updated FirebaseSimulatedExamResultAnswer object.
 */
const recordOrUpdateSimulatedExamAnswer = async (
    simulatedExamResultId: string,
    questionId: string,
    isCorrect: boolean,
    isSkipped: boolean,
    timeSpent: number,
    options?: {
        selectedOptionId?: string | null;
        answerText?: string | null;
    }
): Promise<FirebaseSimulatedExamResultAnswer> => {
    if (!simulatedExamResultId || !questionId || isCorrect === undefined || isSkipped === undefined || timeSpent === undefined) {
        throw new AppError(
            "SimulatedExamResult ID, Question ID, isCorrect, isSkipped, and timeSpent are required.",
            400
        );
    }
    if (timeSpent < 0) {
        throw new AppError("Time spent cannot be negative.", 400);
    }

    const querySnapshot = await db.collection(SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION)
        .where("simulatedExamResultId", "==", simulatedExamResultId)
        .where("questionId", "==", questionId)
        .limit(1)
        .get();

    const now = Timestamp.now();
    const answerData: Partial<FirebaseSimulatedExamResultAnswer> = {
        simulatedExamResultId,
        questionId,
        selectedOptionId: options?.selectedOptionId !== undefined ? options.selectedOptionId : null,
        answerText: options?.answerText !== undefined ? options.answerText : null,
        isCorrect,
        isSkipped,
        timeSpent: Math.max(0, timeSpent), // Ensure non-negative
        updatedAt: now,
    };

    if (!querySnapshot.empty) {
        // Update existing answer
        const docRef = querySnapshot.docs[0].ref;
        await docRef.update(answerData); // Removed incorrect cast
        const updatedDoc = await docRef.get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as FirebaseSimulatedExamResultAnswer;
    } else {
        // Create new answer
        const newDocRef = db.collection(SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION).doc();
        const newAnswerData: FirebaseSimulatedExamResultAnswer = {
            id: newDocRef.id,
            ...answerData, // Spread the prepared answer data
            createdAt: now, // Set createdAt only for new documents
        } as FirebaseSimulatedExamResultAnswer; // Cast needed as answerData is partial initially
        
        await newDocRef.set(newAnswerData);
        return newAnswerData;
    }
};

/**
 * Retrieves a specific simulated exam result answer by its ID.
 * @param answerId - The ID of the answer record.
 * @returns The FirebaseSimulatedExamResultAnswer object or null if not found.
 */
const getSimulatedExamResultAnswerById = async (answerId: string): Promise<FirebaseSimulatedExamResultAnswer | null> => {
    if (!answerId) {
        throw new AppError("Answer ID is required.", 400);
    }
    const doc = await db.collection(SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION).doc(answerId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() } as FirebaseSimulatedExamResultAnswer;
};

/**
 * Retrieves all answers for a specific simulated exam result.
 * @param simulatedExamResultId - The ID of the SimulatedExamResult.
 * @param options - Optional pagination (orderBy question order if available, or createdAt).
 * @returns An array of FirebaseSimulatedExamResultAnswer objects.
 */
const getAnswersBySimulatedExamResultId = async (
    simulatedExamResultId: string,
    options?: {
        limit?: number;
        startAfter?: FirebaseSimulatedExamResultAnswer; // For pagination, typically by question order or createdAt
        // Add orderBy if questions have an order within the exam result
    }
): Promise<FirebaseSimulatedExamResultAnswer[]> => {
    if (!simulatedExamResultId) {
        throw new AppError("SimulatedExamResult ID is required.", 400);
    }

    let query = db.collection(SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION)
                  .where("simulatedExamResultId", "==", simulatedExamResultId)
                  .orderBy("createdAt", "asc"); // Default order, can be changed if question order is stored

    if (options?.startAfter?.createdAt) { // Assuming pagination by createdAt
        query = query.startAfter(options.startAfter.createdAt);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseSimulatedExamResultAnswer));
};

/**
 * Deletes a specific simulated exam result answer.
 * Usually not done, as results are historical. Could be for admin correction.
 * @param answerId - The ID of the answer record to delete.
 */
const deleteSimulatedExamResultAnswer = async (answerId: string): Promise<void> => {
    if (!answerId) {
        throw new AppError("Answer ID is required.", 400);
    }
    const docRef = db.collection(SIMULATED_EXAM_RESULT_ANSWERS_COLLECTION).doc(answerId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new AppError(`Simulated exam answer with ID ${answerId} not found for deletion.`, 404);
    }

    await docRef.delete();
};

export default {
    recordOrUpdateSimulatedExamAnswer,
    getSimulatedExamResultAnswerById,
    getAnswersBySimulatedExamResultId,
    deleteSimulatedExamResultAnswer,
};
