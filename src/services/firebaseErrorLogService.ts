import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para logs de erro
export enum FirebaseErrorLogSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
  FATAL = "fatal"
}

export enum FirebaseErrorLogSource {
  CLIENT = "client",
  SERVER = "server",
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  PAYMENT_GATEWAY = "payment_gateway",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  FILE_SYSTEM = "file_system",
  SCHEDULED_JOB = "scheduled_job",
  WEBHOOK = "webhook",
  UNKNOWN = "unknown"
}

export interface FirebaseErrorLog {
  id: string;
  userId?: string | null;
  message: string;
  stack?: string | null;
  code?: string | null;
  source: FirebaseErrorLogSource;
  severity: FirebaseErrorLogSeverity;
  context?: Record<string, any> | null;
  url?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resolved: boolean;
  resolvedAt?: Timestamp | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  createdAt: Timestamp;
}

const ERROR_LOGS_COLLECTION = "errorLogs";

/**
 * Cria um novo log de erro.
 */
export const createErrorLog = async (
  logData: Omit<FirebaseErrorLog, "id" | "resolved" | "resolvedAt" | "resolvedBy" | "resolutionNotes" | "createdAt">
): Promise<FirebaseErrorLog> => {
  const logRef = db.collection(ERROR_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newLog: FirebaseErrorLog = {
    id: logRef.id,
    ...logData,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNotes: null,
    createdAt: now,
  };

  await logRef.set(newLog);
  console.log(`Log de erro (ID: ${newLog.id}) criado com sucesso.`);
  return newLog;
};

/**
 * Busca um log de erro pelo ID.
 */
export const getErrorLogById = async (logId: string): Promise<FirebaseErrorLog | null> => {
  const docRef = db.collection(ERROR_LOGS_COLLECTION).doc(logId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseErrorLog;
  }
  console.warn(`Log de erro (ID: ${logId}) não encontrado.`);
  return null;
};

/**
 * Busca logs de erro com opções de filtro.
 */
export const getErrorLogs = async (
  options: {
    userId?: string;
    source?: FirebaseErrorLogSource;
    severity?: FirebaseErrorLogSeverity;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseErrorLog[]; total: number }> => {
  try {
    let query = db.collection(ERROR_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.source) {
      query = query.where("source", "==", options.source);
    }
    
    if (options.severity) {
      query = query.where("severity", "==", options.severity);
    }
    
    if (options.resolved !== undefined) {
      query = query.where("resolved", "==", options.resolved);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("createdAt", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("createdAt", "<=", endTimestamp);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    if (options.orderByCreatedAt) {
      query = query.orderBy("createdAt", options.orderByCreatedAt);
    } else {
      query = query.orderBy("createdAt", "desc"); // Padrão: mais recentes primeiro
    }
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const logs: FirebaseErrorLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseErrorLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de erro:`, error);
    throw error;
  }
};

/**
 * Marca um log de erro como resolvido.
 */
export const resolveErrorLog = async (
  logId: string,
  resolvedBy: string,
  resolutionNotes?: string
): Promise<FirebaseErrorLog | null> => {
  const logRef = db.collection(ERROR_LOGS_COLLECTION).doc(logId);
  const now = Timestamp.now();
  
  try {
    await logRef.update({
      resolved: true,
      resolvedAt: now,
      resolvedBy,
      resolutionNotes: resolutionNotes || null
    });
    
    console.log(`Log de erro (ID: ${logId}) marcado como resolvido.`);
    const updatedDoc = await logRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseErrorLog : null;
  } catch (error) {
    console.error(`Erro ao marcar log de erro (ID: ${logId}) como resolvido:`, error);
    throw error;
  }
};

/**
 * Atualiza um log de erro existente.
 */
export const updateErrorLog = async (
  logId: string, 
  updates: Partial<Omit<FirebaseErrorLog, "id" | "createdAt">>
): Promise<FirebaseErrorLog | null> => {
  const logRef = db.collection(ERROR_LOGS_COLLECTION).doc(logId);

  try {
    await logRef.update(updates);
    console.log(`Log de erro (ID: ${logId}) atualizado com sucesso.`);
    const updatedDoc = await logRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseErrorLog : null;
  } catch (error) {
    console.error(`Erro ao atualizar log de erro (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Exclui um log de erro.
 */
export const deleteErrorLog = async (logId: string): Promise<void> => {
  const logRef = db.collection(ERROR_LOGS_COLLECTION).doc(logId);
  try {
    await logRef.delete();
    console.log(`Log de erro (ID: ${logId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir log de erro (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Exclui logs de erro resolvidos antigos.
 * Esta função pode ser executada periodicamente por um job ou trigger.
 * @param olderThan Data antes da qual os logs resolvidos serão excluídos
 */
export const cleanupResolvedErrorLogs = async (olderThan: Date): Promise<number> => {
  try {
    const olderThanTimestamp = Timestamp.fromDate(olderThan);
    
    // Devido a limitações do Firestore, precisamos buscar todos os documentos primeiro
    const snapshot = await db.collection(ERROR_LOGS_COLLECTION)
      .where("resolved", "==", true)
      .where("resolvedAt", "<", olderThanTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum log de erro resolvido encontrado anterior a ${olderThan.toISOString()}.`);
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
      console.log(`Processados ${processedLogs}/${totalLogs} logs de erro resolvidos.`);
    }
    
    console.log(`${totalLogs} logs de erro resolvidos anteriores a ${olderThan.toISOString()} excluídos.`);
    return totalLogs;
  } catch (error) {
    console.error(`Erro ao limpar logs de erro resolvidos antigos:`, error);
    throw error;
  }
};

/**
 * Registra um erro do cliente.
 * Função de conveniência para criar um log de erro do cliente.
 */
export const logClientError = async (
  message: string,
  stack?: string,
  userId?: string,
  url?: string,
  userAgent?: string,
  ipAddress?: string,
  context?: Record<string, any>
): Promise<FirebaseErrorLog> => {
  return createErrorLog({
    userId,
    message,
    stack,
    source: FirebaseErrorLogSource.CLIENT,
    severity: FirebaseErrorLogSeverity.ERROR,
    url,
    userAgent,
    ipAddress,
    context
  });
};

/**
 * Registra um erro do servidor.
 * Função de conveniência para criar um log de erro do servidor.
 */
export const logServerError = async (
  message: string,
  stack?: string,
  code?: string,
  userId?: string,
  severity: FirebaseErrorLogSeverity = FirebaseErrorLogSeverity.ERROR,
  context?: Record<string, any>
): Promise<FirebaseErrorLog> => {
  return createErrorLog({
    userId,
    message,
    stack,
    code,
    source: FirebaseErrorLogSource.SERVER,
    severity,
    context
  });
};

/**
 * Registra um erro de API externa.
 * Função de conveniência para criar um log de erro de API externa.
 */
export const logExternalApiError = async (
  message: string,
  apiName: string,
  endpoint: string,
  statusCode?: number,
  responseBody?: any,
  userId?: string,
  severity: FirebaseErrorLogSeverity = FirebaseErrorLogSeverity.ERROR
): Promise<FirebaseErrorLog> => {
  return createErrorLog({
    userId,
    message,
    source: FirebaseErrorLogSource.EXTERNAL_API,
    severity,
    context: {
      apiName,
      endpoint,
      statusCode,
      responseBody
    }
  });
};

/**
 * Registra um erro de gateway de pagamento.
 * Função de conveniência para criar um log de erro de gateway de pagamento.
 */
export const logPaymentGatewayError = async (
  message: string,
  gatewayName: string,
  transactionId?: string,
  errorCode?: string,
  errorResponse?: any,
  userId?: string,
  severity: FirebaseErrorLogSeverity = FirebaseErrorLogSeverity.ERROR
): Promise<FirebaseErrorLog> => {
  return createErrorLog({
    userId,
    message,
    code: errorCode,
    source: FirebaseErrorLogSource.PAYMENT_GATEWAY,
    severity,
    context: {
      gatewayName,
      transactionId,
      errorResponse
    }
  });
};