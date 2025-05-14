import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para logs
export enum FirebaseLogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}

export enum FirebaseLogSource {
  API = "api",
  FRONTEND = "frontend",
  BACKEND = "backend",
  CRON = "cron",
  WEBHOOK = "webhook",
  PAYMENT = "payment",
  NOTIFICATION = "notification",
  SYSTEM = "system"
}

export interface FirebaseLog {
  id: string;
  level: FirebaseLogLevel;
  source: FirebaseLogSource;
  message: string;
  details?: Record<string, any> | null;
  userId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  url?: string | null;
  timestamp: Timestamp;
}

const LOGS_COLLECTION = "logs";

/**
 * Registra um log.
 */
export const logMessage = async (
  level: FirebaseLogLevel,
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  const logRef = db.collection(LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const log: FirebaseLog = {
    id: logRef.id,
    level,
    source,
    message,
    details: details || null,
    userId: userId || null,
    sessionId: sessionId || null,
    requestId: requestId || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    url: url || null,
    timestamp: now
  };

  await logRef.set(log);
  return log;
};

/**
 * Registra um log de nível DEBUG.
 */
export const logDebug = async (
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.DEBUG,
    source,
    message,
    details,
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Registra um log de nível INFO.
 */
export const logInfo = async (
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.INFO,
    source,
    message,
    details,
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Registra um log de nível WARNING.
 */
export const logWarning = async (
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.WARNING,
    source,
    message,
    details,
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Registra um log de nível ERROR.
 */
export const logError = async (
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.ERROR,
    source,
    message,
    details,
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Registra um log de nível CRITICAL.
 */
export const logCritical = async (
  source: FirebaseLogSource,
  message: string,
  details?: Record<string, any> | null,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.CRITICAL,
    source,
    message,
    details,
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Registra um erro com stack trace.
 */
export const logException = async (
  source: FirebaseLogSource,
  error: Error,
  userId?: string | null,
  sessionId?: string | null,
  requestId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  url?: string | null
): Promise<FirebaseLog> => {
  return logMessage(
    FirebaseLogLevel.ERROR,
    source,
    error.message,
    {
      stack: error.stack,
      name: error.name
    },
    userId,
    sessionId,
    requestId,
    ipAddress,
    userAgent,
    url
  );
};

/**
 * Busca logs com opções de filtro.
 */
export const getLogs = async (
  options: {
    level?: FirebaseLogLevel;
    source?: FirebaseLogSource;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByTimestamp?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseLog[]; total: number }> => {
  try {
    let query = db.collection(LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.level) {
      query = query.where("level", "==", options.level);
    }
    
    if (options.source) {
      query = query.where("source", "==", options.source);
    }
    
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.sessionId) {
      query = query.where("sessionId", "==", options.sessionId);
    }
    
    if (options.requestId) {
      query = query.where("requestId", "==", options.requestId);
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
    if (options.orderByTimestamp) {
      query = query.orderBy("timestamp", options.orderByTimestamp);
    } else {
      query = query.orderBy("timestamp", "desc"); // Padrão: mais recentes primeiro
    }
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const logs: FirebaseLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs:`, error);
    throw error;
  }
};

/**
 * Limpa logs antigos.
 * Esta função deve ser executada periodicamente.
 */
export const cleanupOldLogs = async (olderThan: Date): Promise<number> => {
  try {
    const olderThanTimestamp = Timestamp.fromDate(olderThan);
    
    const snapshot = await db.collection(LOGS_COLLECTION)
      .where("timestamp", "<", olderThanTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum log encontrado anterior a ${olderThan.toISOString()}.`);
      return 0;
    }
    
    // Excluir em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    const totalLogs = snapshot.size;
    let processedLogs = 0;
    
    while (processedLogs < totalLogs) {
      const batch = db.batch();
      const currentBatch = snapshot.docs.slice(processedLogs, processedLogs + batchSize);
      
      currentBatch.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      processedLogs += currentBatch.length;
    }
    
    console.log(`${totalLogs} logs anteriores a ${olderThan.toISOString()} excluídos.`);
    return totalLogs;
  } catch (error) {
    console.error(`Erro ao limpar logs antigos:`, error);
    throw error;
  }
};