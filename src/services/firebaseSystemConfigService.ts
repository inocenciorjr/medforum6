import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para configurações do sistema
export interface FirebaseSystemConfig {
  id: string;
  key: string;
  value: any;
  description?: string | null;
  category: string;
  isPublic: boolean;
  lastModifiedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseFeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description?: string | null;
  userPercentage?: number | null; // Para rollouts graduais (0-100)
  enabledUserIds?: string[] | null; // Lista de IDs de usuários específicos
  disabledUserIds?: string[] | null; // Lista de IDs de usuários específicos para desabilitar
  startDate?: Timestamp | null; // Data de início automático
  endDate?: Timestamp | null; // Data de término automático
  lastModifiedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const SYSTEM_CONFIG_COLLECTION = "systemConfig";
const FEATURE_FLAGS_COLLECTION = "featureFlags";

/**
 * Cria uma nova configuração do sistema.
 */
export const createSystemConfig = async (
  configData: Omit<FirebaseSystemConfig, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseSystemConfig> => {
  // Verificar se já existe uma configuração com a mesma chave
  const existingConfig = await getSystemConfigByKey(configData.key);
  if (existingConfig) {
    throw new Error(`Já existe uma configuração com a chave '${configData.key}'.`);
  }

  const configRef = db.collection(SYSTEM_CONFIG_COLLECTION).doc();
  const now = Timestamp.now();

  const newConfig: FirebaseSystemConfig = {
    id: configRef.id,
    ...configData,
    createdAt: now,
    updatedAt: now,
  };

  await configRef.set(newConfig);
  console.log(`Configuração do sistema (ID: ${newConfig.id}, Chave: ${newConfig.key}) criada com sucesso.`);
  return newConfig;
};

/**
 * Busca uma configuração do sistema pelo ID.
 */
export const getSystemConfigById = async (configId: string): Promise<FirebaseSystemConfig | null> => {
  const docRef = db.collection(SYSTEM_CONFIG_COLLECTION).doc(configId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseSystemConfig;
  }
  console.warn(`Configuração do sistema (ID: ${configId}) não encontrada.`);
  return null;
};

/**
 * Busca uma configuração do sistema pela chave.
 */
export const getSystemConfigByKey = async (key: string): Promise<FirebaseSystemConfig | null> => {
  try {
    const snapshot = await db.collection(SYSTEM_CONFIG_COLLECTION)
      .where("key", "==", key)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as FirebaseSystemConfig;
  } catch (error) {
    console.error(`Erro ao buscar configuração do sistema pela chave '${key}':`, error);
    throw error;
  }
};

/**
 * Busca configurações do sistema com opções de filtro.
 */
export const getSystemConfigs = async (
  options: {
    category?: string;
    isPublic?: boolean;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'key' | 'category' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ configs: FirebaseSystemConfig[]; total: number }> => {
  try {
    let query = db.collection(SYSTEM_CONFIG_COLLECTION);
    
    // Aplicar filtros
    if (options.category) {
      query = query.where("category", "==", options.category);
    }
    
    if (options.isPublic !== undefined) {
      query = query.where("isPublic", "==", options.isPublic);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'key';
    const orderDirection = options.orderDirection || 'asc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let configs: FirebaseSystemConfig[] = [];
    snapshot.forEach(doc => {
      configs.push(doc.data() as FirebaseSystemConfig);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTermLower = options.searchTerm.toLowerCase();
      configs = configs.filter(config => 
        config.key.toLowerCase().includes(searchTermLower) ||
        (config.description && config.description.toLowerCase().includes(searchTermLower))
      );
    }
    
    return { configs, total };
  } catch (error) {
    console.error(`Erro ao buscar configurações do sistema:`, error);
    throw error;
  }
};

/**
 * Atualiza uma configuração do sistema existente.
 */
export const updateSystemConfig = async (
  configId: string, 
  updates: Partial<Omit<FirebaseSystemConfig, "id" | "key" | "createdAt">>
): Promise<FirebaseSystemConfig | null> => {
  const configRef = db.collection(SYSTEM_CONFIG_COLLECTION).doc(configId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await configRef.update(updateData);
    console.log(`Configuração do sistema (ID: ${configId}) atualizada com sucesso.`);
    const updatedDoc = await configRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseSystemConfig : null;
  } catch (error) {
    console.error(`Erro ao atualizar configuração do sistema (ID: ${configId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma configuração do sistema.
 */
export const deleteSystemConfig = async (configId: string): Promise<void> => {
  const configRef = db.collection(SYSTEM_CONFIG_COLLECTION).doc(configId);
  try {
    await configRef.delete();
    console.log(`Configuração do sistema (ID: ${configId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir configuração do sistema (ID: ${configId}):`, error);
    throw error;
  }
};

/**
 * Obtém o valor de uma configuração do sistema pela chave.
 * Retorna o valor padrão se a configuração não for encontrada.
 */
export const getSystemConfigValue = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const config = await getSystemConfigByKey(key);
    return config ? config.value as T : defaultValue;
  } catch (error) {
    console.error(`Erro ao obter valor da configuração '${key}':`, error);
    return defaultValue;
  }
};

/**
 * Define o valor de uma configuração do sistema.
 * Cria a configuração se não existir.
 */
export const setSystemConfigValue = async (
  key: string,
  value: any,
  userId: string,
  options: {
    description?: string;
    category?: string;
    isPublic?: boolean;
  } = {}
): Promise<FirebaseSystemConfig> => {
  try {
    const existingConfig = await getSystemConfigByKey(key);
    
    if (existingConfig) {
      // Atualizar configuração existente
      const updatedConfig = await updateSystemConfig(existingConfig.id, {
        value,
        lastModifiedBy: userId,
        ...options
      });
      
      return updatedConfig!;
    } else {
      // Criar nova configuração
      const newConfig = await createSystemConfig({
        key,
        value,
        description: options.description || null,
        category: options.category || "general",
        isPublic: options.isPublic !== undefined ? options.isPublic : false,
        lastModifiedBy: userId
      });
      
      return newConfig;
    }
  } catch (error) {
    console.error(`Erro ao definir valor da configuração '${key}':`, error);
    throw error;
  }
};

/**
 * Cria uma nova feature flag.
 */
export const createFeatureFlag = async (
  flagData: Omit<FirebaseFeatureFlag, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseFeatureFlag> => {
  // Verificar se já existe uma feature flag com a mesma chave
  const existingFlag = await getFeatureFlagByKey(flagData.key);
  if (existingFlag) {
    throw new Error(`Já existe uma feature flag com a chave '${flagData.key}'.`);
  }

  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newFlag: FirebaseFeatureFlag = {
    id: flagRef.id,
    ...flagData,
    createdAt: now,
    updatedAt: now,
  };

  await flagRef.set(newFlag);
  console.log(`Feature flag (ID: ${newFlag.id}, Chave: ${newFlag.key}) criada com sucesso.`);
  return newFlag;
};

/**
 * Busca uma feature flag pelo ID.
 */
export const getFeatureFlagById = async (flagId: string): Promise<FirebaseFeatureFlag | null> => {
  const docRef = db.collection(FEATURE_FLAGS_COLLECTION).doc(flagId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseFeatureFlag;
  }
  console.warn(`Feature flag (ID: ${flagId}) não encontrada.`);
  return null;
};

/**
 * Busca uma feature flag pela chave.
 */
export const getFeatureFlagByKey = async (key: string): Promise<FirebaseFeatureFlag | null> => {
  try {
    const snapshot = await db.collection(FEATURE_FLAGS_COLLECTION)
      .where("key", "==", key)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as FirebaseFeatureFlag;
  } catch (error) {
    console.error(`Erro ao buscar feature flag pela chave '${key}':`, error);
    throw error;
  }
};

/**
 * Busca feature flags com opções de filtro.
 */
export const getFeatureFlags = async (
  options: {
    enabled?: boolean;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'key' | 'enabled' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ flags: FirebaseFeatureFlag[]; total: number }> => {
  try {
    let query = db.collection(FEATURE_FLAGS_COLLECTION);
    
    // Aplicar filtros
    if (options.enabled !== undefined) {
      query = query.where("enabled", "==", options.enabled);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'key';
    const orderDirection = options.orderDirection || 'asc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let flags: FirebaseFeatureFlag[] = [];
    snapshot.forEach(doc => {
      flags.push(doc.data() as FirebaseFeatureFlag);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTermLower = options.searchTerm.toLowerCase();
      flags = flags.filter(flag => 
        flag.key.toLowerCase().includes(searchTermLower) ||
        (flag.description && flag.description.toLowerCase().includes(searchTermLower))
      );
    }
    
    return { flags, total };
  } catch (error) {
    console.error(`Erro ao buscar feature flags:`, error);
    throw error;
  }
};

/**
 * Atualiza uma feature flag existente.
 */
export const updateFeatureFlag = async (
  flagId: string, 
  updates: Partial<Omit<FirebaseFeatureFlag, "id" | "key" | "createdAt">>
): Promise<FirebaseFeatureFlag | null> => {
  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc(flagId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await flagRef.update(updateData);
    console.log(`Feature flag (ID: ${flagId}) atualizada com sucesso.`);
    const updatedDoc = await flagRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseFeatureFlag : null;
  } catch (error) {
    console.error(`Erro ao atualizar feature flag (ID: ${flagId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma feature flag.
 */
export const deleteFeatureFlag = async (flagId: string): Promise<void> => {
  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc(flagId);
  try {
    await flagRef.delete();
    console.log(`Feature flag (ID: ${flagId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir feature flag (ID: ${flagId}):`, error);
    throw error;
  }
};

/**
 * Verifica se uma feature flag está habilitada para um usuário específico.
 */
export const isFeatureEnabled = async (key: string, userId?: string): Promise<boolean> => {
  try {
    const flag = await getFeatureFlagByKey(key);
    
    if (!flag) {
      console.warn(`Feature flag '${key}' não encontrada.`);
      return false;
    }
    
    // Verificar se a flag está globalmente habilitada
    if (!flag.enabled) {
      return false;
    }
    
    // Verificar datas de início e término
    const now = Timestamp.now();
    if (flag.startDate && flag.startDate.toMillis() > now.toMillis()) {
      return false; // Ainda não começou
    }
    
    if (flag.endDate && flag.endDate.toMillis() < now.toMillis()) {
      return false; // Já terminou
    }
    
    // Verificar usuário específico
    if (userId) {
      // Verificar se o usuário está explicitamente desabilitado
      if (flag.disabledUserIds && flag.disabledUserIds.includes(userId)) {
        return false;
      }
      
      // Verificar se o usuário está explicitamente habilitado
      if (flag.enabledUserIds && flag.enabledUserIds.includes(userId)) {
        return true;
      }
    }
    
    // Verificar rollout gradual
    if (flag.userPercentage !== null && flag.userPercentage !== undefined) {
      if (!userId) {
        // Sem ID de usuário, usar probabilidade simples
        return Math.random() * 100 < flag.userPercentage;
      } else {
        // Com ID de usuário, usar hash determinístico
        const hash = hashString(userId + key);
        return (hash % 100) < flag.userPercentage;
      }
    }
    
    // Se chegou até aqui, a feature está habilitada
    return true;
  } catch (error) {
    console.error(`Erro ao verificar feature flag '${key}':`, error);
    return false;
  }
};

/**
 * Função auxiliar para gerar um hash numérico de uma string.
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para inteiro de 32 bits
  }
  return Math.abs(hash);
};