import { Firestore, Timestamp } from "firebase-admin/firestore";
import {
  FirebaseSimulatedExamResult,
  FirebaseSimulatedExamAnswer,
  FirebaseUserProfile,
  FirebaseSimulatedExam,
  ReviewQuality,
  FirebaseQuestionResponseCreatePayload,
  FirebaseSimulatedExamResultStatus
} from "../types/firebaseTypes";
import { firebaseQuestionResponseService } from "./firebaseQuestionResponseService";
import { firestore } from "../config/firebaseAdmin";

let db: Firestore;
export const initSimulatedExamResultService = (firestoreInstance: Firestore) => {
  db = firestoreInstance;
};

const RESULTS_COLLECTION = "simulatedExamResults";

export const startSimulatedExamAttempt = async (
  userId: string,
  examId: string,
  totalQuestions: number
): Promise<FirebaseSimulatedExamResult> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!userId) throw new Error("O ID do usuário é obrigatório.");
  if (!examId) throw new Error("O ID do simulado é obrigatório.");
  if (totalQuestions === undefined || totalQuestions < 0) throw new Error("O número total de questões é obrigatório e não pode ser negativo.");

  const resultsCollection = db.collection(RESULTS_COLLECTION);
  const existingInProgressQuery = await resultsCollection
    .where("userId", "==", userId)
    .where("simulatedExamId", "==", examId)
    .where("status", "==", FirebaseSimulatedExamResultStatus.IN_PROGRESS)
    .limit(1)
    .get();

  if (!existingInProgressQuery.empty) {
    const existingResult = existingInProgressQuery.docs[0].data() as FirebaseSimulatedExamResult;
    if (existingResult.totalQuestions !== totalQuestions) {
      await resultsCollection.doc(existingResult.id).update({
        totalQuestions: totalQuestions,
        updatedAt: Timestamp.now(),
      });
      existingResult.totalQuestions = totalQuestions;
      existingResult.updatedAt = Timestamp.now();
    }
    console.log(`Retornando tentativa em progresso existente: ${existingResult.id}`);
    return existingResult;
  }

  let userName: string | null = null;
  let simulatedExamTitle: string | null = null;

  try {
    const userDoc = await db.collection("userProfiles").doc(userId).get();
    if (userDoc.exists) {
      userName = (userDoc.data() as FirebaseUserProfile).name || null;
    }
    const examDoc = await db.collection("simulatedExams").doc(examId).get();
    if (examDoc.exists) {
      simulatedExamTitle = (examDoc.data() as FirebaseSimulatedExam).title || null;
    }
  } catch (denormError) {
    console.warn("Erro ao buscar dados para denormalização em startSimulatedExamAttempt:", denormError);
  }

  const newResultRef = resultsCollection.doc();
  const now = Timestamp.now();

  const newSimulatedExamResult: FirebaseSimulatedExamResult = {
    id: newResultRef.id,
    userId,
    simulatedExamId: examId,
    userName,
    simulatedExamTitle,
    startedAt: now,
    completedAt: null,
    timeTakenSeconds: 0,
    score: null,
    totalQuestions,
    correctCount: 0,
    incorrectCount: 0,
    status: FirebaseSimulatedExamResultStatus.IN_PROGRESS,
    answers: [],
    createdAt: now,
    updatedAt: now,
  };

  await newResultRef.set(newSimulatedExamResult);
  console.log(`Nova tentativa de simulado iniciada: ${newSimulatedExamResult.id}`);
  return newSimulatedExamResult;
};

export const getSimulatedExamResultById = async (resultId: string): Promise<FirebaseSimulatedExamResult | null> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!resultId) throw new Error("O ID do resultado é obrigatório.");

  const doc = await db.collection(RESULTS_COLLECTION).doc(resultId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as FirebaseSimulatedExamResult;
};

export const updateSimulatedExamAttempt = async (
  resultId: string,
  updates: Partial<FirebaseSimulatedExamResult> & { newAnswer?: FirebaseSimulatedExamAnswer }
): Promise<FirebaseSimulatedExamResult> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!resultId) throw new Error("O ID do resultado é obrigatório.");

  const resultRef = db.collection(RESULTS_COLLECTION).doc(resultId);
  const resultDoc = await resultRef.get();

  if (!resultDoc.exists) {
    throw new Error(`Resultado de simulado com ID "${resultId}" não encontrado.`);
  }

  const currentResult = resultDoc.data() as FirebaseSimulatedExamResult;
  if (currentResult.status === FirebaseSimulatedExamResultStatus.COMPLETED || currentResult.status === FirebaseSimulatedExamResultStatus.ABANDONED) {
    if (updates.newAnswer || updates.answers) {
      throw new Error("Não é possível adicionar ou modificar respostas em um simulado já concluído ou abandonado.");
    }
  }

  const updateData: Partial<FirebaseSimulatedExamResult> & {answers?: FirebaseSimulatedExamAnswer[]} = { ...updates };
  delete (updateData as any).newAnswer; 
  updateData.updatedAt = Timestamp.now();

  if (updates.newAnswer) {
    const currentAnswers = currentResult.answers ? [...currentResult.answers] : [];
    const existingAnswerIndex = currentAnswers.findIndex(a => a.questionId === updates.newAnswer!.questionId);
    if (existingAnswerIndex > -1) {
      currentAnswers[existingAnswerIndex] = updates.newAnswer;
    } else {
      currentAnswers.push(updates.newAnswer);
    }
    updateData.answers = currentAnswers;
  }

  await resultRef.update(updateData);
  const updatedDoc = await resultRef.get();
  return updatedDoc.data() as FirebaseSimulatedExamResult;
};

export const completeSimulatedExamAttempt = async (
  resultId: string,
  finalAnswers?: FirebaseSimulatedExamAnswer[]
): Promise<FirebaseSimulatedExamResult> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!resultId) throw new Error("O ID do resultado é obrigatório.");

  const resultRef = db.collection(RESULTS_COLLECTION).doc(resultId);
  const resultDoc = await resultRef.get();

  if (!resultDoc.exists) {
    throw new Error(`Resultado de simulado com ID "${resultId}" não encontrado.`);
  }

  const currentResult = resultDoc.data() as FirebaseSimulatedExamResult;
  if (currentResult.status !== FirebaseSimulatedExamResultStatus.IN_PROGRESS) {
    throw new Error("Apenas tentativas de simulado em progresso podem ser concluídas.");
  }
  if (!currentResult.startedAt) {
    throw new Error("A tentativa de simulado não possui uma data de início (startedAt).");
  }

  const now = Timestamp.now();
  const answersToProcess = finalAnswers || currentResult.answers || [];

  let correctCount = 0;
  let incorrectCount = 0;

  answersToProcess.forEach(answer => {
    if (answer.selectedAlternativeId === null || answer.selectedAlternativeId === undefined) {
      // Não contabiliza como errada se não foi respondida (pulada)
    } else if (answer.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });
  
  const timeTakenSeconds = Math.round((now.toMillis() - currentResult.startedAt.toMillis()) / 1000);
  const score = (currentResult.totalQuestions || 0) > 0 ? Math.round((correctCount / (currentResult.totalQuestions || 1)) * 10000) / 100 : 0;

  const updateData: Partial<FirebaseSimulatedExamResult> = {
    completedAt: now,
    timeTakenSeconds,
    score,
    correctCount,
    incorrectCount,
    status: FirebaseSimulatedExamResultStatus.COMPLETED,
    answers: answersToProcess,
    updatedAt: now,
  };

  await resultRef.update(updateData);

  for (const answer of answersToProcess) {
    if (answer.selectedAlternativeId === null || answer.selectedAlternativeId === undefined) {
      continue;
    }

    const userId = currentResult.userId;
    const questionId = answer.questionId;
    const isCorrect = answer.isCorrect;
    const selectedAlternativeId = answer.selectedAlternativeId;
    // Definir qualityValue diretamente como um literal numérico do tipo ReviewQuality
    const qualityValue: ReviewQuality = isCorrect ? 4 : 1; 

    try {
      const qrSnapshot = await firestore.collection("questionResponses")
        .where("userId", "==", userId)
        .where("questionId", "==", questionId)
        .limit(1)
        .get();

      let questionResponseId: string | null = null;

      if (!qrSnapshot.empty) {
        questionResponseId = qrSnapshot.docs[0].id;
        if (questionResponseId) {
          console.log("DEBUG: qualityValue type:", typeof qualityValue, "value:", qualityValue);
          await firebaseQuestionResponseService.recordQuestionReview(questionResponseId, qualityValue as ReviewQuality, userId);
        }
      } else {
        const createPayload: FirebaseQuestionResponseCreatePayload = {
          userId,
          questionId,
          questionListId: "simulated_exam", // Usar um identificador mais específico
          selectedAlternativeId: selectedAlternativeId!,
          isCorrectOnFirstAttempt: isCorrect,
          responseTimeSeconds: answer.responseTimeSeconds,
          reviewQuality: qualityValue 
        };
        questionResponseId = await firebaseQuestionResponseService.createQuestionResponse(createPayload);
      }
    } catch (srsError) {
      console.error(`Erro ao processar SRS para questão ${questionId} do simulado ${currentResult.simulatedExamId}:`, srsError);
    }
  }
  const finalResultDoc = await resultRef.get();
  return finalResultDoc.data() as FirebaseSimulatedExamResult;
};

export const abandonSimulatedExamAttempt = async (resultId: string): Promise<FirebaseSimulatedExamResult> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!resultId) throw new Error("O ID do resultado é obrigatório.");

  const resultRef = db.collection(RESULTS_COLLECTION).doc(resultId);
  const resultDoc = await resultRef.get();

  if (!resultDoc.exists) {
    throw new Error(`Resultado de simulado com ID "${resultId}" não encontrado.`);
  }

  const currentResult = resultDoc.data() as FirebaseSimulatedExamResult;
  if (currentResult.status === FirebaseSimulatedExamResultStatus.COMPLETED || currentResult.status === FirebaseSimulatedExamResultStatus.ABANDONED) {
    throw new Error("Tentativas de simulado concluídas ou já abandonadas não podem ser abandonadas novamente.");
  }
  if (!currentResult.startedAt) {
    throw new Error("A tentativa de simulado não possui uma data de início (startedAt) para calcular o tempo gasto.");
  }

  const now = Timestamp.now();
  const timeTakenSeconds = Math.round((now.toMillis() - currentResult.startedAt.toMillis()) / 1000);
  
  const currentAnswers = currentResult.answers || [];
  const answeredCount = currentAnswers.filter(a => a.selectedAlternativeId !== null && a.selectedAlternativeId !== undefined).length;
  const correctCount = currentAnswers.filter(a => a.isCorrect).length;
  const incorrectCount = answeredCount - correctCount;

  const updateData: Partial<FirebaseSimulatedExamResult> = {
    completedAt: now,
    timeTakenSeconds,
    status: FirebaseSimulatedExamResultStatus.ABANDONED,
    correctCount,
    incorrectCount,
    updatedAt: now,
  };

  await resultRef.update(updateData);
  const finalResultDoc = await resultRef.get();
  return finalResultDoc.data() as FirebaseSimulatedExamResult;
};

export const getSimulatedExamResultsByUserId = async (
  userId: string,
  limitNum: number = 10, 
  lastDocId?: string
): Promise<{ results: FirebaseSimulatedExamResult[], nextPageToken: string | null }> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!userId) throw new Error("O ID do usuário é obrigatório.");

  let query = db.collection(RESULTS_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("startedAt", "desc")
    .limit(limitNum);

  if (lastDocId) {
    const lastSnapshot = await db.collection(RESULTS_COLLECTION).doc(lastDocId).get();
    if (lastSnapshot.exists) {
      query = query.startAfter(lastSnapshot);
    }
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    return { results: [], nextPageToken: null };
  }

  const results = snapshot.docs.map(doc => doc.data() as FirebaseSimulatedExamResult);
  const nextPageToken = snapshot.docs.length === limitNum ? snapshot.docs[snapshot.docs.length - 1].id : null;

  return { results, nextPageToken };
};

export const getResultsForSimulatedExam = async (
  examId: string,
  limitNum: number = 10, 
  lastDocId?: string
): Promise<{ results: FirebaseSimulatedExamResult[], nextPageToken: string | null }> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!examId) throw new Error("O ID do simulado é obrigatório.");

  let query = db.collection(RESULTS_COLLECTION)
    .where("simulatedExamId", "==", examId)
    .orderBy("score", "desc")
    .orderBy("startedAt", "desc")
    .limit(limitNum);

  if (lastDocId) {
    const lastSnapshot = await db.collection(RESULTS_COLLECTION).doc(lastDocId).get();
    if (lastSnapshot.exists) {
      query = query.startAfter(lastSnapshot);
    }
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    return { results: [], nextPageToken: null };
  }
  const results = snapshot.docs.map(doc => doc.data() as FirebaseSimulatedExamResult);
  const nextPageToken = snapshot.docs.length === limitNum ? snapshot.docs[snapshot.docs.length - 1].id : null;

  return { results, nextPageToken };
};

export const deleteSimulatedExamResult = async (resultId: string): Promise<void> => {
  if (!db) throw new Error("SimulatedExamResultService não inicializado.");
  if (!resultId) throw new Error("O ID do resultado é obrigatório.");

  const resultRef = db.collection(RESULTS_COLLECTION).doc(resultId);
  const doc = await resultRef.get();
  if (!doc.exists) {
    throw new Error(`Resultado de simulado com ID "${resultId}" não encontrado para exclusão.`);
  }
  await resultRef.delete();
  console.log(`Resultado de simulado ${resultId} deletado com sucesso.`);
};

