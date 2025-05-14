import { admin, firestore as adminFirestore } from "../config/firebaseAdmin";
import { FirebaseUserProfile, FirebaseUser, UserRole } from "../types/firebaseTypes";
import { UserRecord } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

const firestore = adminFirestore; // Use adminFirestore for consistency

// Removed module-level 'auth' variable and its initial try-catch block.
// admin.auth() will be called directly where needed.

export const USERS_COLLECTION = "users";
export const USER_PROFILES_COLLECTION = "userProfiles";

export const registerUserWithEmailAndPassword = async (
  email: string,
  password: string,
  displayName: string,
  initialRole: UserRole
): Promise<UserRecord> => {
  let userRecord: UserRecord;
  const authInstance = admin.auth(); // Get auth instance directly

  try {
    userRecord = await authInstance.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false,
      disabled: false,
    });

    const now = Timestamp.now();

    const newUser: FirebaseUser = {
        id: userRecord.uid,
        uid: userRecord.uid,
        email: userRecord.email || email,
        displayName: displayName,
        role: initialRole,
        profileImage: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now, 
    };
    await firestore.collection(USERS_COLLECTION).doc(userRecord.uid).set(newUser);

    const userProfile: FirebaseUserProfile = {
      userId: userRecord.uid,
      name: displayName, 
      firstName: displayName.split(" ")[0] || "",
      lastName: displayName.split(" ").slice(1).join(" ") || "",
      profileImage: null,
      bio: null,
      updatedAt: now,
      createdAt: now, // Add createdAt for profile consistency
    };
    await firestore.collection(USER_PROFILES_COLLECTION).doc(userRecord.uid).set(userProfile);

    return userRecord;

  } catch (error: any) {
    if (userRecord! && error.code !== "auth/email-already-exists") { 
      try {
        await authInstance.deleteUser(userRecord!.uid);
        console.warn(`Usuário ${userRecord!.uid} deletado do Auth devido a falha ao criar perfil no Firestore.`);
      } catch (deleteError) {
        console.error(`Falha ao deletar usuário ${userRecord!.uid} do Auth após erro no Firestore:`, deleteError);
      }
    }
    console.error("Erro ao registrar novo usuário:", error);
    throw error; 
  }
};

export const createUser = async (userData: {
  email: string;
  password?: string; 
  name: string; 
  role: UserRole;
  isActive?: boolean; 
}): Promise<FirebaseUser> => {
  if (!userData.password) {
    throw new Error("Password is required to create a user for testing.");
  }
  const userRecord = await registerUserWithEmailAndPassword(
    userData.email,
    userData.password,
    userData.name, 
    userData.role
  );
  
  const createdUserDoc = await firestore.collection(USERS_COLLECTION).doc(userRecord.uid).get();
  if (!createdUserDoc.exists) {
    throw new Error(`Failed to retrieve created user from Firestore: ${userRecord.uid}`);
  }
  return createdUserDoc.data() as FirebaseUser;
};

export const getUser = async (uid: string): Promise<FirebaseUser | null> => {
    try {
        const userDoc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
        if (!userDoc.exists) {
            console.log(`Usuário não encontrado na coleção '${USERS_COLLECTION}' para o UID: ${uid}`);
            return null;
        }
        return userDoc.data() as FirebaseUser;
    } catch (error) {
        console.error(`Erro ao buscar usuário ${uid} da coleção '${USERS_COLLECTION}':`, error);
        throw error;
    }
};

/**
 * Lista usuários com filtros e paginação.
 */
export const getUsers = async (options?: {
  limit?: number;
  startAfter?: string; // Document ID to start after
  sortBy?: keyof FirebaseUser | "createdAt" | "updatedAt" | "lastLoginAt" | "displayName" | "email";
  sortDirection?: "asc" | "desc";
  role?: UserRole;
  isActive?: boolean;
  searchQuery?: string; // For searching by displayName or email
}): Promise<{ users: FirebaseUser[]; nextPageStartAfter?: string }> => {
  let query: any = firestore.collection(USERS_COLLECTION);

  if (options?.role) {
    query = query.where("role", "==", options.role);
  }
  if (options?.isActive !== undefined) {
    query = query.where("isActive", "==", options.isActive);
  }

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);

  if (options?.startAfter) {
    const startAfterDoc = await firestore.collection(USERS_COLLECTION).doc(options.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 20;
  query = query.limit(limit + 1); // Fetch one extra to check for next page

  const snapshot = await query.get();
  let users = snapshot.docs.map((doc: any) => doc.data() as FirebaseUser);

  if (options?.searchQuery) {
    const searchTerm = options.searchQuery.toLowerCase();
    users = users.filter((user: FirebaseUser) => 
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm)) ||
      (user.email && user.email.toLowerCase().includes(searchTerm))
    );
  }

  let nextPageStartAfter: string | undefined = undefined;
  if (users.length > limit) {
    const lastDoc = users.pop(); 
    if (lastDoc) {
      nextPageStartAfter = lastDoc.id; 
    }
  }

  return { users, nextPageStartAfter };
};


export const getUserProfile = async (uid: string): Promise<FirebaseUserProfile | null> => {
  try {
    const userProfileDoc = await firestore.collection(USER_PROFILES_COLLECTION).doc(uid).get();
    if (!userProfileDoc.exists) {
      console.log(`Perfil não encontrado na coleção '${USER_PROFILES_COLLECTION}' para o UID: ${uid}`);
      return null;
    }
    return userProfileDoc.data() as FirebaseUserProfile;
  } catch (error) {
    console.error(`Erro ao buscar perfil do usuário ${uid} da coleção '${USER_PROFILES_COLLECTION}':`, error);
    throw error;
  }
};

export const updateLastLogin = async (uid: string): Promise<void> => {
  try {
    const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
    const now = Timestamp.now();
    const updateData: {updatedAt: Timestamp, lastLoginAt: Timestamp} = { 
        updatedAt: now,
        lastLoginAt: now 
    }; 
    await userRef.update(updateData);
    console.log(`Último login atualizado para o usuário ${uid}`);
  } catch (error) {
    console.error(`Erro ao atualizar último login para o usuário ${uid}:`, error);
    throw error;
  }
};

export const verifyIdTokenAndProcessLogin = async (idToken: string): Promise<FirebaseUser | null> => {
  const authInstance = admin.auth(); // Get auth instance directly
  try {
    const decodedToken = await authInstance.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    await updateLastLogin(uid); 
    const user = await getUser(uid);

    if (!user) {
      console.error(`[verifyIdTokenAndProcessLogin] Usuário não encontrado para UID ${uid} após verificação de token.`);
      throw new Error(`Usuário autenticado (UID: ${uid}) não possui registro no Firestore.`);
    }
    console.log(`[verifyIdTokenAndProcessLogin] ID token verificado com sucesso para UID: ${uid}. Login processado.`);
    return user;
  } catch (error: any) {
    console.error("[verifyIdTokenAndProcessLogin] Erro ao verificar ID token ou processar login:", error.message);
    throw error; 
  }
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<Omit<FirebaseUserProfile, "userId" | "updatedAt" | "createdAt">>
): Promise<void> => {
  try {
    const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    await userProfileRef.update(dataToUpdate);
    console.log(`Perfil do usuário ${uid} atualizado com sucesso.`);
  } catch (error: any) {
    console.error(`Erro ao atualizar perfil do usuário ${uid}:`, error);
    if (error.code === 'firestore/not-found' || error.message.includes('NOT_FOUND') || error.code === 5) {
        console.warn(`Tentativa de atualizar perfil de usuário inexistente: ${uid}`);
        throw new Error(`Perfil de usuário com UID ${uid} não encontrado para atualização.`);
    }
    throw error;
  }
};

export const updateUser = async (
  uid: string,
  updates: Partial<Omit<FirebaseUser, "id" | "uid" | "email" | "createdAt" | "updatedAt">>
): Promise<void> => {
  try {
    const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    await userRef.update(dataToUpdate);
    console.log(`Dados do usuário ${uid} atualizados com sucesso.`);
  } catch (error: any) {
    console.error(`Erro ao atualizar dados do usuário ${uid}:`, error);
     if (error.code === 'firestore/not-found' || error.message.includes('NOT_FOUND') || error.code === 5) {
        console.warn(`Tentativa de atualizar usuário inexistente: ${uid}`);
        throw new Error(`Usuário com UID ${uid} não encontrado para atualização.`);
    }
    throw error;
  }
};

export const deleteUser = async (uid: string): Promise<void> => {
  const authInstance = admin.auth(); // Get auth instance directly
  try {
    await authInstance.deleteUser(uid);
    console.log(`Usuário ${uid} excluído do Firebase Authentication com sucesso.`);

    const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
    await userRef.delete();
    console.log(`Documento do usuário ${uid} excluído da coleção '${USERS_COLLECTION}'.`);

    const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
    const profileDoc = await userProfileRef.get();
    if (profileDoc.exists) {
        await userProfileRef.delete();
        console.log(`Perfil do usuário ${uid} excluído da coleção '${USER_PROFILES_COLLECTION}'.`);
    } else {
        console.log(`Perfil do usuário ${uid} não encontrado na coleção '${USER_PROFILES_COLLECTION}', não há necessidade de exclusão.`);
    }

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
        console.warn(`Tentativa de excluir usuário ${uid} do Auth, mas não foi encontrado.`);
        // If user not found in Auth, still try to clean up Firestore
    } else {
        console.error(`Erro ao excluir usuário ${uid}:`, error);
        // Even if another error occurs, attempt Firestore cleanup
    }
    // Firestore cleanup attempt, regardless of Auth error type (unless it was re-thrown above for critical issues)
    try {
        const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await userRef.delete();
            console.log(`Documento do usuário ${uid} (pós-erro Auth/ou Auth user not found) excluído da coleção '${USERS_COLLECTION}'.`);
        }
        const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
        const profileDoc = await userProfileRef.get();
        if (profileDoc.exists) {
            await userProfileRef.delete();
            console.log(`Perfil do usuário ${uid} (pós-erro Auth/ou Auth user not found) excluído da coleção '${USER_PROFILES_COLLECTION}'.`);
        }
    } catch (cleanupError) {
        console.error(`Erro durante a limpeza do Firestore para o usuário ${uid} após erro inicial ou Auth user not found:`, cleanupError);
        // If the original error was not 'auth/user-not-found', rethrow it so it's not masked by cleanup errors.
        if (error && error.code !== 'auth/user-not-found') throw error;
        else if (!error && cleanupError) throw cleanupError; // If no original error but cleanup failed
    }
    // If original error was 'auth/user-not-found' and cleanup succeeded, we don't throw.
    // If original error was 'auth/user-not-found' and cleanup failed, the cleanupError would be thrown by the block above.
  }
};

export const isAdmin = async (uid: string): Promise<boolean> => {
  const user = await getUser(uid);
  return user?.role === UserRole.ADMIN;
};

export const isMentor = async (uid: string): Promise<boolean> => {
  const user = await getUser(uid);
  return user?.role === UserRole.MENTOR;
};

export const isStudent = async (uid: string): Promise<boolean> => {
  const user = await getUser(uid);
  return user?.role === UserRole.STUDENT;
};

export const updateUserPreferences = async (uid: string, newPreferences: object): Promise<void> => {
  try {
    const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
    const userProfileDoc = await userProfileRef.get();

    if (!userProfileDoc.exists) {
      throw new Error(`Perfil de usuário com UID ${uid} não encontrado para atualização de preferências.`);
    }

    const currentPreferences = (userProfileDoc.data() as FirebaseUserProfile & { preferences?: object })?.preferences || {};
    const updatedPreferences = { ...currentPreferences, ...newPreferences };

    await userProfileRef.update({
      preferences: updatedPreferences,
      updatedAt: Timestamp.now(),
    });
    console.log(`Preferências do usuário ${uid} atualizadas com sucesso.`);
  } catch (error: any) {
    console.error(`Erro ao atualizar preferências do usuário ${uid}:`, error);
    throw error;
  }
};

export const updateUserSpecialization = async (uid: string, specialization: string | null): Promise<void> => {
  try {
    const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
    await userProfileRef.update({
      specialization: specialization, 
      updatedAt: Timestamp.now(),
    });
    console.log(`Especialização do usuário ${uid} atualizada com sucesso.`);
  } catch (error: any) {
    console.error(`Erro ao atualizar especialização do usuário ${uid}:`, error);
    throw error;
  }
};

export const updateUserInterests = async (uid: string, interests: string[] | null): Promise<void> => {
  try {
    const userProfileRef = firestore.collection(USER_PROFILES_COLLECTION).doc(uid);
    await userProfileRef.update({
      interests: interests, 
      updatedAt: Timestamp.now(),
    });
    console.log(`Interesses do usuário ${uid} atualizados com sucesso.`);
  } catch (error: any) {
    console.error(`Erro ao atualizar interesses do usuário ${uid}:`, error);
    throw error;
  }
};



export const getUserById = getUser; // Alias for getUser
