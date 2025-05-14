import { firestore } from "../config/firebaseAdmin";
import {
  FirebaseUserStatistics,
  FirebaseFilterCategory,
  FirebaseProgrammedReviewStatus,
  FirebaseProgrammedReviewContentType,
  FirebaseUserStatisticsUpdatePayload // Importar o novo tipo de payload
} from "../types/firebaseTypes";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getFilterById } from "./firebaseFilterService";
import { getParentFilterCategory } from "./firebaseSubFilterService"; 

export const COLLECTION_NAME = "userStatistics";

export const getOrCreateUserStatistics = async (userId: string): Promise<FirebaseUserStatistics> => {
  const statsRef = firestore.collection(COLLECTION_NAME).doc(userId);
  const docSnap = await statsRef.get();

  if (docSnap.exists) {
    const data = docSnap.data() as FirebaseUserStatistics;
    data.strongestFilters = data.strongestFilters || [];
    data.weakestFilters = data.weakestFilters || [];
    data.improvementAreas = data.improvementAreas || [];
    data.questionsPerDay = data.questionsPerDay || {};
    data.studyTimePerDay = data.studyTimePerDay || {};
    data.accuracyPerDay = data.accuracyPerDay || {};
    data.accuracyPerFilter = data.accuracyPerFilter || {};
    data.accuracyPerDifficulty = data.accuracyPerDifficulty || {};
    return data;
  }

  const now = Timestamp.now();
  const newStats: FirebaseUserStatistics = {
    id: userId,
    userId: userId,
    totalQuestionsAnswered: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    simulatedExamsTaken: 0,
    totalStudyTimeMinutes: 0,
    questionsPerDay: {},
    studyTimePerDay: {},
    accuracyPerDay: {},
    accuracyPerFilter: {}, 
    accuracyPerDifficulty: {},
    streakDays: 0,
    lastStudyDate: null,
    strongestFilters: [], 
    weakestFilters: [],   
    improvementAreas: [], 
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await statsRef.set(newStats);
  return newStats;
};

// Usar FirebaseUserStatisticsUpdatePayload para o parâmetro updates
export const updateUserStatistics = async (
  userId: string,
  updates: FirebaseUserStatisticsUpdatePayload // Alterado para o tipo de payload específico
): Promise<FirebaseUserStatistics | null> => {
  // Garante que o documento de estatísticas exista antes de tentar atualizar.
  await getOrCreateUserStatistics(userId);

  const statsRef = firestore.collection(COLLECTION_NAME).doc(userId);
  // Garantir que updatedAt e lastActivityAt sejam adicionados ao objeto de atualização
  const updateDataWithTimestamps: FirebaseUserStatisticsUpdatePayload & { updatedAt: Timestamp, lastActivityAt: Timestamp } = {
    ...updates,
    updatedAt: Timestamp.now(),
    lastActivityAt: Timestamp.now(),
  };

  try {
    await statsRef.update(updateDataWithTimestamps); // statsRef.update aceita o tipo mais amplo que inclui FieldValue
    const updatedDocSnap = await statsRef.get();
    if (updatedDocSnap.exists) {
        const data = updatedDocSnap.data() as FirebaseUserStatistics;
        data.strongestFilters = data.strongestFilters || [];
        data.weakestFilters = data.weakestFilters || [];
        data.improvementAreas = data.improvementAreas || [];
        data.questionsPerDay = data.questionsPerDay || {};
        data.studyTimePerDay = data.studyTimePerDay || {};
        data.accuracyPerDay = data.accuracyPerDay || {};
        data.accuracyPerFilter = data.accuracyPerFilter || {};
        data.accuracyPerDifficulty = data.accuracyPerDifficulty || {};
        return data;
    }
    return null;
  } catch (error) {
    console.error(`Erro ao atualizar UserStatistics para o usuário (ID: ${userId}):`, error);
    if ((error as any).code === 5) { 
        console.warn(`Tentativa de atualizar UserStatistics inexistente para o ID de usuário: ${userId}. Considere criá-lo primeiro.`);
    }
    throw error; 
  }
};

const getTodayDateString = (): string => {
  return new Date().toISOString().split("T")[0];
};

export const recordAnswer = async (
  userId: string,
  isCorrect: boolean,
  subFilterId?: string | null, 
  difficulty?: string | null
): Promise<FirebaseUserStatistics | null> => {
  const stats = await getOrCreateUserStatistics(userId);
  const todayStr = getTodayDateString();
  const now = Timestamp.now();

  // Usar FirebaseUserStatisticsUpdatePayload para o objeto updates
  const updates: FirebaseUserStatisticsUpdatePayload = {
    totalQuestionsAnswered: FieldValue.increment(1),
    correctAnswers: FieldValue.increment(isCorrect ? 1 : 0),
    incorrectAnswers: FieldValue.increment(isCorrect ? 0 : 1),
  };

  const newQuestionsPerDay = { ...(stats.questionsPerDay || {}) };
  newQuestionsPerDay[todayStr] = (newQuestionsPerDay[todayStr] || 0) + 1;
  updates.questionsPerDay = newQuestionsPerDay;

  const newAccuracyPerDay = { ...(stats.accuracyPerDay || {}) };
  const dailyAccuracy = newAccuracyPerDay[todayStr] || { correct: 0, total: 0 };
  dailyAccuracy.correct += isCorrect ? 1 : 0;
  dailyAccuracy.total += 1;
  newAccuracyPerDay[todayStr] = dailyAccuracy;
  updates.accuracyPerDay = newAccuracyPerDay;

  if (subFilterId) {
    // Track accuracy for any subFilterId provided.
    // The recalculateStrengthsAndWeaknesses function will specifically use educational filters.
    const newAccuracyPerFilter = { ...(stats.accuracyPerFilter || {}) };
    const filterAccuracy = newAccuracyPerFilter[subFilterId] || { correct: 0, total: 0 };
    filterAccuracy.correct += isCorrect ? 1 : 0;
    filterAccuracy.total += 1;
    newAccuracyPerFilter[subFilterId] = filterAccuracy;
    updates.accuracyPerFilter = newAccuracyPerFilter;
  }

  if (difficulty) {
    const newAccuracyPerDifficulty = { ...(stats.accuracyPerDifficulty || {}) };
    const difficultyAccuracy = newAccuracyPerDifficulty[difficulty] || { correct: 0, total: 0 };
    difficultyAccuracy.correct += isCorrect ? 1 : 0;
    difficultyAccuracy.total += 1;
    newAccuracyPerDifficulty[difficulty] = difficultyAccuracy;
    updates.accuracyPerDifficulty = newAccuracyPerDifficulty;
  }

  let currentStreak = stats.streakDays || 0;
  if (stats.lastStudyDate) {
    const lastStudyDate = stats.lastStudyDate.toDate();
    const today = new Date();
    lastStudyDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - lastStudyDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak += 1;
    } else if (diffDays > 1) {
      currentStreak = 1;
    } else if (diffDays === 0 && currentStreak === 0) {
        currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }
  updates.streakDays = currentStreak;
  updates.lastStudyDate = now;

  return updateUserStatistics(userId, updates);
};

export const recordStudyTime = async (
  userId: string,
  minutes: number
): Promise<FirebaseUserStatistics | null> => {
  if (minutes <= 0) return getOrCreateUserStatistics(userId);

  const stats = await getOrCreateUserStatistics(userId);
  const todayStr = getTodayDateString();
  const now = Timestamp.now();

  const updates: FirebaseUserStatisticsUpdatePayload = {
    totalStudyTimeMinutes: FieldValue.increment(minutes),
  };

  const newStudyTimePerDay = { ...(stats.studyTimePerDay || {}) };
  newStudyTimePerDay[todayStr] = (newStudyTimePerDay[todayStr] || 0) + minutes;
  updates.studyTimePerDay = newStudyTimePerDay;

  let currentStreak = stats.streakDays || 0;
  if (stats.lastStudyDate) {
    const lastStudyDate = stats.lastStudyDate.toDate();
    const today = new Date();
    lastStudyDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - lastStudyDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak += 1;
    } else if (diffDays > 1) {
      currentStreak = 1;
    } else if (diffDays === 0 && currentStreak === 0) {
        currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }
  updates.streakDays = currentStreak;
  updates.lastStudyDate = now;

  return updateUserStatistics(userId, updates);
};

export const incrementSimulatedExamsTaken = async (userId: string): Promise<FirebaseUserStatistics | null> => {
    // O objeto aqui é diretamente um FirebaseUserStatisticsUpdatePayload
    return updateUserStatistics(userId, { simulatedExamsTaken: FieldValue.increment(1) });
};

const calculateAccuracy = (correct: number, total: number): number => {
  if (total === 0) return 0;
  return parseFloat(((correct / total) * 100).toFixed(2));
};

export const recalculateStrengthsAndWeaknesses = async (userId: string): Promise<FirebaseUserStatistics | null> => {
  const stats = await getOrCreateUserStatistics(userId);
  const currentStrongestFilters = stats.strongestFilters || [];
  const currentWeakestFilters = stats.weakestFilters || [];
  const currentImprovementAreas = stats.improvementAreas || [];
  const accuracyPerSubFilter = stats.accuracyPerFilter || {}; 
  
  const educationalSubFilterAccuracies: [string, number][] = [];

  for (const subFilterId in accuracyPerSubFilter) {
    if (Object.prototype.hasOwnProperty.call(accuracyPerSubFilter, subFilterId)) {
      const parentCategory = await getParentFilterCategory(subFilterId);
      if (parentCategory === FirebaseFilterCategory.EDUCATIONAL) {
        const statValues = accuracyPerSubFilter[subFilterId];
        if (statValues) {
           educationalSubFilterAccuracies.push([subFilterId, calculateAccuracy(statValues.correct, statValues.total)]);
        }
      }
    }
  }

  if (educationalSubFilterAccuracies.length === 0) {
    if (currentStrongestFilters.length > 0 || currentWeakestFilters.length > 0 || currentImprovementAreas.length > 0) {
        // O objeto aqui é diretamente um FirebaseUserStatisticsUpdatePayload
        return updateUserStatistics(userId, {
            strongestFilters: [],
            weakestFilters: [],
            improvementAreas: [],
        });
    }
    return stats;
  }

  educationalSubFilterAccuracies.sort((a, b) => b[1] - a[1]);

  const numEducationalSubFilters = educationalSubFilterAccuracies.length;
  const strongestFilters = numEducationalSubFilters > 0 ? [educationalSubFilterAccuracies[0][0]] : [];
  const weakestFilters = numEducationalSubFilters > 0 ? [[...educationalSubFilterAccuracies].sort((a,b) => a[1] - b[1])[0][0]] : [];

  const improvementThreshold = 70; 
  const improvementAreas = educationalSubFilterAccuracies
    .filter(([, accuracy]) => accuracy < improvementThreshold)
    .map(([key]) => key);

  const hasChanges =
    JSON.stringify(strongestFilters) !== JSON.stringify(currentStrongestFilters) ||
    JSON.stringify(weakestFilters) !== JSON.stringify(currentWeakestFilters) ||
    JSON.stringify(improvementAreas) !== JSON.stringify(currentImprovementAreas);

  if (!hasChanges) {
    return stats; 
  }
  
  // O objeto aqui é diretamente um FirebaseUserStatisticsUpdatePayload
  return updateUserStatistics(userId, {
    strongestFilters,
    weakestFilters,
    improvementAreas,
  });
};

