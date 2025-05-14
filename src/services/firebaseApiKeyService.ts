import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from 'crypto';

// Definição de tipos para API Keys
export interface FirebaseApiKey {
  id: string;
  name: string;
  description?: string | null;
  key: string; // Valor da API Key (hash)
  prefix: string; // Prefixo visível da API Key
  scopes: string[]; // Permissões da API Key (ex: "read:users", "write:posts")
  userId: string; // Usuário que criou a API Key
  expiresAt?: Timestamp | null; // Data de expiração (opcional)
  lastUsedAt?: Timestamp | null; // Última vez que a API Key foi usada
  usageCount: number; // Contador de uso
  ipRestrictions?: string[] | null; // Lista de IPs permitidos (opcional)
  isActive: boolean; // Se a API Key está ativa
  revokedAt?: Timestamp | null; // Data de revogação (se revogada)
  revokedBy?: string | null; // Usuário que revogou a API Key
  revokedReason?: string | null; // Motivo da revogação
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseApiKeyUsageLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Timestamp;
}

const API_KEYS_COLLECTION = "apiKeys";
const API_KEY_USAGE_LOGS_COLLECTION = "apiKeyUsageLogs";

/**
 * Gera uma nova API Key.
 */
export const generateApiKey = async (
  name: string,
  userId: string,
  options: {
    description?: string | null;
    scopes?: string[];
    expiresAt?: Date | null;
    ipRestrictions?: string[] | null;
  } = {}
): Promise<{ apiKey: FirebaseApiKey; rawKey: string }> => {
  // Gerar uma chave aleatória
  const rawKey = crypto.randomBytes(32).toString('hex');
  
  // Criar um prefixo visível (primeiros 8 caracteres)
  const prefix = `mk_${crypto.randomBytes(4).toString('hex')}`;
  
  // Criar um hash da chave para armazenamento seguro
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  const apiKeyRef = db.collection(API_KEYS_COLLECTION).doc();
  const now = Timestamp.now();

  const apiKey: FirebaseApiKey = {
    id: apiKeyRef.id,
    name,
    description: options.description || null,
    key: keyHash,
    prefix,
    scopes: options.scopes || ["read"],
    userId,
    expiresAt: options.expiresAt ? Timestamp.fromDate(options.expiresAt) : null,
    lastUsedAt: null,
    usageCount: 0,
    ipRestrictions: options.ipRestrictions || null,
    isActive: true,
    revokedAt: null,
    revokedBy: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now
  };

  await apiKeyRef.set(apiKey);
  console.log(`API Key (ID: ${apiKey.id}, Prefix: ${prefix}) criada com sucesso.`);
  
  // Retornar a chave completa para o cliente (só será mostrada uma vez)
  const fullKey = `${prefix}_${rawKey}`;
  
  return { apiKey, rawKey: fullKey };
};

/**
 * Busca uma API Key pelo ID.
 */
export const getApiKeyById = async (apiKeyId: string): Promise<FirebaseApiKey | null> => {
  const docRef = db.collection(API_KEYS_COLLECTION).doc(apiKeyId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseApiKey;
  }
  console.warn(`API Key (ID: ${apiKeyId}) não encontrada.`);
  return null;
};

/**
 * Busca API Keys com opções de filtro.
 */
export const getApiKeys = async (
  options: {
    userId?: string;
    isActive?: boolean;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'createdAt' | 'lastUsedAt' | 'usageCount';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ apiKeys: FirebaseApiKey[]; total: number }> => {
  try {
    let query: any = db.collection(API_KEYS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'createdAt';
    const orderDirection = options.orderDirection || 'desc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let apiKeys: FirebaseApiKey[] = [];
    snapshot.forEach((doc: any) => {
      apiKeys.push(doc.data() as FirebaseApiKey);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTerm = options.searchTerm.toLowerCase();
      apiKeys = apiKeys.filter(apiKey => 
        apiKey.name.toLowerCase().includes(searchTerm) ||
        apiKey.prefix.toLowerCase().includes(searchTerm) ||
        (apiKey.description && apiKey.description.toLowerCase().includes(searchTerm))
      );
    }
    
    return { apiKeys, total };
  } catch (error) {
    console.error(`Erro ao buscar API Keys:`, error);
    throw error;
  }
};

/**
 * Atualiza uma API Key existente.
 */
export const updateApiKey = async (
  apiKeyId: string, 
  updates: Partial<Omit<FirebaseApiKey, "id" | "key" | "prefix" | "userId" | "createdAt" | "updatedAt" | "revokedAt" | "revokedBy" | "revokedReason">>
): Promise<FirebaseApiKey | null> => {
  const apiKeyRef = db.collection(API_KEYS_COLLECTION).doc(apiKeyId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await apiKeyRef.update(updateData);
    console.log(`API Key (ID: ${apiKeyId}) atualizada com sucesso.`);
    const updatedDoc = await apiKeyRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseApiKey : null;
  } catch (error) {
    console.error(`Erro ao atualizar API Key (ID: ${apiKeyId}):`, error);
    throw error;
  }
};

/**
 * Revoga uma API Key.
 */
export const revokeApiKey = async (
  apiKeyId: string,
  userId: string,
  reason?: string
): Promise<FirebaseApiKey | null> => {
  const apiKeyRef = db.collection(API_KEYS_COLLECTION).doc(apiKeyId);
  const now = Timestamp.now();
  
  const updateData = {
    isActive: false,
    revokedAt: now,
    revokedBy: userId,
    revokedReason: reason || null,
    updatedAt: now
  };

  try {
    await apiKeyRef.update(updateData);
    console.log(`API Key (ID: ${apiKeyId}) revogada com sucesso.`);
    const updatedDoc = await apiKeyRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseApiKey : null;
  } catch (error) {
    console.error(`Erro ao revogar API Key (ID: ${apiKeyId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma API Key.
 */
export const deleteApiKey = async (apiKeyId: string): Promise<void> => {
  const apiKeyRef = db.collection(API_KEYS_COLLECTION).doc(apiKeyId);
  try {
    await apiKeyRef.delete();
    console.log(`API Key (ID: ${apiKeyId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir API Key (ID: ${apiKeyId}):`, error);
    throw error;
  }
};

/**
 * Valida uma API Key.
 */
export const validateApiKey = async (
  apiKeyValue: string,
  options: {
    requiredScopes?: string[];
    ipAddress?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
  } = {}
): Promise<{ valid: boolean; apiKey?: FirebaseApiKey }> => {
  try {
    // Extrair o prefixo e a chave
    const parts = apiKeyValue.split('_');
    if (parts.length < 3) {
      return { valid: false };
    }
    
    const prefix = `${parts[0]}_${parts[1]}`;
    const rawKey = parts.slice(2).join('_');
    
    // Calcular o hash da chave
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    // Buscar a API Key pelo prefixo
    const snapshot = await db.collection(API_KEYS_COLLECTION)
      .where("prefix", "==", prefix)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return { valid: false };
    }
    
    const apiKey = snapshot.docs[0].data() as FirebaseApiKey;
    
    // Verificar se o hash corresponde
    if (apiKey.key !== keyHash) {
      return { valid: false };
    }
    
    // Verificar se a API Key está ativa
    if (!apiKey.isActive) {
      return { valid: false };
    }
    
    // Verificar se a API Key expirou
    if (apiKey.expiresAt && apiKey.expiresAt.toMillis() < Date.now()) {
      return { valid: false };
    }
    
    // Verificar restrições de IP
    if (options.ipAddress && apiKey.ipRestrictions && apiKey.ipRestrictions.length > 0) {
      if (!apiKey.ipRestrictions.includes(options.ipAddress)) {
        return { valid: false };
      }
    }
    
    // Verificar escopos necessários
    if (options.requiredScopes && options.requiredScopes.length > 0) {
      const hasAllRequiredScopes = options.requiredScopes.every(scope => 
        apiKey.scopes.includes(scope)
      );
      
      if (!hasAllRequiredScopes) {
        return { valid: false };
      }
    }
    
    // Atualizar contadores de uso
    const apiKeyRef = db.collection(API_KEYS_COLLECTION).doc(apiKey.id);
    await apiKeyRef.update({
      lastUsedAt: Timestamp.now(),
      usageCount: apiKey.usageCount + 1,
      updatedAt: Timestamp.now()
    });
    
    // Registrar o uso da API Key
    if (options.endpoint) {
      await logApiKeyUsage(
        apiKey.id,
        options.endpoint,
        options.method || "GET",
        options.statusCode || 200,
        options.ipAddress
      );
    }
    
    return { valid: true, apiKey };
  } catch (error) {
    console.error(`Erro ao validar API Key:`, error);
    return { valid: false };
  }
};

/**
 * Registra o uso de uma API Key.
 */
export const logApiKeyUsage = async (
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<FirebaseApiKeyUsageLog> => {
  const logRef = db.collection(API_KEY_USAGE_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const log: FirebaseApiKeyUsageLog = {
    id: logRef.id,
    apiKeyId,
    endpoint,
    method,
    statusCode,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    timestamp: now
  };

  await logRef.set(log);
  return log;
};

/**
 * Busca logs de uso de API Keys com opções de filtro.
 */
export const getApiKeyUsageLogs = async (
  options: {
    apiKeyId?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: FirebaseApiKeyUsageLog[]; total: number }> => {
  try {
    let query: any = db.collection(API_KEY_USAGE_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.apiKeyId) {
      query = query.where("apiKeyId", "==", options.apiKeyId);
    }
    
    if (options.endpoint) {
      query = query.where("endpoint", "==", options.endpoint);
    }
    
    if (options.method) {
      query = query.where("method", "==", options.method);
    }
    
    if (options.statusCode) {
      query = query.where("statusCode", "==", options.statusCode);
    }
    
    if (options.ipAddress) {
      query = query.where("ipAddress", "==", options.ipAddress);
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
    
    const logs: FirebaseApiKeyUsageLog[] = [];
    snapshot.forEach((doc: any) => {
      logs.push(doc.data() as FirebaseApiKeyUsageLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de uso de API Keys:`, error);
    throw error;
  }
};