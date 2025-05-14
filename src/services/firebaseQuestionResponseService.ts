import { firestore } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { QuestionResponse, FirebaseProgrammedReview, FirebaseProgrammedReviewContentType, FirebaseProgrammedReviewStatus, ReviewQuality } from "../types/firebaseTypes";
import { createProgrammedReview, updateProgrammedReview, getProgrammedReviewByContentId, deleteProgrammedReviewByContentId } from "./firebaseProgrammedReviewService"; // Assuming this function exists

// Interface para o payload de criação de QuestionResponse
interface CreateQuestionResponsePayload {
  userId: string;
  questionId: string;
  questionListId?: string;
  selectedOptionId?: string;
  selectedAlternativeId?: string | null;
  isCorrectOnFirstAttempt: boolean;
  reviewQuality?: ReviewQuality;
  responseTimeSeconds?: number;
}

const QUESTION_RESPONSES_COLLECTION = "questionResponses";

const calculateSrsParameters = (quality: ReviewQuality, oldEaseFactor: number, oldInterval: number, oldRepetitions: number) => {
  let newEaseFactor = oldEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;
  let newRepetitions;
  let newInterval;
  if (quality >= 3) {
    newRepetitions = oldRepetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(oldInterval * newEaseFactor);
    }
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }
  if (newInterval < 1) newInterval = 1;
  return { newEaseFactor, newInterval, newRepetitions };
};

const createQuestionResponseInternal = async (
  payload: CreateQuestionResponsePayload
): Promise<string> => {
  const docRef = firestore.collection(QUESTION_RESPONSES_COLLECTION).doc();
  const now = Timestamp.now();
  const initialSrs = {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    failStreak: 0,
    isLearning: true,
    isLeech: false,
    lastReviewQuality: payload.reviewQuality !== undefined ? payload.reviewQuality : 0, // Default to 0 if undefined
    lastReviewedAt: now,
    nextReviewDate: now,
  };
    if (payload.isCorrectOnFirstAttempt) {
    initialSrs.failStreak = 0;
    // Calculate nextReviewDate based on this first interval
    const qualityForCalc = payload.reviewQuality !== undefined && payload.reviewQuality >= 3 ? payload.reviewQuality : 5 as ReviewQuality;
    // For the very first correct response, the next review is typically fixed (e.g., 1 day), and repetitions becomes 1.
    initialSrs.repetitions = 1;
    initialSrs.interval = 1; // Default first interval for a correct answer
    const srsResult = calculateSrsParameters(qualityForCalc as ReviewQuality, 2.5, initialSrs.interval, initialSrs.repetitions);
    initialSrs.easeFactor = srsResult.newEaseFactor;
    // initialSrs.interval = srsResult.newInterval; // This would be for the *next* interval, not the one just completed.
    // initialSrs.repetitions = srsResult.newRepetitions;

    const nextReviewMillis = now.toMillis() + (initialSrs.interval * 24 * 60 * 60 * 1000);
    initialSrs.nextReviewDate = Timestamp.fromMillis(nextReviewMillis);
    initialSrs.isLearning = true; // Starts in learning phase

    // Ensure lastReviewQuality is set if isCorrectOnFirstAttempt
    if (payload.reviewQuality === undefined) {
        initialSrs.lastReviewQuality = 5 as ReviewQuality; // Default to a high quality for a correct first attempt if not provided
    }
  } else { // Incorrect on first attempt
    initialSrs.failStreak = 1;
    initialSrs.repetitions = 0;
    initialSrs.interval = 1; // Reset interval to 1 day for incorrect answers for next attempt
    initialSrs.isLearning = true; // Still in learning phase
    const nextReviewMillis = now.toMillis() + (1 * 24 * 60 * 60 * 1000); // Next review in 1 day
    initialSrs.nextReviewDate = Timestamp.fromMillis(nextReviewMillis);
    if (payload.reviewQuality === undefined) {
        initialSrs.lastReviewQuality = 1 as ReviewQuality; // Default to a low quality for an incorrect first attempt
    }
  } // Close the else block

  const newQuestionResponse: QuestionResponse = {
    id: docRef.id,
    ...payload,
    ...initialSrs,
    answeredAt: now, // Ensure answeredAt is set
    createdAt: now,
    updatedAt: now,
    programmedReviewId: null,
    responseTimeSeconds: payload.responseTimeSeconds ?? 0, // Adicionar valor padrão para evitar undefined
    selectedOptionId: payload.selectedOptionId ?? null, // Usar null em vez de undefined para evitar erro do Firestore
    selectedAlternativeId: payload.selectedAlternativeId ?? null // Garantir que selectedAlternativeId também seja tratado
  };
  await docRef.set(newQuestionResponse);
  try {
    const programmedReviewData: Omit<FirebaseProgrammedReview, "id" | "createdAt" | "updatedAt"> = {
      userId: newQuestionResponse.userId,
      contentId: newQuestionResponse.id,
      contentType: FirebaseProgrammedReviewContentType.QUESTION,
      originalAnswerCorrect: newQuestionResponse.isCorrectOnFirstAttempt,
      lastReviewedAt: newQuestionResponse.lastReviewedAt ?? null,
      nextReviewAt: newQuestionResponse.nextReviewDate!,
      intervalDays: newQuestionResponse.interval!,
      easeFactor: newQuestionResponse.easeFactor!,
      repetitions: newQuestionResponse.repetitions!,
      lapses: newQuestionResponse.failStreak!,
      status: FirebaseProgrammedReviewStatus.LEARNING,
    };
    const createdProgrammedReview = await createProgrammedReview(programmedReviewData);
    await docRef.update({ programmedReviewId: createdProgrammedReview.id, updatedAt: Timestamp.now() });
    newQuestionResponse.programmedReviewId = createdProgrammedReview.id;
    newQuestionResponse.updatedAt = Timestamp.now();
  } catch (error) {
    console.error("Error creating associated ProgrammedReview for QuestionResponse:", error);
  }
  return newQuestionResponse.id;
};

const getQuestionResponseByIdInternal = async (id: string): Promise<QuestionResponse | null> => {
  const docRef = firestore.collection(QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as QuestionResponse) : null;
};

const updateQuestionResponseInternal = async (
  id: string,
  updateData: Partial<Omit<QuestionResponse, "id" | "createdAt">>
): Promise<boolean> => {
  const docRef = firestore.collection(QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    console.warn(`QuestionResponse with ID "${id}" not found for update.`);
    return false; // Return false if document does not exist
  }
  const dataToUpdateWithTimestamp = { ...updateData, updatedAt: Timestamp.now() };
  await docRef.update(dataToUpdateWithTimestamp);
  // const updatedDoc = await docRef.get(); // No need to get the doc again if we just return true
  return true; // Return true if update is successful
};

const deleteQuestionResponseInternal = async (id: string): Promise<boolean> => {
  const docRef = firestore.collection(QUESTION_RESPONSES_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    console.warn(`QuestionResponse with ID "${id}" not found for deletion.`);
    return false;
  }
  const questionResponse = docSnap.data() as QuestionResponse;
  if (questionResponse.programmedReviewId) {
      try {
          await deleteProgrammedReviewByContentId(questionResponse.id, FirebaseProgrammedReviewContentType.QUESTION, questionResponse.userId);
      } catch (error) {
          console.error(`Failed to delete associated ProgrammedReview ${questionResponse.programmedReviewId}:`, error);
      }
  }
  await docRef.delete();
  return true;
};

const recordQuestionReviewInternal = async (
  questionResponseId: string,
  quality: ReviewQuality,
  userId: string
): Promise<QuestionResponse | boolean> => { // Changed return type
  const qrRef = firestore.collection(QUESTION_RESPONSES_COLLECTION).doc(questionResponseId);
  const qrSnap = await qrRef.get();
  if (!qrSnap.exists) {
    console.warn(`QuestionResponse with ID "${questionResponseId}" not found for review.`);
    return false; // Return false if document does not exist
  }
  const questionResponse = qrSnap.data() as QuestionResponse;
  if (questionResponse.userId !== userId) {
      console.error(`User mismatch: Attempt to review QuestionResponse ${questionResponseId} by user ${userId}, but it belongs to ${questionResponse.userId}`);
      return false; // Return false on user mismatch
  }
  if (!questionResponse.programmedReviewId) {
      console.error(`ProgrammedReviewId missing for QuestionResponse ${questionResponseId}. Cannot record review.`);
      return false; // Return false if programmedReviewId is missing
  }
  try {
    const updatedProgrammedReview = await updateProgrammedReview(questionResponse.programmedReviewId, quality);
    if (!updatedProgrammedReview) {
        console.error(`Failed to update ProgrammedReview ${questionResponse.programmedReviewId}.`);
        return false; // Return false if programmed review update failed
    }
    const srsUpdates: Partial<QuestionResponse> = {
      easeFactor: updatedProgrammedReview.easeFactor,
      interval: updatedProgrammedReview.intervalDays,
      repetitions: updatedProgrammedReview.repetitions,
      failStreak: updatedProgrammedReview.lapses,
      isLearning: updatedProgrammedReview.status === FirebaseProgrammedReviewStatus.LEARNING || updatedProgrammedReview.status === FirebaseProgrammedReviewStatus.REVIEWING,
      isLeech: (updatedProgrammedReview.lapses || 0) >= 4, // Assuming leech threshold is 4 lapses
      lastReviewQuality: quality,
      lastReviewedAt: updatedProgrammedReview.lastReviewedAt,
      nextReviewDate: updatedProgrammedReview.nextReviewAt,
      updatedAt: Timestamp.now(),
    };
    await qrRef.update(srsUpdates);
    const updatedQrSnap = await qrRef.get();
    return updatedQrSnap.data() as QuestionResponse;
  } catch (error) {
    console.error(`Error recording review for QuestionResponse ${questionResponseId}:`, error);
    return false; // Return false on other errors
  }
};

const getQuestionResponsesByUserIdInternal = async (userId: string): Promise<QuestionResponse[]> => {
  const responses: QuestionResponse[] = [];
  const querySnapshot = await firestore.collection(QUESTION_RESPONSES_COLLECTION)
                              .where("userId", "==", userId)
                              .orderBy("answeredAt", "desc")
                              .get();
  querySnapshot.forEach((doc) => {
    responses.push(doc.data() as QuestionResponse);
  });
  return responses;
};

const getQuestionResponsesByQuestionIdInternal = async (questionId: string): Promise<QuestionResponse[]> => {
  const responses: QuestionResponse[] = [];
  const querySnapshot = await firestore.collection(QUESTION_RESPONSES_COLLECTION)
                              .where("questionId", "==", questionId)
                              .orderBy("answeredAt", "desc")
                              .get();
  querySnapshot.forEach((doc) => {
    responses.push(doc.data() as QuestionResponse);
  });
  return responses;
};

export const firebaseQuestionResponseService = {
    createQuestionResponse: createQuestionResponseInternal,
    getQuestionResponseById: getQuestionResponseByIdInternal,
    updateQuestionResponse: updateQuestionResponseInternal,
    deleteQuestionResponse: deleteQuestionResponseInternal,
    recordQuestionReview: recordQuestionReviewInternal,
    getQuestionResponsesByUserId: getQuestionResponsesByUserIdInternal,
    getQuestionResponsesByQuestionId: getQuestionResponsesByQuestionIdInternal
};

