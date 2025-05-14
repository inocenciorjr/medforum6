import admin, { firestore as db } from "../config/firebaseAdmin"; // Alterado para db
import {
  FirebaseAchievement,
  FirebaseAchievementCriteria,
  FirebaseAchievementCriteriaType,
  FirebaseUserAchievement,
  FirebaseUserStatistics,
  FirebaseFilterCategory, // Adicionado para lógica de critério
  FirebaseFilter, // Adicionado para lógica de critério
  FirebaseSubFilter // Adicionado para lógica de critério
} from "../types/firebaseTypes";
import { getOrCreateUserStatistics } from "./firebaseUserStatisticsService";
import { getFilterById, getSubFilterById } from "./firebaseFilterService"; // Adicionado para buscar filtros/subfiltros

const firestore = db; // Usar o db importado
export const COLLECTION_NAME = "achievements"; // Exportar COLLECTION_NAME
const achievementsCollection = firestore.collection(COLLECTION_NAME);
const USER_ACHIEVEMENTS_SUBCOLLECTION = "userAchievements";

export const createAchievement = async (
  achievementData: Omit<FirebaseAchievement, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseAchievement> => {
  try {
    const docRef = achievementsCollection.doc();
    const newAchievement: FirebaseAchievement = {
      ...achievementData,
      id: docRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };
    await docRef.set(newAchievement);
    const createdDoc = await docRef.get();
    return createdDoc.data() as FirebaseAchievement;
  } catch (error: any) {
    console.error(`Erro ao criar achievement "${achievementData.name}":`, error);
    throw error;
  }
};

export const getAchievement = async (achievementId: string): Promise<FirebaseAchievement | null> => {
  try {
    const doc = await achievementsCollection.doc(achievementId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as FirebaseAchievement;
  } catch (error) {
    console.error(`Erro ao buscar achievement com ID ${achievementId}:`, error);
    throw error;
  }
};

export const updateAchievement = async (
  achievementId: string,
  updates: Partial<Omit<FirebaseAchievement, "id" | "createdAt">>
): Promise<FirebaseAchievement | null> => {
  try {
    const docRef = achievementsCollection.doc(achievementId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`Achievement com ID ${achievementId} não encontrado para atualização.`);
    }
    const dataToUpdate = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.update(dataToUpdate);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as FirebaseAchievement;
  } catch (error: any) {
    console.error(`Erro ao atualizar achievement com ID ${achievementId}:`, error);
    throw error;
  }
};

export const deleteAchievement = async (achievementId: string): Promise<void> => {
  try {
    const docRef = achievementsCollection.doc(achievementId);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.warn(`Achievement com ID ${achievementId} não encontrado para exclusão.`);
      return;
    }
    // Excluir subcoleção userAchievements primeiro
    const userAchievementsSnapshot = await docRef.collection(USER_ACHIEVEMENTS_SUBCOLLECTION).get();
    if (!userAchievementsSnapshot.empty) {
        const batch = firestore.batch();
        userAchievementsSnapshot.docs.forEach(subDoc => batch.delete(subDoc.ref));
        await batch.commit();
        console.log(`Subcoleção userAchievements para ${achievementId} excluída.`);
    }
    await docRef.delete();
    console.log(`Achievement com ID ${achievementId} excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir achievement com ID ${achievementId}:`, error);
    throw error;
  }
};

// Implementação de listAchievements
export const listAchievements = async (activeOnly: boolean = false): Promise<FirebaseAchievement[]> => {
  try {
    let query: FirebaseFirestore.Query = achievementsCollection;
    if (activeOnly) {
      query = query.where("isActive", "==", true);
    }
    const snapshot = await query.orderBy("createdAt", "desc").get();
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => doc.data() as FirebaseAchievement);
  } catch (error) {
    console.error("Erro ao listar achievements:", error);
    throw error;
  }
};

// Implementação de checkAndAwardAchievements
export const checkAndAwardAchievements = async (userId: string): Promise<FirebaseUserAchievement[]> => {
  const awardedUserAchievements: FirebaseUserAchievement[] = [];
  try {
    const userStats = await getOrCreateUserStatistics(userId);
    if (!userStats) {
      console.warn(`Estatísticas não encontradas para o usuário ${userId}, não é possível verificar conquistas.`);
      return [];
    }

    const activeAchievements = await listAchievements(true);
    if (activeAchievements.length === 0) {
      return []; // Nenhuma conquista ativa para verificar
    }

    for (const achievement of activeAchievements) {
      if (!achievement.criteria) continue; // Pula se não houver critério

      // Verifica se o usuário já possui esta conquista
      const userAchievementRef = achievementsCollection.doc(achievement.id).collection(USER_ACHIEVEMENTS_SUBCOLLECTION).doc(userId);
      const userAchievementDoc = await userAchievementRef.get();
      if (userAchievementDoc.exists) {
        continue; // Usuário já possui esta conquista
      }

      let criteriaMet = true;

      // Verificar critérios baseados no tipo
      if (achievement.criteria.type) {
        switch (achievement.criteria.type) {
          case FirebaseAchievementCriteriaType.ANSWER_COUNT:
            if (userStats.totalQuestionsAnswered < achievement.criteria.threshold) {
              criteriaMet = false;
            }
            break;
          case FirebaseAchievementCriteriaType.STUDY_TIME:
            const studyTime = userStats.totalStudyTimeMinutes || 0;
            if (studyTime < achievement.criteria.threshold) {
              criteriaMet = false;
            }
            break;
          case FirebaseAchievementCriteriaType.EXAM_COUNT:
            const examsTaken = userStats.simulatedExamsTaken || 0;
            if (examsTaken < achievement.criteria.threshold) {
              criteriaMet = false;
            }
            break;
          case FirebaseAchievementCriteriaType.STREAK:
            const streakDays = userStats.streakDays || 0;
            if (streakDays < achievement.criteria.threshold) {
              criteriaMet = false;
            }
            break;
          case FirebaseAchievementCriteriaType.ACCURACY:
            // Implementar lógica de precisão geral
            if (userStats.totalQuestionsAnswered > 0) {
              const accuracy = userStats.correctAnswers / userStats.totalQuestionsAnswered;
              if (accuracy < (achievement.criteria.threshold / 100)) { // Threshold em porcentagem
                criteriaMet = false;
              }
            } else {
              criteriaMet = false;
            }
            break;
          default:
            // Critérios legados ou personalizados
            // Critério: minQuestionsAnswered
            if (achievement.criteria.minQuestionsAnswered && userStats.totalQuestionsAnswered < achievement.criteria.minQuestionsAnswered) {
              criteriaMet = false;
            }
        }
      } else {
        // Compatibilidade com critérios antigos
        if (achievement.criteria.minQuestionsAnswered && userStats.totalQuestionsAnswered < achievement.criteria.minQuestionsAnswered) {
          criteriaMet = false;
        }
      }

      // Critério: minAccuracyInFilter (agora subFilterId)
      if (criteriaMet && achievement.criteria.minAccuracyInFilter) {
        const { filterId: subFilterIdToTest, accuracy: requiredAccuracy } = achievement.criteria.minAccuracyInFilter;
        const filterStats = userStats.accuracyPerFilter?.[subFilterIdToTest];
        
        if (!filterStats || filterStats.total === 0) {
          criteriaMet = false; // Nenhuma resposta no filtro/subfiltro
        } else {
          const currentAccuracy = (filterStats.correct / filterStats.total);
          if (currentAccuracy < requiredAccuracy) {
            criteriaMet = false;
          }
          // Verifica minQuestionsInFilter se presente
          if (achievement.criteria.minQuestionsInFilter && filterStats.total < achievement.criteria.minQuestionsInFilter) {
            criteriaMet = false;
          }
        }
      }
      
      // Adicionar outros critérios aqui conforme necessário

      if (criteriaMet) {
        const now = admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp;
        const newUserAchievement: FirebaseUserAchievement = {
          id: userAchievementRef.id, // O ID do documento será o userId
          userId: userId,
          achievementId: achievement.id,
          unlockedAt: now,
          isClaimed: false, // Por padrão, não reivindicado
          createdAt: now,
          updatedAt: now,
        };
        await userAchievementRef.set(newUserAchievement);
        
        // Para retornar o objeto completo com timestamps populados
        const createdUserAchDoc = await userAchievementRef.get();
        awardedUserAchievements.push(createdUserAchDoc.data() as FirebaseUserAchievement);
        console.log(`Conquista "${achievement.name}" concedida ao usuário ${userId}.`);
      }
    }
    return awardedUserAchievements;
  } catch (error) {
    console.error(`Erro ao verificar e conceder conquistas para o usuário ${userId}:`, error);
    // Não relança o erro para não parar outros processos, mas loga.
    return awardedUserAchievements; // Retorna o que foi concedido até o momento do erro
  }
};

