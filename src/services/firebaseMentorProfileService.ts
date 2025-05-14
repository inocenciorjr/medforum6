import admin from "../config/firebaseAdmin";
import { FirebaseMentorProfile, UserRole } from "../types/firebaseTypes";
import { getUserProfile } from "./firebaseUserService"; // Para buscar o perfil do usuário

const firestore = admin.firestore();

/**
 * Cria um novo perfil de mentor no Firestore.
 * O ID do perfil do mentor será o mesmo UID do usuário.
 */
export const createMentorProfile = async (
  userId: string,
  profileData: Omit<FirebaseMentorProfile, "id" | "userId" | "createdAt" | "updatedAt" | "rating" | "totalSessions">
): Promise<FirebaseMentorProfile> => {
  try {
    // Verificar se o usuário existe e é um mentor
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      throw new Error(`Usuário com UID ${userId} não encontrado.`);
    }
    if (userProfile.role !== UserRole.MENTOR) {
      throw new Error(`Usuário com UID ${userId} não é um mentor. Role atual: ${userProfile.role}`);
    }

    // Verificar se já existe um perfil de mentor para este usuário
    const existingProfileDoc = await firestore.collection("mentorProfiles").doc(userId).get();
    if (existingProfileDoc.exists) {
      throw new Error(`Perfil de mentor já existe para o usuário com UID ${userId}.`);
    }

    const newProfile: FirebaseMentorProfile = {
      ...profileData,
      id: userId, // ID do perfil é o UID do usuário
      userId: userId,
      rating: 0, // Inicializado como 0
      totalSessions: 0, // Inicializado como 0
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };

    await firestore.collection("mentorProfiles").doc(userId).set(newProfile);
    console.log(`Perfil de mentor criado com sucesso para o usuário ${userId}`);
    return newProfile;
  } catch (error: any) {
    console.error(`Erro ao criar perfil de mentor para o usuário ${userId}:`, error);
    throw error;
  }
};



/**
 * Busca um perfil de mentor no Firestore pelo UID do usuário.
 */
export const getMentorProfile = async (userId: string): Promise<FirebaseMentorProfile | null> => {
  try {
    const profileDoc = await firestore.collection("mentorProfiles").doc(userId).get();
    if (!profileDoc.exists) {
      console.log(`Perfil de mentor não encontrado para o usuário ${userId}`);
      return null;
    }
    return profileDoc.data() as FirebaseMentorProfile;
  } catch (error) {
    console.error(`Erro ao buscar perfil de mentor para o usuário ${userId}:`, error);
    throw error;
  }
};

/**
 * Atualiza um perfil de mentor no Firestore.
 * Apenas os campos fornecidos em `updates` serão atualizados.
 */
export const updateMentorProfile = async (
  userId: string,
  updates: Partial<Omit<FirebaseMentorProfile, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<FirebaseMentorProfile | null> => {
  try {
    const profileRef = firestore.collection("mentorProfiles").doc(userId);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      throw new Error(`Perfil de mentor não encontrado para o usuário ${userId} para atualização.`);
    }

    const dataToUpdate = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await profileRef.update(dataToUpdate);
    console.log(`Perfil de mentor para o usuário ${userId} atualizado com sucesso.`);
    // Retornar o perfil atualizado
    const updatedProfileDoc = await profileRef.get();
    return updatedProfileDoc.data() as FirebaseMentorProfile;
  } catch (error: any) {
    console.error(`Erro ao atualizar perfil de mentor para o usuário ${userId}:`, error);
    throw error;
  }
};

/**
 * Exclui um perfil de mentor do Firestore.
 */
export const deleteMentorProfile = async (userId: string): Promise<void> => {
  try {
    const profileRef = firestore.collection("mentorProfiles").doc(userId);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      console.warn(`Perfil de mentor não encontrado para o usuário ${userId} para exclusão.`);
      // Considerar se deve lançar um erro ou apenas retornar/logar
      // throw new Error(`Perfil de mentor não encontrado para o usuário ${userId} para exclusão.`);
      return; // Não há nada para excluir
    }

    await profileRef.delete();
    console.log(`Perfil de mentor para o usuário ${userId} excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir perfil de mentor para o usuário ${userId}:`, error);
    throw error;
  }
};

