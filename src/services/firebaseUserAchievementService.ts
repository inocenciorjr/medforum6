import admin from "../config/firebaseAdmin";
import { FirebaseUserAchievement } from "../types/firebaseTypes";
import { getUserProfile } from "./firebaseUserService"; // Para verificar se o usuário existe
import { getAchievement } from "./firebaseAchievementService"; // Para verificar se o achievement existe

const firestore = admin.firestore();
const userAchievementsCollection = firestore.collection("userAchievements");

/**
 * Cria uma nova entrada de UserAchievement no Firestore.
 * O ID do documento pode ser `userId_achievementId` para garantir unicidade e fácil consulta.
 */
export const createUserAchievement = async (
  userId: string,
  achievementId: string,
  initialData: Partial<Omit<FirebaseUserAchievement, "id" | "userId" | "achievementId" | "createdAt" | "updatedAt">> = {}
): Promise<FirebaseUserAchievement> => {
  try {
    // Verificar se o usuário existe
    const user = await getUserProfile(userId);
    if (!user) {
      throw new Error(`Usuário com UID ${userId} não encontrado.`);
    }

    // Verificar se o achievement existe
    const achievement = await getAchievement(achievementId);
    if (!achievement) {
      throw new Error(`Achievement com ID ${achievementId} não encontrado.`);
    }
    if (!achievement.isActive) {
        throw new Error(`Achievement com ID ${achievementId} não está ativo.`);
    }

    const docId = `${userId}_${achievementId}`;
    const existingDoc = await userAchievementsCollection.doc(docId).get();
    if (existingDoc.exists) {
      throw new Error(`UserAchievement já existe para o usuário ${userId} e achievement ${achievementId}.`);
    }

    const newUserAchievement: FirebaseUserAchievement = {
      id: docId,
      userId,
      achievementId,
      progress: initialData.progress ?? 0,
      isCompleted: initialData.isCompleted ?? false,
      earnedDate: initialData.earnedDate ?? (initialData.isCompleted ? admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp : admin.firestore.Timestamp.fromDate(new Date(0))),
      metadata: initialData.metadata ?? {},
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };

    await userAchievementsCollection.doc(docId).set(newUserAchievement);
    console.log(`UserAchievement (ID: ${docId}) criado com sucesso para usuário ${userId} e achievement ${achievementId}.`);
    
    const createdDoc = await userAchievementsCollection.doc(docId).get();
    return createdDoc.data() as FirebaseUserAchievement;

  } catch (error: any) {
    console.error(`Erro ao criar UserAchievement para usuário ${userId} e achievement ${achievementId}:`, error);
    throw error;
  }
};



/**
 * Busca um UserAchievement específico pelo ID do usuário e ID do achievement.
 */
export const getUserAchievement = async (userId: string, achievementId: string): Promise<FirebaseUserAchievement | null> => {
  const docId = `${userId}_${achievementId}`;
  try {
    const doc = await userAchievementsCollection.doc(docId).get();
    if (!doc.exists) {
      console.log(`UserAchievement não encontrado para usuário ${userId} e achievement ${achievementId}.`);
      return null;
    }
    return doc.data() as FirebaseUserAchievement;
  } catch (error) {
    console.error(`Erro ao buscar UserAchievement para usuário ${userId} e achievement ${achievementId}:`, error);
    throw error;
  }
};

/**
 * Busca todos os UserAchievements para um usuário específico.
 */
export const getAllUserAchievements = async (userId: string): Promise<FirebaseUserAchievement[]> => {
  try {
    const snapshot = await userAchievementsCollection.where("userId", "==", userId).get();
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => doc.data() as FirebaseUserAchievement);
  } catch (error) {
    console.error(`Erro ao buscar todos os UserAchievements para o usuário ${userId}:`, error);
    throw error;
  }
};

/**
 * Atualiza um UserAchievement existente.
 * Permite atualizar progresso, status de conclusão, data de obtenção e metadados.
 */
export const updateUserAchievement = async (
  userId: string,
  achievementId: string,
  updates: Partial<Omit<FirebaseUserAchievement, "id" | "userId" | "achievementId" | "createdAt" | "updatedAt">>
): Promise<FirebaseUserAchievement | null> => {
  const docId = `${userId}_${achievementId}`;
  try {
    const docRef = userAchievementsCollection.doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`UserAchievement não encontrado para usuário ${userId} e achievement ${achievementId} para atualização.`);
    }

    const dataToUpdate = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(dataToUpdate);
    console.log(`UserAchievement (ID: ${docId}) atualizado com sucesso.`);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as FirebaseUserAchievement;
  } catch (error: any) {
    console.error(`Erro ao atualizar UserAchievement (ID: ${docId}):`, error);
    throw error;
  }
};

/**
 * Atualiza o progresso de um UserAchievement.
 * Se o progresso atingir 100%, marca como concluído e define a earnedDate.
 */
export const updateUserAchievementProgress = async (
  userId: string,
  achievementId: string,
  newProgress: number
): Promise<FirebaseUserAchievement | null> => {
  const docId = `${userId}_${achievementId}`;
  try {
    const docRef = userAchievementsCollection.doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`UserAchievement (ID: ${docId}) não encontrado para atualizar progresso.`);
    }

    const currentData = doc.data() as FirebaseUserAchievement;
    const clampedProgress = Math.min(100, Math.max(0, newProgress));

    const updates: Partial<FirebaseUserAchievement> = {
      progress: clampedProgress,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };

    if (clampedProgress >= 100 && !currentData.isCompleted) {
      updates.isCompleted = true;
      updates.earnedDate = admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp;
    } else if (clampedProgress < 100 && currentData.isCompleted) {
      // Opcional: reverter conclusão se o progresso cair. Por ora, não faremos isso.
      // updates.isCompleted = false;
      // updates.earnedDate = null;
    }

    await docRef.update(updates);
    console.log(`Progresso do UserAchievement (ID: ${docId}) atualizado para ${clampedProgress}%.`);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as FirebaseUserAchievement;

  } catch (error: any) {
    console.error(`Erro ao atualizar progresso do UserAchievement (ID: ${docId}):`, error);
    throw error;
  }
};


/**
 * Exclui um UserAchievement do Firestore.
 */
export const deleteUserAchievement = async (userId: string, achievementId: string): Promise<void> => {
  const docId = `${userId}_${achievementId}`;
  try {
    const docRef = userAchievementsCollection.doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.warn(`UserAchievement (ID: ${docId}) não encontrado para exclusão.`);
      return;
    }

    await docRef.delete();
    console.log(`UserAchievement (ID: ${docId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir UserAchievement (ID: ${docId}):`, error);
    throw error;
  }
};

