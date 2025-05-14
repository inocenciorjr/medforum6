import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  FirebaseSimulatedExam,
  FirebaseSimulatedExamStatus,
  FirebaseUserProfile,
  FirebaseSimulatedExamDifficultyLevel,
  FirebaseSimulatedExamQuestion,
  FirebaseSimulatedExamResult,
  FirebaseSimulatedExamResultStatus
} from "../types/firebaseTypes";
import { AppError } from "../utils/errors";
import { firestore as db } from "../config/firebaseAdmin";
import { getQuestionById } from "./firebaseQuestionService"; // Para validar a existência da questão

const SIMULATED_EXAMS_COLLECTION = "simulatedExams";
const SIMULATED_EXAM_QUESTIONS_COLLECTION = "simulatedExamQuestions";
const SIMULATED_EXAM_RESULTS_COLLECTION = "simulatedExamResults";

// --- Funções CRUD para FirebaseSimulatedExam (já existentes e revisadas) ---

export const createSimulatedExam = async (examData: {
  userId: string;
  title: string;
  description?: string | null;
  questionCount?: number; 
  timeLimitMinutes: number;
  durationMinutes?: number;
  isPublic: boolean;
  status?: FirebaseSimulatedExamStatus;
  difficultyLevel?: FirebaseSimulatedExamDifficultyLevel; 
  scheduledAt?: Timestamp | null; 
  settings?: Record<string, any> | null;
  filterIds?: string[] | null;
  subFilterIds?: string[] | null;
  tags?: string[] | null;
  questionIds?: string[] | null; 
}): Promise<FirebaseSimulatedExam> => {
  if (!examData.userId) throw AppError.badRequest("O ID do usuário criador é obrigatório.");
  if (!examData.title || examData.title.trim() === "") {
    throw AppError.badRequest("O título do simulado é obrigatório.");
  }
  if (examData.timeLimitMinutes === undefined || examData.timeLimitMinutes <= 0) {
    throw AppError.badRequest("O tempo limite em minutos é obrigatório e deve ser maior que zero.");
  }

  const newExamRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc();
  const now = Timestamp.now();
  let creatorName: string | null = null;

  try {
    const userDoc = await db.collection("users").doc(examData.userId).get();
    if (userDoc.exists) {
      creatorName = (userDoc.data() as FirebaseUserProfile)?.name || (userDoc.data() as any)?.displayName || null;
    }
  } catch (error) {
    console.warn(`Não foi possível buscar nome do usuário ${examData.userId} para denormalização do simulado:`, error);
  }

  const newSimulatedExam: FirebaseSimulatedExam = {
    id: newExamRef.id,
    userId: examData.userId,
    creatorName: creatorName,
    title: examData.title,
    description: examData.description ?? null,
    questionCount: examData.questionIds ? examData.questionIds.length : (examData.questionCount || 0),
    timeLimitMinutes: examData.timeLimitMinutes,
    status: examData.status || FirebaseSimulatedExamStatus.DRAFT,
    difficultyLevel: examData.difficultyLevel || FirebaseSimulatedExamDifficultyLevel.MEDIUM, 
    scheduledAt: examData.scheduledAt !== undefined ? examData.scheduledAt : null,
    isPublic: typeof examData.isPublic === 'boolean' ? examData.isPublic : false,
    settings: examData.settings ?? null,
    filterIds: examData.filterIds || [],
    subFilterIds: examData.subFilterIds || [],
    questionIds: examData.questionIds || [],
    tags: examData.tags || [],
    totalAttempts: 0,
    averageScore: null,
    completedAttempts: 0, 
    createdAt: now,
    updatedAt: now,
    lastPublishedAt: null,
    durationMinutes: examData.durationMinutes || examData.timeLimitMinutes,
    createdBy: examData.userId,
    participantCount: 0,
  };

  await newExamRef.set(newSimulatedExam);
  return newSimulatedExam;
};

export const getSimulatedExamById = async (id: string): Promise<FirebaseSimulatedExam | null> => {
  const docRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc(id);
  const docSnap = await docRef.get();
  return docSnap.exists ? docSnap.data() as FirebaseSimulatedExam : null;
};

export const updateSimulatedExam = async (
  id: string,
  userId: string, 
  updateData: Partial<Omit<FirebaseSimulatedExam, "id" | "userId" | "creatorName" | "createdAt" | "updatedAt" | "totalAttempts" | "averageScore" | "completedAttempts" | "lastPublishedAt">> & { questionIds?: string[] }
): Promise<FirebaseSimulatedExam> => {
  const examRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc(id);
  const examDoc = await examRef.get();

  if (!examDoc.exists) {
    throw AppError.notFound(`Simulado com ID "${id}" não encontrado.`);
  }
  const currentData = examDoc.data() as FirebaseSimulatedExam;
  if (currentData.userId !== userId) {
    throw AppError.forbidden("Usuário não autorizado a editar este simulado.");
  }

  const dataToUpdate: Partial<FirebaseSimulatedExam> & { updatedAt: Timestamp } = {
    updatedAt: Timestamp.now(),
  };

  if (updateData.title !== undefined) dataToUpdate.title = updateData.title;
  if (updateData.description !== undefined) dataToUpdate.description = updateData.description;
  if (updateData.timeLimitMinutes !== undefined) dataToUpdate.timeLimitMinutes = updateData.timeLimitMinutes;
  if (updateData.durationMinutes !== undefined) dataToUpdate.durationMinutes = updateData.durationMinutes;
  if (updateData.isPublic !== undefined) dataToUpdate.isPublic = updateData.isPublic;
  if (updateData.difficultyLevel !== undefined) dataToUpdate.difficultyLevel = updateData.difficultyLevel;
  if (updateData.scheduledAt !== undefined) dataToUpdate.scheduledAt = updateData.scheduledAt;
  if (updateData.settings !== undefined) dataToUpdate.settings = updateData.settings;
  if (updateData.filterIds !== undefined) dataToUpdate.filterIds = updateData.filterIds;
  if (updateData.subFilterIds !== undefined) dataToUpdate.subFilterIds = updateData.subFilterIds;
  if (updateData.tags !== undefined) dataToUpdate.tags = updateData.tags;
  // Não permitimos atualizar o createdBy, pois é um campo imutável
  if (updateData.questionIds !== undefined) {
    dataToUpdate.questionIds = updateData.questionIds;
    dataToUpdate.questionCount = updateData.questionIds.length;
  }
  
  if (updateData.status) {
    if (updateData.status === FirebaseSimulatedExamStatus.PUBLISHED && currentData.status !== FirebaseSimulatedExamStatus.PUBLISHED) {
      dataToUpdate.lastPublishedAt = Timestamp.now();
    }
    dataToUpdate.status = updateData.status;
  }

  await examRef.update(dataToUpdate);
  const updatedDoc = await examRef.get();
  return updatedDoc.data() as FirebaseSimulatedExam;
};

export const deleteSimulatedExam = async (id: string, userId: string): Promise<void> => {
  const examRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc(id);
  const examDoc = await examRef.get();

  if (!examDoc.exists) {
    throw AppError.notFound(`Simulado com ID "${id}" não encontrado.`);
  }
  if (examDoc.data()?.userId !== userId) {
    throw AppError.forbidden("Usuário não autorizado a deletar este simulado.");
  }

  const batch = db.batch();
  const questionsQuery = db.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).where("simulatedExamId", "==", id);
  const questionsSnapshot = await questionsQuery.get();
  questionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

  const resultsQuery = db.collection(SIMULATED_EXAM_RESULTS_COLLECTION).where("simulatedExamId", "==", id);
  const resultsSnapshot = await resultsQuery.get();
  resultsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

  batch.delete(examRef);
  await batch.commit();
};

export const listSimulatedExams = async (options?: {
  limit?: number;
  startAfter?: string; 
  sortBy?: keyof FirebaseSimulatedExam | "createdAt" | "updatedAt" | "lastPublishedAt" | "title" | "questionCount";
  sortDirection?: "asc" | "desc";
  userId?: string; 
  status?: FirebaseSimulatedExamStatus;
  difficultyLevel?: FirebaseSimulatedExamDifficultyLevel;
  isPublic?: boolean;
  tags?: string[]; 
  filterIds?: string[]; 
  scheduledBefore?: Timestamp;
  scheduledAfter?: Timestamp;
}): Promise<{ exams: FirebaseSimulatedExam[]; nextPageStartAfter?: string }> => {
  let query: any = db.collection(SIMULATED_EXAMS_COLLECTION);

  if (options?.userId) query = query.where("userId", "==", options.userId);
  if (options?.status) query = query.where("status", "==", options.status);
  if (options?.difficultyLevel) query = query.where("difficultyLevel", "==", options.difficultyLevel);
  if (options?.isPublic !== undefined) query = query.where("isPublic", "==", options.isPublic);
  if (options?.tags && options.tags.length > 0) query = query.where("tags", "array-contains-any", options.tags.slice(0, 10)); 
  if (options?.filterIds && options.filterIds.length > 0) query = query.where("filterIds", "array-contains-any", options.filterIds.slice(0, 10));
  if (options?.scheduledBefore) query = query.where("scheduledAt", "<=", options.scheduledBefore);
  if (options?.scheduledAfter) query = query.where("scheduledAt", ">=", options.scheduledAfter);

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);
  
  if (sortBy !== "id" && sortBy !== "createdAt" && sortBy !== "updatedAt" && sortBy !== "lastPublishedAt") { 
      query = query.orderBy("createdAt", "desc"); 
  }

  if (options?.startAfter) {
    const startAfterDoc = await db.collection(SIMULATED_EXAMS_COLLECTION).doc(options.startAfter).get();
    if(startAfterDoc.exists) query = query.startAfter(startAfterDoc);
  }

  const limit = options?.limit || 20;
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const exams = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FirebaseSimulatedExam));
  
  let nextPageStartAfter: string | undefined = undefined;
  if (exams.length > limit) {
    const lastDoc = exams.pop(); 
    if (lastDoc) nextPageStartAfter = lastDoc.id; 
  }
  return { exams, nextPageStartAfter };
};

export const recordSimulatedExamAttempt = async (examId: string, isCompleted: boolean): Promise<void> => {
  const examRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc(examId);
  const updates: { totalAttempts: FieldValue; completedAttempts?: FieldValue; participantCount: FieldValue; updatedAt: Timestamp } = {
    totalAttempts: FieldValue.increment(1),
    participantCount: FieldValue.increment(1),
    updatedAt: Timestamp.now(),
  };
  if (isCompleted) {
    updates.completedAttempts = FieldValue.increment(1);
  }
  await examRef.update(updates);
};

export const updateAverageScore = async (examId: string, newScore: number): Promise<void> => {
  const examRef = db.collection(SIMULATED_EXAMS_COLLECTION).doc(examId);
  await db.runTransaction(async (transaction) => {
    const examDoc = await transaction.get(examRef);
    if (!examDoc.exists) throw AppError.notFound(`Simulado com ID "${examId}" não encontrado.`);
    const examData = examDoc.data() as FirebaseSimulatedExam;
    const currentCompletedAttempts = examData.completedAttempts || 0; 
    const currentAverageScore = examData.averageScore || 0;
    let newAverageScore: number;
    const effectiveCompletedAttempts = currentCompletedAttempts;
    if (effectiveCompletedAttempts === 0) newAverageScore = newScore;
    else if (effectiveCompletedAttempts === 1 && examData.totalAttempts === 1) newAverageScore = newScore;
    else newAverageScore = (currentAverageScore * (effectiveCompletedAttempts -1) + newScore) / effectiveCompletedAttempts;
    transaction.update(examRef, { 
        averageScore: parseFloat(newAverageScore.toFixed(2)), 
        updatedAt: Timestamp.now() 
    });
  });
};

// --- Funções para gerenciar FirebaseSimulatedExamQuestion ---

export const addQuestionToSimulatedExam = async (
  simulatedExamId: string,
  questionId: string,
  order: number,
  points?: number,
  questionType?: string
): Promise<FirebaseSimulatedExamQuestion> => {
  const examDoc = await getSimulatedExamById(simulatedExamId);
  if (!examDoc) throw AppError.notFound("Simulado não encontrado.");

  // Validar se a questão original existe (opcional, mas recomendado)
  const originalQuestion = await getQuestionById(questionId); // Supondo que getQuestionById exista
  if (!originalQuestion) throw AppError.notFound("Questão original não encontrada.");

  const newSimulatedQuestionRef = db.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).doc();
  const now = Timestamp.now();
  const newSimulatedQuestion: FirebaseSimulatedExamQuestion = {
    id: newSimulatedQuestionRef.id,
    simulatedExamId,
    questionId,
    examId: simulatedExamId, // Adicionado para compatibilidade
    order,
    points: points ?? 1, // Default points
    createdAt: now,
    updatedAt: now,
  };
  await newSimulatedQuestionRef.set(newSimulatedQuestion);
  // Atualizar contagem de questões no simulado principal
  await db.collection(SIMULATED_EXAMS_COLLECTION).doc(simulatedExamId).update({
    questionCount: FieldValue.increment(1),
    questionIds: FieldValue.arrayUnion(questionId), // Adiciona o ID da questão original ao array
    updatedAt: now
  });
  return newSimulatedQuestion;
};

export const removeQuestionFromSimulatedExam = async (simulatedExamQuestionId: string): Promise<void> => {
  const questionRef = db.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).doc(simulatedExamQuestionId);
  const questionDoc = await questionRef.get();
  if (!questionDoc.exists) throw AppError.notFound("Questão do simulado não encontrada.");
  
  const { simulatedExamId, questionId } = questionDoc.data() as FirebaseSimulatedExamQuestion;
  await questionRef.delete();
  
  // Atualizar contagem e array de IDs no simulado principal
  await db.collection(SIMULATED_EXAMS_COLLECTION).doc(simulatedExamId).update({
    questionCount: FieldValue.increment(-1),
    questionIds: FieldValue.arrayRemove(questionId),
    updatedAt: Timestamp.now()
  });
};

export const listQuestionsForSimulatedExam = async (simulatedExamId: string): Promise<FirebaseSimulatedExamQuestion[]> => {
  const snapshot = await db.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION)
    .where("simulatedExamId", "==", simulatedExamId)
    .orderBy("order", "asc")
    .get();
  return snapshot.docs.map(doc => doc.data() as FirebaseSimulatedExamQuestion);
};

// --- Funções para gerenciar FirebaseSimulatedExamResult ---

export const startSimulatedExamAttempt = async (
  simulatedExamId: string, 
  userId: string
): Promise<FirebaseSimulatedExamResult> => {
  const exam = await getSimulatedExamById(simulatedExamId);
  if (!exam) throw AppError.notFound("Simulado não encontrado.");
  if (exam.status !== FirebaseSimulatedExamStatus.PUBLISHED) throw AppError.badRequest("Este simulado não está publicado.");

  const newResultRef = db.collection(SIMULATED_EXAM_RESULTS_COLLECTION).doc();
  const now = Timestamp.now();
  let userName: string | null = null;
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) userName = (userDoc.data() as FirebaseUserProfile)?.name || (userDoc.data() as any)?.displayName || null;
  } catch (error) {
    console.warn("Erro ao buscar nome do usuário para resultado do simulado:", error);
  }

  const newResult: FirebaseSimulatedExamResult = {
    id: newResultRef.id,
    simulatedExamId,
    userId,
    score: 0,
    totalQuestions: exam.questionCount || 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unansweredQuestions: exam.questionCount || 0,
    timeSpentSeconds: 0,
    startedAt: now,
    completedAt: null,
    answers: [],
    status: FirebaseSimulatedExamResultStatus.IN_PROGRESS,
    createdAt: now,
    updatedAt: now,
  };
  await newResultRef.set(newResult);
  // Não incrementa totalAttempts aqui, mas em recordSimulatedExamAttempt ao submeter ou abandonar.
  return newResult;
};

export const submitSimulatedExamAttempt = async (
  resultId: string, 
  userId: string, 
  answers: Array<{
    questionId: string;
    selectedAlternativeId: string | null;
    isCorrect: boolean;
    essayResponse?: string | null;
    timeSpentSeconds: number;
  }>, 
  timeSpentSeconds: number
): Promise<FirebaseSimulatedExamResult> => {
  const resultRef = db.collection(SIMULATED_EXAM_RESULTS_COLLECTION).doc(resultId);
  const resultDoc = await resultRef.get();
  if (!resultDoc.exists) throw AppError.notFound("Resultado do simulado não encontrado.");
  
  const resultData = resultDoc.data() as FirebaseSimulatedExamResult;
  if (resultData.userId !== userId) throw AppError.forbidden("Usuário não autorizado a submeter este resultado.");
  if (resultData.status !== FirebaseSimulatedExamResultStatus.IN_PROGRESS) throw AppError.badRequest("Este resultado de simulado não está em progresso.");

  let correctAnswers = 0;
  answers.forEach(answer => {
    if (answer.isCorrect) correctAnswers++;
  });
  const incorrectAnswers = answers.length - correctAnswers;
  const unansweredQuestions = resultData.totalQuestions - answers.length;
  const score = resultData.totalQuestions ? parseFloat(((correctAnswers / resultData.totalQuestions) * 100).toFixed(2)) : 0;

  const now = Timestamp.now();
  const updatePayload: Partial<FirebaseSimulatedExamResult> = {
    answers,
    score,
    correctAnswers,
    incorrectAnswers,
    unansweredQuestions,
    timeSpentSeconds,
    completedAt: now,
    status: FirebaseSimulatedExamResultStatus.COMPLETED,
    updatedAt: now,
  };
  await resultRef.update(updatePayload);

  // Registrar tentativa e atualizar pontuação média no simulado principal
  await recordSimulatedExamAttempt(resultData.simulatedExamId, true);
  if (resultData.totalQuestions > 0) { // Só atualiza média se houver questões
      await updateAverageScore(resultData.simulatedExamId, score);
  }
  
  return { ...resultData, ...updatePayload } as FirebaseSimulatedExamResult;
};

export const getSimulatedExamResult = async (resultId: string, userId: string): Promise<FirebaseSimulatedExamResult | null> => {
  const resultDoc = await db.collection(SIMULATED_EXAM_RESULTS_COLLECTION).doc(resultId).get();
  if (!resultDoc.exists) return null;
  const resultData = resultDoc.data() as FirebaseSimulatedExamResult;
  // Adicionar verificação se o resultado pertence ao usuário ou se o usuário é admin
  if (resultData.userId !== userId /* && !userIsAdmin(userId) */) {
      // Para simplificar, não implementaremos userIsAdmin aqui, mas seria importante em produção.
      throw AppError.forbidden("Usuário não autorizado a ver este resultado.");
  }
  return resultData;
};

export const listSimulatedExamResultsForUser = async (
    simulatedExamId: string, 
    userId: string, 
    limit: number = 10, 
    startAfterDoc?: any
): Promise<{ results: FirebaseSimulatedExamResult[], nextPageToken: any | null}> => {
  let query: any = db.collection(SIMULATED_EXAM_RESULTS_COLLECTION)
    .where("simulatedExamId", "==", simulatedExamId)
    .where("userId", "==", userId)
    .orderBy("completedAt", "desc") // Ou startedAt, dependendo do desejado
    .limit(limit);

  if (startAfterDoc) query = query.startAfter(startAfterDoc);

  const snapshot = await query.get();
  const results = snapshot.docs.map((doc: any) => doc.data() as FirebaseSimulatedExamResult);
  const nextPageToken = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { results, nextPageToken };
};

