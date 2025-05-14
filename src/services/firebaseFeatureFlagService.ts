import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para feature flags
export interface FirebaseFeatureFlag {
  id: string;
  name: string;
  description?: string | null;
  key: string;
  enabled: boolean;
  environment: "development" | "staging" | "production" | "all";
  userPercentage?: number | null; // Para rollout gradual (0-100)
  userIds?: string[] | null; // Lista de IDs de usuários específicos para os quais a flag está ativa
  userRoles?: string[] | null; // Lista de papéis de usuário para os quais a flag está ativa
  startDate?: Timestamp | null; // Data de início (se temporária)
  endDate?: Timestamp | null; // Data de término (se temporária)
  metadata?: Record<string, any> | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string | null;
  updatedAt: Timestamp;
}

export interface FirebaseFeatureFlagLog {
  id: string;
  flagId: string;
  flagKey: string;
  action: "created" | "updated" | "deleted" | "enabled" | "disabled";
  previousValue?: any | null;
  newValue?: any | null;
  userId: string;
  timestamp: Timestamp;
}

const FEATURE_FLAGS_COLLECTION = "featureFlags";
const FEATURE_FLAG_LOGS_COLLECTION = "featureFlagLogs";

/**
 * Cria uma nova feature flag.
 */
export const createFeatureFlag = async (
  flagData: Omit<FirebaseFeatureFlag, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseFeatureFlag> => {
  // Verificar se já existe uma flag com a mesma chave
  const existingFlag = await getFeatureFlagByKey(flagData.key);
  if (existingFlag) {
    throw new Error(`Feature flag com a chave '${flagData.key}' já existe.`);
  }

  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newFlag: FirebaseFeatureFlag = {
    id: flagRef.id,
    ...flagData,
    createdAt: now,
    updatedAt: now
  };

  await flagRef.set(newFlag);
  
  // Registrar log de criação
  await logFeatureFlagAction(
    newFlag.id,
    newFlag.key,
    "created",
    null,
    newFlag,
    flagData.createdBy
  );
  
  console.log(`Feature flag (ID: ${newFlag.id}, Key: ${newFlag.key}) criada com sucesso.`);
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
    environment?: "development" | "staging" | "production" | "all";
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'key' | 'createdAt' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ flags: FirebaseFeatureFlag[]; total: number }> => {
  try {
    let query: any = db.collection(FEATURE_FLAGS_COLLECTION);
    
    // Aplicar filtros
    if (options.enabled !== undefined) {
      query = query.where("enabled", "==", options.enabled);
    }
    
    if (options.environment) {
      query = query.where("environment", "==", options.environment);
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
    snapshot.forEach((doc: any) => {
      flags.push(doc.data() as FirebaseFeatureFlag);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTerm = options.searchTerm.toLowerCase();
      flags = flags.filter(flag => 
        flag.name.toLowerCase().includes(searchTerm) ||
        flag.key.toLowerCase().includes(searchTerm) ||
        (flag.description && flag.description.toLowerCase().includes(searchTerm))
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
  updates: Partial<Omit<FirebaseFeatureFlag, "id" | "key" | "createdBy" | "createdAt" | "updatedAt">>,
  userId: string
): Promise<FirebaseFeatureFlag | null> => {
  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc(flagId);
  
  // Obter a flag atual para comparação e log
  const currentFlag = await getFeatureFlagById(flagId);
  if (!currentFlag) {
    throw new Error(`Feature flag (ID: ${flagId}) não encontrada para atualização.`);
  }
  
  const updateData = { 
    ...updates, 
    updatedBy: userId,
    updatedAt: Timestamp.now() 
  };

  try {
    await flagRef.update(updateData);
    
    // Obter a flag atualizada
    const updatedDoc = await flagRef.get();
    const updatedFlag = updatedDoc.data() as FirebaseFeatureFlag;
    
    // Registrar log de atualização
    await logFeatureFlagAction(
      flagId,
      currentFlag.key,
      updates.enabled !== undefined 
        ? (updates.enabled ? "enabled" : "disabled") 
        : "updated",
      currentFlag,
      updatedFlag,
      userId
    );
    
    console.log(`Feature flag (ID: ${flagId}, Key: ${currentFlag.key}) atualizada com sucesso.`);
    return updatedFlag;
  } catch (error) {
    console.error(`Erro ao atualizar feature flag (ID: ${flagId}):`, error);
    throw error;
  }
};

/**
 * Habilita uma feature flag.
 */
export const enableFeatureFlag = async (
  flagId: string,
  userId: string
): Promise<FirebaseFeatureFlag | null> => {
  return updateFeatureFlag(flagId, { enabled: true }, userId);
};

/**
 * Desabilita uma feature flag.
 */
export const disableFeatureFlag = async (
  flagId: string,
  userId: string
): Promise<FirebaseFeatureFlag | null> => {
  return updateFeatureFlag(flagId, { enabled: false }, userId);
};

/**
 * Exclui uma feature flag.
 */
export const deleteFeatureFlag = async (
  flagId: string,
  userId: string
): Promise<void> => {
  const flagRef = db.collection(FEATURE_FLAGS_COLLECTION).doc(flagId);
  
  // Obter a flag atual para o log
  const currentFlag = await getFeatureFlagById(flagId);
  if (!currentFlag) {
    throw new Error(`Feature flag (ID: ${flagId}) não encontrada para exclusão.`);
  }
  
  try {
    await flagRef.delete();
    
    // Registrar log de exclusão
    await logFeatureFlagAction(
      flagId,
      currentFlag.key,
      "deleted",
      currentFlag,
      null,
      userId
    );
    
    console.log(`Feature flag (ID: ${flagId}, Key: ${currentFlag.key}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir feature flag (ID: ${flagId}):`, error);
    throw error;
  }
};

/**
 * Verifica se uma feature flag está habilitada.
 */
export const isFeatureFlagEnabled = async (
  key: string,
  userId?: string,
  userRoles?: string[]
): Promise<boolean> => {
  try {
    const flag = await getFeatureFlagByKey(key);
    
    if (!flag) {
      console.warn(`Feature flag com chave '${key}' não encontrada.`);
      return false;
    }
    
    // Verificar se a flag está habilitada globalmente
    if (!flag.enabled) {
      return false;
    }
    
    // Verificar datas de início e término, se definidas
    const now = Timestamp.now();
    
    if (flag.startDate && now.toMillis() < flag.startDate.toMillis()) {
      return false; // Ainda não começou
    }
    
    if (flag.endDate && now.toMillis() > flag.endDate.toMillis()) {
      return false; // Já terminou
    }
    
    // Verificar se o usuário está na lista de usuários específicos
    if (userId && flag.userIds && flag.userIds.length > 0) {
      if (flag.userIds.includes(userId)) {
        return true;
      }
    }
    
    // Verificar se o papel do usuário está na lista de papéis
    if (userRoles && flag.userRoles && flag.userRoles.length > 0) {
      if (userRoles.some(role => flag.userRoles!.includes(role))) {
        return true;
      }
    }
    
    // Verificar porcentagem de usuários (rollout gradual)
    if (userId && flag.userPercentage !== null && flag.userPercentage !== undefined) {
      // Usar o userId para gerar um número determinístico entre 0 e 100
      const hash = simpleHash(userId + key);
      const userValue = hash % 100;
      
      if (userValue < flag.userPercentage) {
        return true;
      }
      
      return false;
    }
    
    // Se não há restrições específicas de usuário, retornar o estado global da flag
    return flag.enabled;
  } catch (error) {
    console.error(`Erro ao verificar feature flag '${key}':`, error);
    return false; // Em caso de erro, desabilitar a feature por segurança
  }
};

/**
 * Função auxiliar para gerar um hash simples de uma string.
 */
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para inteiro de 32 bits
  }
  return Math.abs(hash);
};

/**
 * Registra uma ação em uma feature flag.
 */
export const logFeatureFlagAction = async (
  flagId: string,
  flagKey: string,
  action: "created" | "updated" | "deleted" | "enabled" | "disabled",
  previousValue: any | null,
  newValue: any | null,
  userId: string
): Promise<FirebaseFeatureFlagLog> => {
  const logRef = db.collection(FEATURE_FLAG_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const log: FirebaseFeatureFlagLog = {
    id: logRef.id,
    flagId,
    flagKey,
    action,
    previousValue,
    newValue,
    userId,
    timestamp: now
  };

  await logRef.set(log);
  return log;
};

/**
 * Busca logs de feature flags com opções de filtro.
 */
export const getFeatureFlagLogs = async (
  options: {
    flagId?: string;
    flagKey?: string;
    action?: "created" | "updated" | "deleted" | "enabled" | "disabled";
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: FirebaseFeatureFlagLog[]; total: number }> => {
  try {
    let query: any = db.collection(FEATURE_FLAG_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.flagId) {
      query = query.where("flagId", "==", options.flagId);
    }
    
    if (options.flagKey) {
      query = query.where("flagKey", "==", options.flagKey);
    }
    
    if (options.action) {
      query = query.where("action", "==", options.action);
    }
    
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("timestamp", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("timestamp", "<=", endTimestamp);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    query = query.orderBy("timestamp", "desc"); // Mais recentes primeiro
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const logs: FirebaseFeatureFlagLog[] = [];
    snapshot.forEach((doc: any) => {
      logs.push(doc.data() as FirebaseFeatureFlagLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de feature flags:`, error);
    throw error;
  }
};