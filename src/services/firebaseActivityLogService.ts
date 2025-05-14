import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para logs de atividade
export enum FirebaseActivityLogType {
  LOGIN = "login",
  LOGOUT = "logout",
  REGISTRATION = "registration",
  PASSWORD_RESET = "password_reset",
  PROFILE_UPDATE = "profile_update",
  PAYMENT = "payment",
  SUBSCRIPTION = "subscription",
  CONTENT_VIEW = "content_view",
  CONTENT_CREATE = "content_create",
  CONTENT_UPDATE = "content_update",
  CONTENT_DELETE = "content_delete",
  QUESTION_ANSWER = "question_answer",
  EXAM_START = "exam_start",
  EXAM_COMPLETE = "exam_complete",
  MENTORSHIP_SESSION = "mentorship_session",
  ADMIN_ACTION = "admin_action",
  ERROR = "error"
}

export interface FirebaseActivityLog {
  id: string;
  userId: string;
  type: FirebaseActivityLogType;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  relatedId?: string | null;
  relatedType?: string | null;
  createdAt: Timestamp;
}

const ACTIVITY_LOGS_COLLECTION = "activityLogs";

/**
 * Cria um novo log de atividade.
 */
export const createActivityLog = async (
  logData: Omit<FirebaseActivityLog, "id" | "createdAt">
): Promise<FirebaseActivityLog> => {
  const logRef = db.collection(ACTIVITY_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newLog: FirebaseActivityLog = {
    id: logRef.id,
    ...logData,
    createdAt: now,
  };

  await logRef.set(newLog);
  console.log(`Log de atividade (ID: ${newLog.id}) criado com sucesso para o usuário ${newLog.userId}.`);
  return newLog;
};

/**
 * Busca um log de atividade pelo ID.
 */
export const getActivityLogById = async (logId: string): Promise<FirebaseActivityLog | null> => {
  const docRef = db.collection(ACTIVITY_LOGS_COLLECTION).doc(logId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseActivityLog;
  }
  console.warn(`Log de atividade (ID: ${logId}) não encontrado.`);
  return null;
};

/**
 * Busca logs de atividade por ID de usuário com opções de filtro.
 */
export const getActivityLogsByUserId = async (
  userId: string,
  options: {
    type?: FirebaseActivityLogType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseActivityLog[]; total: number }> => {
  try {
    let query = db.collection(ACTIVITY_LOGS_COLLECTION)
      .where("userId", "==", userId);
    
    if (options.type) {
      query = query.where("type", "==", options.type);
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
    
    const logs: FirebaseActivityLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseActivityLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de atividade para o usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Busca logs de atividade por tipo com opções de filtro.
 */
export const getActivityLogsByType = async (
  type: FirebaseActivityLogType,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseActivityLog[]; total: number }> => {
  try {
    let query = db.collection(ACTIVITY_LOGS_COLLECTION)
      .where("type", "==", type);
    
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
    
    const logs: FirebaseActivityLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseActivityLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de atividade do tipo ${type}:`, error);
    throw error;
  }
};

/**
 * Busca logs de atividade relacionados a um ID específico.
 */
export const getActivityLogsByRelatedId = async (
  relatedId: string,
  options: {
    relatedType?: string;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseActivityLog[]; total: number }> => {
  try {
    let query = db.collection(ACTIVITY_LOGS_COLLECTION)
      .where("relatedId", "==", relatedId);
    
    if (options.relatedType) {
      query = query.where("relatedType", "==", options.relatedType);
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
    
    const logs: FirebaseActivityLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseActivityLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de atividade relacionados ao ID ${relatedId}:`, error);
    throw error;
  }
};

/**
 * Exclui um log de atividade.
 * Normalmente, logs não devem ser excluídos, mas esta função pode ser útil para fins de teste ou GDPR.
 */
export const deleteActivityLog = async (logId: string): Promise<void> => {
  const logRef = db.collection(ACTIVITY_LOGS_COLLECTION).doc(logId);
  try {
    await logRef.delete();
    console.log(`Log de atividade (ID: ${logId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir log de atividade (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Exclui todos os logs de atividade de um usuário.
 * Útil para conformidade com GDPR ou exclusão de conta.
 */
export const deleteAllUserActivityLogs = async (userId: string): Promise<number> => {
  try {
    // Devido a limitações do Firestore, precisamos buscar todos os documentos primeiro
    const snapshot = await db.collection(ACTIVITY_LOGS_COLLECTION)
      .where("userId", "==", userId)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum log de atividade encontrado para o usuário (ID: ${userId}).`);
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
      console.log(`Processados ${processedLogs}/${totalLogs} logs de atividade.`);
    }
    
    console.log(`${totalLogs} logs de atividade excluídos para o usuário (ID: ${userId}).`);
    return totalLogs;
  } catch (error) {
    console.error(`Erro ao excluir todos os logs de atividade do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Limpa logs de atividade antigos.
 * Esta função pode ser executada periodicamente por um job ou trigger.
 * @param olderThan Data antes da qual os logs serão excluídos
 */
export const cleanupOldActivityLogs = async (olderThan: Date): Promise<number> => {
  try {
    const olderThanTimestamp = Timestamp.fromDate(olderThan);
    
    // Devido a limitações do Firestore, precisamos buscar todos os documentos primeiro
    const snapshot = await db.collection(ACTIVITY_LOGS_COLLECTION)
      .where("createdAt", "<", olderThanTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum log de atividade encontrado anterior a ${olderThan.toISOString()}.`);
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
      console.log(`Processados ${processedLogs}/${totalLogs} logs de atividade antigos.`);
    }
    
    console.log(`${totalLogs} logs de atividade anteriores a ${olderThan.toISOString()} excluídos.`);
    return totalLogs;
  } catch (error) {
    console.error(`Erro ao limpar logs de atividade antigos:`, error);
    throw error;
  }
};

/**
 * Registra um log de login.
 * Função de conveniência para criar um log de atividade de login.
 */
export const logUserLogin = async (
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  deviceInfo?: Record<string, any>
): Promise<FirebaseActivityLog> => {
  return createActivityLog({
    userId,
    type: FirebaseActivityLogType.LOGIN,
    description: "Usuário realizou login",
    ipAddress,
    userAgent,
    deviceInfo,
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Registra um log de logout.
 * Função de conveniência para criar um log de atividade de logout.
 */
export const logUserLogout = async (
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<FirebaseActivityLog> => {
  return createActivityLog({
    userId,
    type: FirebaseActivityLogType.LOGOUT,
    description: "Usuário realizou logout",
    ipAddress,
    userAgent,
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Registra um log de erro.
 * Função de conveniência para criar um log de atividade de erro.
 */
export const logError = async (
  userId: string,
  errorMessage: string,
  errorStack?: string,
  metadata?: Record<string, any>
): Promise<FirebaseActivityLog> => {
  return createActivityLog({
    userId,
    type: FirebaseActivityLogType.ERROR,
    description: errorMessage,
    metadata: {
      errorStack,
      timestamp: new Date().toISOString(),
      ...metadata
    }
  });
};

/**
 * Registra um log de pagamento.
 * Função de conveniência para criar um log de atividade de pagamento.
 */
export const logPayment = async (
  userId: string,
  paymentId: string,
  paymentStatus: string,
  amount: number,
  currency: string,
  paymentMethod: string,
  metadata?: Record<string, any>
): Promise<FirebaseActivityLog> => {
  return createActivityLog({
    userId,
    type: FirebaseActivityLogType.PAYMENT,
    description: `Pagamento ${paymentStatus}: ${amount} ${currency} via ${paymentMethod}`,
    relatedId: paymentId,
    relatedType: "payment",
    metadata: {
      paymentId,
      paymentStatus,
      amount,
      currency,
      paymentMethod,
      timestamp: new Date().toISOString(),
      ...metadata
    }
  });
};