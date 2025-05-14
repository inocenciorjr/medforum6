import { firestoreDb as db } from "../config/firebaseAdmin";
import { FirebaseUserProfile, UserRole } from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { AppError } from "../utils/errors";

export const USER_PROFILES_COLLECTION = "userProfiles"; // Consistent with userService

/**
 * Cria ou obtém um perfil de usuário.
 * Esta função pode ser chamada durante o registro do usuário para garantir que um perfil exista.
 */
export const getOrCreateUserProfile = async (userId: string, defaults: Partial<FirebaseUserProfile> = {}): Promise<FirebaseUserProfile> => {
  const profileRef = db.collection(USER_PROFILES_COLLECTION).doc(userId);
  const profileDoc = await profileRef.get();

  if (profileDoc.exists) {
    return profileDoc.data() as FirebaseUserProfile;
  }

  const now = Timestamp.now();
  const newProfile: FirebaseUserProfile = {
    userId: userId,
    uid: userId, // for compatibility
    name: defaults.name || "Usuário",
    firstName: defaults.firstName,
    lastName: defaults.lastName,
    email: defaults.email,
    role: defaults.role || UserRole.STUDENT,
    isActive: defaults.isActive !== undefined ? defaults.isActive : true,
    profileImage: defaults.profileImage || null,
    bio: defaults.bio || null,
    phone: defaults.phone || null,
    lastLoginAt: defaults.lastLoginAt || now, // Initialize with current time or provided default
    preferences: defaults.preferences || null,
    specialization: defaults.specialization || null,
    interests: defaults.interests || null,
    graduationYear: defaults.graduationYear || null,
    address: defaults.address || null,
    city: defaults.city || null,
    state: defaults.state || null,
    country: defaults.country || null,
    postalCode: defaults.postalCode || null,
    birthDate: defaults.birthDate || null,
    gender: defaults.gender || null,
    profession: defaults.profession || null,
    institution: defaults.institution || null,
    createdAt: now,
    updatedAt: now,
    ...(defaults || {}), // Spread any other defaults provided
  };
  await profileRef.set(newProfile);
  return newProfile;
};

/**
 * Busca um perfil de usuário pelo UID (que é o ID do documento).
 */
export const getUserProfileByUid = async (uid: string): Promise<FirebaseUserProfile | null> => {
  try {
    const userProfileDoc = await db.collection(USER_PROFILES_COLLECTION).doc(uid).get();
    if (!userProfileDoc.exists) {
      console.warn(`Perfil não encontrado na coleção '${USER_PROFILES_COLLECTION}' para o UID: ${uid}`);
      return null;
    }
    return userProfileDoc.data() as FirebaseUserProfile;
  } catch (error) {
    console.error(`Erro ao buscar perfil do usuário ${uid} da coleção '${USER_PROFILES_COLLECTION}':`, error);
    throw AppError.internal("Erro ao buscar perfil do usuário.");
  }
};

/**
 * Atualiza o perfil de um usuário.
 * TODO: Implementar a lógica completa para updateUserProfile, incluindo validações e tratamento de campos específicos.
 */
export const updateUserProfile = async (
  uid: string, 
  updates: Partial<Omit<FirebaseUserProfile, "userId" | "uid" | "email" | "role" | "createdAt" | "updatedAt">>
): Promise<FirebaseUserProfile> => {
  const profileRef = db.collection(USER_PROFILES_COLLECTION).doc(uid);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    throw AppError.notFound(`Perfil de usuário com UID ${uid} não encontrado para atualização.`);
  }

  // Validar campos específicos aqui, se necessário.
  // Por exemplo, não permitir a alteração de certos campos ou validar formatos.
  // Exemplo: if (updates.birthDate && !isValidDate(updates.birthDate)) throw AppError.badRequest("Data de nascimento inválida.");

  const dataToUpdate = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  await profileRef.update(dataToUpdate);
  const updatedProfileDoc = await profileRef.get();
  
  if (!updatedProfileDoc.exists) { // Should not happen if update is successful
      throw AppError.internal("Falha ao buscar perfil após atualização.");
  }
  console.log(`Perfil do usuário ${uid} atualizado com sucesso.`);
  return updatedProfileDoc.data() as FirebaseUserProfile;
};

