import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para configurações de usuário
export interface FirebaseUserConfig {
  id: string;
  userId: string;
  preferences: {
    theme?: "light" | "dark" | "system" | null;
    language?: string | null;
    emailNotifications?: boolean | null;
    pushNotifications?: boolean | null;
    smsNotifications?: boolean | null;
    contentFilters?: Record<string, boolean> | null;
    displayMode?: "compact" | "comfortable" | "default" | null;
    timezone?: string | null;
    dateFormat?: string | null;
    timeFormat?: string | null;
    [key: string]: any;
  };
  privacySettings: {
    profileVisibility?: "public" | "private" | "connections" | null;
    showOnlineStatus?: boolean | null;
    showLastSeen?: boolean | null;
    showEmail?: boolean | null;
    showPhone?: boolean | null;
    allowMessages?: boolean | null;
    allowTagging?: boolean | null;
    [key: string]: any;
  };
  deviceSettings?: {
    deviceId?: string | null;
    deviceType?: string | null;
    deviceToken?: string | null;
    lastActive?: Timestamp | null;
    [key: string]: any;
  } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const USER_CONFIG_COLLECTION = "userConfigs";

/**
 * Cria ou atualiza a configuração de um usuário.
 */
export const setUserConfig = async (
  userId: string,
  config: Partial<Omit<FirebaseUserConfig, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<FirebaseUserConfig> => {
  try {
    // Verificar se já existe uma configuração para o usuário
    const existingConfig = await getUserConfig(userId);
    const now = Timestamp.now();
    
    if (existingConfig) {
      // Atualizar configuração existente
      const configRef = db.collection(USER_CONFIG_COLLECTION).doc(existingConfig.id);
      
      const updatedConfig: FirebaseUserConfig = {
        ...existingConfig,
        preferences: {
          ...existingConfig.preferences,
          ...(config.preferences || {})
        },
        privacySettings: {
          ...existingConfig.privacySettings,
          ...(config.privacySettings || {})
        },
        deviceSettings: config.deviceSettings
          ? {
              ...existingConfig.deviceSettings,
              ...config.deviceSettings
            }
          : existingConfig.deviceSettings,
        updatedAt: now
      };
      
      await configRef.update(updatedConfig);
      console.log(`Configuração do usuário (ID: ${userId}) atualizada com sucesso.`);
      
      return updatedConfig;
    } else {
      // Criar nova configuração
      const configRef = db.collection(USER_CONFIG_COLLECTION).doc();
      
      const newConfig: FirebaseUserConfig = {
        id: configRef.id,
        userId,
        preferences: config.preferences || {},
        privacySettings: config.privacySettings || {},
        deviceSettings: config.deviceSettings || null,
        createdAt: now,
        updatedAt: now
      };
      
      await configRef.set(newConfig);
      console.log(`Configuração do usuário (ID: ${userId}) criada com sucesso.`);
      
      return newConfig;
    }
  } catch (error) {
    console.error(`Erro ao definir configuração do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Busca a configuração de um usuário.
 */
export const getUserConfig = async (userId: string): Promise<FirebaseUserConfig | null> => {
  try {
    const snapshot = await db.collection(USER_CONFIG_COLLECTION)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseUserConfig;
  } catch (error) {
    console.error(`Erro ao buscar configuração do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Atualiza as preferências de um usuário.
 */
export const updateUserPreferences = async (
  userId: string,
  preferences: Partial<FirebaseUserConfig["preferences"]>
): Promise<FirebaseUserConfig | null> => {
  try {
    const config = await getUserConfig(userId);
    
    if (!config) {
      // Criar nova configuração com as preferências
      return setUserConfig(userId, { preferences });
    }
    
    // Atualizar preferências existentes
    const configRef = db.collection(USER_CONFIG_COLLECTION).doc(config.id);
    const now = Timestamp.now();
    
    const updatedPreferences = {
      ...config.preferences,
      ...preferences
    };
    
    await configRef.update({
      preferences: updatedPreferences,
      updatedAt: now
    });
    
    console.log(`Preferências do usuário (ID: ${userId}) atualizadas com sucesso.`);
    
    return {
      ...config,
      preferences: updatedPreferences,
      updatedAt: now
    };
  } catch (error) {
    console.error(`Erro ao atualizar preferências do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Atualiza as configurações de privacidade de um usuário.
 */
export const updateUserPrivacySettings = async (
  userId: string,
  privacySettings: Partial<FirebaseUserConfig["privacySettings"]>
): Promise<FirebaseUserConfig | null> => {
  try {
    const config = await getUserConfig(userId);
    
    if (!config) {
      // Criar nova configuração com as configurações de privacidade
      return setUserConfig(userId, { privacySettings });
    }
    
    // Atualizar configurações de privacidade existentes
    const configRef = db.collection(USER_CONFIG_COLLECTION).doc(config.id);
    const now = Timestamp.now();
    
    const updatedPrivacySettings = {
      ...config.privacySettings,
      ...privacySettings
    };
    
    await configRef.update({
      privacySettings: updatedPrivacySettings,
      updatedAt: now
    });
    
    console.log(`Configurações de privacidade do usuário (ID: ${userId}) atualizadas com sucesso.`);
    
    return {
      ...config,
      privacySettings: updatedPrivacySettings,
      updatedAt: now
    };
  } catch (error) {
    console.error(`Erro ao atualizar configurações de privacidade do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Atualiza as configurações de dispositivo de um usuário.
 */
export const updateUserDeviceSettings = async (
  userId: string,
  deviceSettings: Partial<NonNullable<FirebaseUserConfig["deviceSettings"]>>
): Promise<FirebaseUserConfig | null> => {
  try {
    const config = await getUserConfig(userId);
    
    if (!config) {
      // Criar nova configuração com as configurações de dispositivo
      return setUserConfig(userId, { deviceSettings });
    }
    
    // Atualizar configurações de dispositivo existentes
    const configRef = db.collection(USER_CONFIG_COLLECTION).doc(config.id);
    const now = Timestamp.now();
    
    const updatedDeviceSettings = {
      ...config.deviceSettings,
      ...deviceSettings,
      lastActive: now
    };
    
    await configRef.update({
      deviceSettings: updatedDeviceSettings,
      updatedAt: now
    });
    
    console.log(`Configurações de dispositivo do usuário (ID: ${userId}) atualizadas com sucesso.`);
    
    return {
      ...config,
      deviceSettings: updatedDeviceSettings,
      updatedAt: now
    };
  } catch (error) {
    console.error(`Erro ao atualizar configurações de dispositivo do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Exclui a configuração de um usuário.
 */
export const deleteUserConfig = async (userId: string): Promise<void> => {
  try {
    const config = await getUserConfig(userId);
    
    if (!config) {
      console.warn(`Configuração do usuário (ID: ${userId}) não encontrada para exclusão.`);
      return;
    }
    
    const configRef = db.collection(USER_CONFIG_COLLECTION).doc(config.id);
    await configRef.delete();
    
    console.log(`Configuração do usuário (ID: ${userId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir configuração do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Busca usuários com configurações específicas.
 * Útil para segmentação de usuários.
 */
export const getUsersByConfig = async (
  configQuery: {
    preferences?: Record<string, any>;
    privacySettings?: Record<string, any>;
    deviceSettings?: Record<string, any>;
  },
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ userIds: string[]; total: number }> => {
  try {
    let query = db.collection(USER_CONFIG_COLLECTION);
    
    // Aplicar filtros de preferências
    if (configQuery.preferences) {
      for (const [key, value] of Object.entries(configQuery.preferences)) {
        query = query.where(`preferences.${key}`, "==", value);
      }
    }
    
    // Aplicar filtros de privacidade
    if (configQuery.privacySettings) {
      for (const [key, value] of Object.entries(configQuery.privacySettings)) {
        query = query.where(`privacySettings.${key}`, "==", value);
      }
    }
    
    // Aplicar filtros de dispositivo
    if (configQuery.deviceSettings) {
      for (const [key, value] of Object.entries(configQuery.deviceSettings)) {
        query = query.where(`deviceSettings.${key}`, "==", value);
      }
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const userIds: string[] = [];
    snapshot.forEach(doc => {
      const config = doc.data() as FirebaseUserConfig;
      userIds.push(config.userId);
    });
    
    return { userIds, total };
  } catch (error) {
    console.error(`Erro ao buscar usuários por configuração:`, error);
    throw error;
  }
};