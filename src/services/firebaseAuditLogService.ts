import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para logs de auditoria
export enum FirebaseAuditLogAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  PERMISSION_CHANGE = "permission_change",
  ROLE_CHANGE = "role_change",
  PAYMENT_PROCESS = "payment_process",
  PAYMENT_REFUND = "payment_refund",
  SUBSCRIPTION_CHANGE = "subscription_change",
  CONTENT_APPROVAL = "content_approval",
  CONTENT_REJECTION = "content_rejection",
  SYSTEM_SETTING_CHANGE = "system_setting_change",
  USER_BLOCK = "user_block",
  USER_UNBLOCK = "user_unblock",
  DATA_EXPORT = "data_export",
  DATA_IMPORT = "data_import",
  BULK_ACTION = "bulk_action"
}

export enum FirebaseAuditLogSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}

export interface FirebaseAuditLog {
  id: string;
  userId: string;
  action: FirebaseAuditLogAction;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  severity: FirebaseAuditLogSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
}

const AUDIT_LOGS_COLLECTION = "auditLogs";

/**
 * Cria um novo log de auditoria.
 */
export const createAuditLog = async (
  logData: Omit<FirebaseAuditLog, "id" | "createdAt">
): Promise<FirebaseAuditLog> => {
  const logRef = db.collection(AUDIT_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newLog: FirebaseAuditLog = {
    id: logRef.id,
    ...logData,
    createdAt: now,
  };

  await logRef.set(newLog);
  console.log(`Log de auditoria (ID: ${newLog.id}) criado com sucesso para o usuário ${newLog.userId}.`);
  return newLog;
};

/**
 * Busca um log de auditoria pelo ID.
 */
export const getAuditLogById = async (logId: string): Promise<FirebaseAuditLog | null> => {
  const docRef = db.collection(AUDIT_LOGS_COLLECTION).doc(logId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseAuditLog;
  }
  console.warn(`Log de auditoria (ID: ${logId}) não encontrado.`);
  return null;
};

/**
 * Busca logs de auditoria com opções de filtro.
 */
export const getAuditLogs = async (
  options: {
    userId?: string;
    action?: FirebaseAuditLogAction;
    resourceType?: string;
    resourceId?: string;
    severity?: FirebaseAuditLogSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseAuditLog[]; total: number }> => {
  try {
    let query = db.collection(AUDIT_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.action) {
      query = query.where("action", "==", options.action);
    }
    
    if (options.resourceType) {
      query = query.where("resourceType", "==", options.resourceType);
    }
    
    if (options.resourceId) {
      query = query.where("resourceId", "==", options.resourceId);
    }
    
    if (options.severity) {
      query = query.where("severity", "==", options.severity);
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
    
    const logs: FirebaseAuditLog[] = [];
    snapshot.forEach(doc => {
      logs.push(doc.data() as FirebaseAuditLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de auditoria:`, error);
    throw error;
  }
};

/**
 * Busca logs de auditoria por ID de usuário.
 */
export const getAuditLogsByUserId = async (
  userId: string,
  options: {
    action?: FirebaseAuditLogAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseAuditLog[]; total: number }> => {
  return getAuditLogs({
    userId,
    ...options
  });
};

/**
 * Busca logs de auditoria por tipo de recurso e ID.
 */
export const getAuditLogsByResource = async (
  resourceType: string,
  resourceId: string,
  options: {
    action?: FirebaseAuditLogAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseAuditLog[]; total: number }> => {
  return getAuditLogs({
    resourceType,
    resourceId,
    ...options
  });
};

/**
 * Exclui um log de auditoria.
 * Normalmente, logs de auditoria não devem ser excluídos, mas esta função pode ser útil para fins de teste.
 */
export const deleteAuditLog = async (logId: string): Promise<void> => {
  const logRef = db.collection(AUDIT_LOGS_COLLECTION).doc(logId);
  try {
    await logRef.delete();
    console.log(`Log de auditoria (ID: ${logId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir log de auditoria (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Arquiva logs de auditoria antigos.
 * Esta função pode ser executada periodicamente por um job ou trigger.
 * @param olderThan Data antes da qual os logs serão arquivados
 * @param archiveCollection Nome da coleção de arquivo
 */
export const archiveOldAuditLogs = async (
  olderThan: Date,
  archiveCollection: string = "archivedAuditLogs"
): Promise<number> => {
  try {
    const olderThanTimestamp = Timestamp.fromDate(olderThan);
    
    // Devido a limitações do Firestore, precisamos buscar todos os documentos primeiro
    const snapshot = await db.collection(AUDIT_LOGS_COLLECTION)
      .where("createdAt", "<", olderThanTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum log de auditoria encontrado anterior a ${olderThan.toISOString()}.`);
      return 0;
    }
    
    // Arquivar e excluir em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    const totalLogs = snapshot.size;
    let processedLogs = 0;
    
    while (processedLogs < totalLogs) {
      const batch = db.batch();
      const currentBatch = snapshot.docs.slice(processedLogs, processedLogs + batchSize);
      
      currentBatch.forEach(doc => {
        const logData = doc.data() as FirebaseAuditLog;
        const archiveRef = db.collection(archiveCollection).doc(doc.id);
        batch.set(archiveRef, {
          ...logData,
          archivedAt: Timestamp.now()
        });
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      processedLogs += currentBatch.length;
      console.log(`Processados ${processedLogs}/${totalLogs} logs de auditoria antigos.`);
    }
    
    console.log(`${totalLogs} logs de auditoria anteriores a ${olderThan.toISOString()} arquivados.`);
    return totalLogs;
  } catch (error) {
    console.error(`Erro ao arquivar logs de auditoria antigos:`, error);
    throw error;
  }
};

/**
 * Registra um log de auditoria para criação de recurso.
 * Função de conveniência para criar um log de auditoria de criação.
 */
export const logResourceCreation = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  newState: Record<string, any>,
  description?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<FirebaseAuditLog> => {
  return createAuditLog({
    userId,
    action: FirebaseAuditLogAction.CREATE,
    resourceType,
    resourceId,
    description: description || `Criação de ${resourceType} (ID: ${resourceId})`,
    severity: FirebaseAuditLogSeverity.INFO,
    ipAddress,
    userAgent,
    previousState: null,
    newState,
    metadata
  });
};

/**
 * Registra um log de auditoria para atualização de recurso.
 * Função de conveniência para criar um log de auditoria de atualização.
 */
export const logResourceUpdate = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  previousState: Record<string, any>,
  newState: Record<string, any>,
  description?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<FirebaseAuditLog> => {
  return createAuditLog({
    userId,
    action: FirebaseAuditLogAction.UPDATE,
    resourceType,
    resourceId,
    description: description || `Atualização de ${resourceType} (ID: ${resourceId})`,
    severity: FirebaseAuditLogSeverity.INFO,
    ipAddress,
    userAgent,
    previousState,
    newState,
    metadata
  });
};

/**
 * Registra um log de auditoria para exclusão de recurso.
 * Função de conveniência para criar um log de auditoria de exclusão.
 */
export const logResourceDeletion = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  previousState: Record<string, any>,
  description?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<FirebaseAuditLog> => {
  return createAuditLog({
    userId,
    action: FirebaseAuditLogAction.DELETE,
    resourceType,
    resourceId,
    description: description || `Exclusão de ${resourceType} (ID: ${resourceId})`,
    severity: FirebaseAuditLogSeverity.WARNING,
    ipAddress,
    userAgent,
    previousState,
    newState: null,
    metadata
  });
};

/**
 * Registra um log de auditoria para alteração de permissão.
 * Função de conveniência para criar um log de auditoria de alteração de permissão.
 */
export const logPermissionChange = async (
  userId: string,
  targetUserId: string,
  previousPermissions: Record<string, any>,
  newPermissions: Record<string, any>,
  description?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<FirebaseAuditLog> => {
  return createAuditLog({
    userId,
    action: FirebaseAuditLogAction.PERMISSION_CHANGE,
    resourceType: "user",
    resourceId: targetUserId,
    description: description || `Alteração de permissões para usuário (ID: ${targetUserId})`,
    severity: FirebaseAuditLogSeverity.WARNING,
    ipAddress,
    userAgent,
    previousState: previousPermissions,
    newState: newPermissions,
    metadata
  });
};