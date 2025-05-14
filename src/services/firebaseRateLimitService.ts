import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Definição de tipos para rate limits
export interface FirebaseRateLimit {
  id: string;
  key: string; // Chave única para o rate limit (ex: "ip:127.0.0.1", "user:123", "endpoint:/api/users")
  type: "ip" | "user" | "endpoint" | "api_key" | "custom";
  count: number; // Número de requisições
  resetAt: Timestamp; // Quando o contador será resetado
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseRateLimitConfig {
  id: string;
  type: "ip" | "user" | "endpoint" | "api_key" | "custom";
  limit: number; // Número máximo de requisições permitidas
  windowSeconds: number; // Janela de tempo em segundos
  blockDurationSeconds?: number | null; // Duração do bloqueio em segundos (opcional)
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseRateLimitViolation {
  id: string;
  key: string;
  type: "ip" | "user" | "endpoint" | "api_key" | "custom";
  count: number;
  limit: number;
  ipAddress?: string | null;
  userId?: string | null;
  endpoint?: string | null;
  apiKeyId?: string | null;
  timestamp: Timestamp;
}

const RATE_LIMITS_COLLECTION = "rateLimits";
const RATE_LIMIT_CONFIGS_COLLECTION = "rateLimitConfigs";
const RATE_LIMIT_VIOLATIONS_COLLECTION = "rateLimitViolations";

/**
 * Cria ou atualiza uma configuração de rate limit.
 */
export const setRateLimitConfig = async (
  type: "ip" | "user" | "endpoint" | "api_key" | "custom",
  limit: number,
  windowSeconds: number,
  options: {
    id?: string;
    blockDurationSeconds?: number | null;
    isActive?: boolean;
  } = {}
): Promise<FirebaseRateLimitConfig> => {
  const configId = options.id || type;
  const configRef = db.collection(RATE_LIMIT_CONFIGS_COLLECTION).doc(configId);
  const now = Timestamp.now();

  const configData: FirebaseRateLimitConfig = {
    id: configId,
    type,
    limit,
    windowSeconds,
    blockDurationSeconds: options.blockDurationSeconds || null,
    isActive: options.isActive !== undefined ? options.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  // Verificar se o documento já existe
  const doc = await configRef.get();
  if (doc.exists) {
    // Atualizar apenas os campos fornecidos
    await configRef.update({
      ...configData,
      createdAt: doc.data()?.createdAt || now,
      updatedAt: now
    });
  } else {
    // Criar novo documento
    await configRef.set(configData);
  }

  console.log(`Configuração de rate limit (ID: ${configId}, Type: ${type}) salva com sucesso.`);
  return configData;
};

/**
 * Busca uma configuração de rate limit pelo ID.
 */
export const getRateLimitConfigById = async (configId: string): Promise<FirebaseRateLimitConfig | null> => {
  const docRef = db.collection(RATE_LIMIT_CONFIGS_COLLECTION).doc(configId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseRateLimitConfig;
  }
  console.warn(`Configuração de rate limit (ID: ${configId}) não encontrada.`);
  return null;
};

/**
 * Busca todas as configurações de rate limit.
 */
export const getAllRateLimitConfigs = async (
  options: {
    isActive?: boolean;
  } = {}
): Promise<FirebaseRateLimitConfig[]> => {
  try {
    let query: any = db.collection(RATE_LIMIT_CONFIGS_COLLECTION);
    
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    const snapshot = await query.get();
    
    const configs: FirebaseRateLimitConfig[] = [];
    snapshot.forEach((doc: any) => {
      configs.push(doc.data() as FirebaseRateLimitConfig);
    });
    
    return configs;
  } catch (error) {
    console.error(`Erro ao buscar configurações de rate limit:`, error);
    throw error;
  }
};

/**
 * Exclui uma configuração de rate limit.
 */
export const deleteRateLimitConfig = async (configId: string): Promise<void> => {
  const configRef = db.collection(RATE_LIMIT_CONFIGS_COLLECTION).doc(configId);
  try {
    await configRef.delete();
    console.log(`Configuração de rate limit (ID: ${configId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir configuração de rate limit (ID: ${configId}):`, error);
    throw error;
  }
};

/**
 * Verifica e incrementa um rate limit.
 * Retorna true se o limite não foi excedido, false caso contrário.
 */
export const checkAndIncrementRateLimit = async (
  type: "ip" | "user" | "endpoint" | "api_key" | "custom",
  value: string,
  options: {
    ipAddress?: string;
    userId?: string;
    endpoint?: string;
    apiKeyId?: string;
  } = {}
): Promise<boolean> => {
  try {
    // Buscar a configuração de rate limit
    const configId = type;
    const config = await getRateLimitConfigById(configId);
    
    if (!config || !config.isActive) {
      // Se não há configuração ou está inativa, permitir a requisição
      return true;
    }
    
    // Criar a chave única para o rate limit
    const key = `${type}:${value}`;
    
    // Buscar ou criar o rate limit
    const rateLimitRef = db.collection(RATE_LIMITS_COLLECTION).doc(key);
    const now = Timestamp.now();
    
    // Usar transação para garantir atomicidade
    return await db.runTransaction(async (transaction) => {
      const rateLimitDoc = await transaction.get(rateLimitRef);
      
      if (!rateLimitDoc.exists) {
        // Criar novo rate limit
        const resetAt = new Timestamp(
          now.seconds + config.windowSeconds,
          now.nanoseconds
        );
        
        const rateLimit: FirebaseRateLimit = {
          id: key,
          key,
          type,
          count: 1,
          resetAt,
          createdAt: now,
          updatedAt: now
        };
        
        transaction.set(rateLimitRef, rateLimit);
        return true; // Permitir a primeira requisição
      }
      
      const rateLimit = rateLimitDoc.data() as FirebaseRateLimit;
      
      // Verificar se o rate limit expirou
      if (now.toMillis() >= rateLimit.resetAt.toMillis()) {
        // Resetar o contador
        const resetAt = new Timestamp(
          now.seconds + config.windowSeconds,
          now.nanoseconds
        );
        
        transaction.update(rateLimitRef, {
          count: 1,
          resetAt,
          updatedAt: now
        });
        
        return true; // Permitir a requisição após reset
      }
      
      // Verificar se o limite foi excedido
      if (rateLimit.count >= config.limit) {
        // Registrar violação
        await logRateLimitViolation(
          key,
          type,
          rateLimit.count + 1,
          config.limit,
          options
        );
        
        return false; // Limite excedido
      }
      
      // Incrementar o contador
      transaction.update(rateLimitRef, {
        count: FieldValue.increment(1),
        updatedAt: now
      });
      
      return true; // Permitir a requisição
    });
  } catch (error) {
    console.error(`Erro ao verificar rate limit (${type}:${value}):`, error);
    return true; // Em caso de erro, permitir a requisição por segurança
  }
};

/**
 * Registra uma violação de rate limit.
 */
export const logRateLimitViolation = async (
  key: string,
  type: "ip" | "user" | "endpoint" | "api_key" | "custom",
  count: number,
  limit: number,
  options: {
    ipAddress?: string;
    userId?: string;
    endpoint?: string;
    apiKeyId?: string;
  } = {}
): Promise<FirebaseRateLimitViolation> => {
  const violationRef = db.collection(RATE_LIMIT_VIOLATIONS_COLLECTION).doc();
  const now = Timestamp.now();

  const violation: FirebaseRateLimitViolation = {
    id: violationRef.id,
    key,
    type,
    count,
    limit,
    ipAddress: options.ipAddress || null,
    userId: options.userId || null,
    endpoint: options.endpoint || null,
    apiKeyId: options.apiKeyId || null,
    timestamp: now
  };

  await violationRef.set(violation);
  console.warn(`Violação de rate limit registrada: ${key}, Count: ${count}, Limit: ${limit}`);
  return violation;
};

/**
 * Busca violações de rate limit com opções de filtro.
 */
export const getRateLimitViolations = async (
  options: {
    type?: "ip" | "user" | "endpoint" | "api_key" | "custom";
    ipAddress?: string;
    userId?: string;
    endpoint?: string;
    apiKeyId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ violations: FirebaseRateLimitViolation[]; total: number }> => {
  try {
    let query: any = db.collection(RATE_LIMIT_VIOLATIONS_COLLECTION);
    
    // Aplicar filtros
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.ipAddress) {
      query = query.where("ipAddress", "==", options.ipAddress);
    }
    
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.endpoint) {
      query = query.where("endpoint", "==", options.endpoint);
    }
    
    if (options.apiKeyId) {
      query = query.where("apiKeyId", "==", options.apiKeyId);
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
    
    const violations: FirebaseRateLimitViolation[] = [];
    snapshot.forEach((doc: any) => {
      violations.push(doc.data() as FirebaseRateLimitViolation);
    });
    
    return { violations, total };
  } catch (error) {
    console.error(`Erro ao buscar violações de rate limit:`, error);
    throw error;
  }
};

/**
 * Limpa rate limits expirados.
 */
export const cleanupExpiredRateLimits = async (): Promise<number> => {
  try {
    const now = Timestamp.now();
    
    // Buscar rate limits expirados
    const snapshot = await db.collection(RATE_LIMITS_COLLECTION)
      .where("resetAt", "<", now)
      .get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    // Excluir rate limits expirados em lote
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`${snapshot.size} rate limits expirados foram limpos.`);
    return snapshot.size;
  } catch (error) {
    console.error(`Erro ao limpar rate limits expirados:`, error);
    throw error;
  }
};

/**
 * Verifica se um IP está bloqueado.
 */
export const isIpBlocked = async (ipAddress: string): Promise<boolean> => {
  return !(await checkAndIncrementRateLimit("ip", ipAddress, { ipAddress }));
};

/**
 * Verifica se um usuário está bloqueado.
 */
export const isUserBlocked = async (userId: string): Promise<boolean> => {
  return !(await checkAndIncrementRateLimit("user", userId, { userId }));
};

/**
 * Verifica se um endpoint está bloqueado para um IP específico.
 */
export const isEndpointBlocked = async (endpoint: string, ipAddress: string): Promise<boolean> => {
  return !(await checkAndIncrementRateLimit("endpoint", endpoint, { endpoint, ipAddress }));
};

/**
 * Verifica se uma API Key está bloqueada.
 */
export const isApiKeyBlocked = async (apiKeyId: string): Promise<boolean> => {
  return !(await checkAndIncrementRateLimit("api_key", apiKeyId, { apiKeyId }));
};