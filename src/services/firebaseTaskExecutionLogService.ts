import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { FirebaseTaskExecutionLog } from "./firebaseScheduledTaskService";

const TASK_EXECUTION_LOGS_COLLECTION = "taskExecutionLogs";

/**
 * Cria um novo log de execução de tarefa.
 */
export const createTaskExecutionLog = async (
  logData: Omit<FirebaseTaskExecutionLog, "id" | "startedAt" | "status" | "completedAt" | "duration">,
  status: "in_progress" | "success" | "failure" = "in_progress"
): Promise<FirebaseTaskExecutionLog> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const newLog: FirebaseTaskExecutionLog = {
    id: logRef.id,
    ...logData,
    status,
    startedAt: now,
    completedAt: null,
    duration: null
  };

  await logRef.set(newLog);
  console.log(`Log de execução de tarefa (ID: ${newLog.id}, Tarefa: ${newLog.taskName}) criado com sucesso.`);
  return newLog;
};

/**
 * Busca um log de execução de tarefa pelo ID.
 */
export const getTaskExecutionLogById = async (logId: string): Promise<FirebaseTaskExecutionLog | null> => {
  const docRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseTaskExecutionLog;
  }
  console.warn(`Log de execução de tarefa (ID: ${logId}) não encontrado.`);
  return null;
};

/**
 * Busca logs de execução de tarefas com opções de filtro.
 */
export const getTaskExecutionLogs = async (
  options: {
    taskId?: string;
    taskName?: string;
    status?: "success" | "failure" | "in_progress";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderBy?: 'startedAt' | 'completedAt' | 'duration';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ logs: FirebaseTaskExecutionLog[]; total: number }> => {
  try {
    let query: any = db.collection(TASK_EXECUTION_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.taskId) {
      query = query.where("taskId", "==", options.taskId);
    }
    
    if (options.taskName) {
      query = query.where("taskName", "==", options.taskName);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("startedAt", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("startedAt", "<=", endTimestamp);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'startedAt';
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
    
    const logs: FirebaseTaskExecutionLog[] = [];
    snapshot.forEach((doc: any) => {
      logs.push(doc.data() as FirebaseTaskExecutionLog);
    });
    
    return { logs, total };
  } catch (error) {
    console.error(`Erro ao buscar logs de execução de tarefas:`, error);
    throw error;
  }
};

/**
 * Atualiza um log de execução de tarefa para status de sucesso.
 */
export const markTaskExecutionAsSuccess = async (
  logId: string,
  result?: any | null
): Promise<FirebaseTaskExecutionLog | null> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  const now = Timestamp.now();
  
  // Obter o log atual para calcular a duração
  const logDoc = await logRef.get();
  if (!logDoc.exists) {
    console.warn(`Log de execução de tarefa (ID: ${logId}) não encontrado para atualização.`);
    return null;
  }
  
  const log = logDoc.data() as FirebaseTaskExecutionLog;
  const duration = now.toMillis() - log.startedAt.toMillis();
  
  const updateData = {
    status: "success" as const,
    completedAt: now,
    duration,
    result: result || null
  };
  
  try {
    await logRef.update(updateData);
    console.log(`Log de execução de tarefa (ID: ${logId}) marcado como sucesso.`);
    
    return {
      ...log,
      ...updateData
    };
  } catch (error) {
    console.error(`Erro ao atualizar log de execução de tarefa (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Atualiza um log de execução de tarefa para status de falha.
 */
export const markTaskExecutionAsFailure = async (
  logId: string,
  error: string
): Promise<FirebaseTaskExecutionLog | null> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  const now = Timestamp.now();
  
  // Obter o log atual para calcular a duração
  const logDoc = await logRef.get();
  if (!logDoc.exists) {
    console.warn(`Log de execução de tarefa (ID: ${logId}) não encontrado para atualização.`);
    return null;
  }
  
  const log = logDoc.data() as FirebaseTaskExecutionLog;
  const duration = now.toMillis() - log.startedAt.toMillis();
  
  const updateData = {
    status: "failure" as const,
    completedAt: now,
    duration,
    error
  };
  
  try {
    await logRef.update(updateData);
    console.error(`Log de execução de tarefa (ID: ${logId}) marcado como falha: ${error}`);
    
    return {
      ...log,
      ...updateData
    };
  } catch (error) {
    console.error(`Erro ao atualizar log de execução de tarefa (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Atualiza metadados de um log de execução de tarefa.
 */
export const updateTaskExecutionMetadata = async (
  logId: string,
  metadata: Record<string, any>
): Promise<FirebaseTaskExecutionLog | null> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  
  try {
    await logRef.update({ metadata });
    console.log(`Metadados do log de execução de tarefa (ID: ${logId}) atualizados.`);
    
    const updatedDoc = await logRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseTaskExecutionLog : null;
  } catch (error) {
    console.error(`Erro ao atualizar metadados do log de execução de tarefa (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Exclui um log de execução de tarefa.
 */
export const deleteTaskExecutionLog = async (logId: string): Promise<void> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  try {
    await logRef.delete();
    console.log(`Log de execução de tarefa (ID: ${logId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir log de execução de tarefa (ID: ${logId}):`, error);
    throw error;
  }
};

/**
 * Limpa logs de execução de tarefas antigos.
 */
export const cleanupOldTaskExecutionLogs = async (
  olderThanDays: number = 30
): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
    
    const snapshot = await db.collection(TASK_EXECUTION_LOGS_COLLECTION)
      .where("startedAt", "<", cutoffTimestamp)
      .get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`${snapshot.size} logs de execução de tarefas antigos foram limpos.`);
    return snapshot.size;
  } catch (error) {
    console.error(`Erro ao limpar logs de execução de tarefas antigos:`, error);
    throw error;
  }
};

/**
 * Obtém estatísticas de execução de tarefas.
 */
export const getTaskExecutionStats = async (
  options: {
    taskId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
  averageDuration?: number | null;
}> => {
  try {
    let query: any = db.collection(TASK_EXECUTION_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.taskId) {
      query = query.where("taskId", "==", options.taskId);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("startedAt", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("startedAt", "<=", endTimestamp);
    }
    
    const snapshot = await query.get();
    
    let successCount = 0;
    let failureCount = 0;
    let inProgressCount = 0;
    let totalDuration = 0;
    let completedCount = 0;
    
    snapshot.forEach((doc: any) => {
      const log = doc.data() as FirebaseTaskExecutionLog;
      
      switch (log.status) {
        case "success":
          successCount++;
          if (log.duration) {
            totalDuration += log.duration;
            completedCount++;
          }
          break;
        case "failure":
          failureCount++;
          if (log.duration) {
            totalDuration += log.duration;
            completedCount++;
          }
          break;
        case "in_progress":
          inProgressCount++;
          break;
      }
    });
    
    const totalExecutions = snapshot.size;
    const averageDuration = completedCount > 0 ? totalDuration / completedCount : null;
    
    return {
      totalExecutions,
      successCount,
      failureCount,
      inProgressCount,
      averageDuration
    };
  } catch (error) {
    console.error(`Erro ao obter estatísticas de execução de tarefas:`, error);
    throw error;
  }
};