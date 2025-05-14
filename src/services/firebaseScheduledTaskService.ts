import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para tarefas agendadas
export interface FirebaseScheduledTask {
  id: string;
  name: string;
  description?: string | null;
  type: string; // Tipo de tarefa (ex: "backup", "report", "cleanup")
  schedule: {
    frequency: "once" | "minutely" | "hourly" | "daily" | "weekly" | "monthly";
    minute?: number; // 0-59
    hour?: number; // 0-23
    dayOfMonth?: number; // 1-31
    dayOfWeek?: number; // 0-6 (domingo a sábado)
    month?: number; // 1-12
  };
  nextRunAt: Timestamp;
  lastRunAt?: Timestamp | null;
  parameters?: Record<string, any> | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseTaskExecutionLog {
  id: string;
  taskId: string;
  taskName: string;
  status: "success" | "failure" | "in_progress";
  startedAt: Timestamp;
  completedAt?: Timestamp | null;
  duration?: number | null; // em milissegundos
  result?: any | null;
  error?: string | null;
  metadata?: Record<string, any> | null;
}

const SCHEDULED_TASKS_COLLECTION = "scheduledTasks";
const TASK_EXECUTION_LOGS_COLLECTION = "taskExecutionLogs";

/**
 * Cria uma nova tarefa agendada.
 */
export const createScheduledTask = async (
  taskData: Omit<FirebaseScheduledTask, "id" | "createdAt" | "updatedAt" | "nextRunAt">
): Promise<FirebaseScheduledTask> => {
  const taskRef = db.collection(SCHEDULED_TASKS_COLLECTION).doc();
  const now = Timestamp.now();
  
  // Calcular a próxima execução
  const nextRunAt = calculateNextRun(taskData.schedule);
  
  const newTask: FirebaseScheduledTask = {
    id: taskRef.id,
    ...taskData,
    nextRunAt,
    createdAt: now,
    updatedAt: now
  };

  await taskRef.set(newTask);
  console.log(`Tarefa agendada (ID: ${newTask.id}, Nome: ${newTask.name}) criada com sucesso.`);
  return newTask;
};

/**
 * Busca uma tarefa agendada pelo ID.
 */
export const getScheduledTaskById = async (taskId: string): Promise<FirebaseScheduledTask | null> => {
  const docRef = db.collection(SCHEDULED_TASKS_COLLECTION).doc(taskId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseScheduledTask;
  }
  console.warn(`Tarefa agendada (ID: ${taskId}) não encontrada.`);
  return null;
};

/**
 * Busca tarefas agendadas com opções de filtro.
 */
export const getScheduledTasks = async (
  options: {
    type?: string;
    isActive?: boolean;
    createdBy?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'nextRunAt' | 'lastRunAt' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ tasks: FirebaseScheduledTask[]; total: number }> => {
  try {
    let query: any = db.collection(SCHEDULED_TASKS_COLLECTION);
    
    // Aplicar filtros
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'nextRunAt';
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
    
    let tasks: FirebaseScheduledTask[] = [];
    snapshot.forEach((doc: any) => {
      tasks.push(doc.data() as FirebaseScheduledTask);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTerm = options.searchTerm.toLowerCase();
      tasks = tasks.filter(task => 
        task.name.toLowerCase().includes(searchTerm) ||
        (task.description && task.description.toLowerCase().includes(searchTerm))
      );
    }
    
    return { tasks, total };
  } catch (error) {
    console.error(`Erro ao buscar tarefas agendadas:`, error);
    throw error;
  }
};

/**
 * Atualiza uma tarefa agendada existente.
 */
export const updateScheduledTask = async (
  taskId: string, 
  updates: Partial<Omit<FirebaseScheduledTask, "id" | "createdBy" | "createdAt" | "updatedAt">>
): Promise<FirebaseScheduledTask | null> => {
  const taskRef = db.collection(SCHEDULED_TASKS_COLLECTION).doc(taskId);
  const updateData = { 
    ...updates, 
    updatedAt: Timestamp.now() 
  };

  // Se o agendamento foi atualizado, recalcular a próxima execução
  if (updates.schedule) {
    updateData.nextRunAt = calculateNextRun(updates.schedule);
  }

  try {
    await taskRef.update(updateData);
    console.log(`Tarefa agendada (ID: ${taskId}) atualizada com sucesso.`);
    const updatedDoc = await taskRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseScheduledTask : null;
  } catch (error) {
    console.error(`Erro ao atualizar tarefa agendada (ID: ${taskId}):`, error);
    throw error;
  }
};

/**
 * Ativa uma tarefa agendada.
 */
export const activateScheduledTask = async (taskId: string): Promise<FirebaseScheduledTask | null> => {
  return updateScheduledTask(taskId, { isActive: true });
};

/**
 * Desativa uma tarefa agendada.
 */
export const deactivateScheduledTask = async (taskId: string): Promise<FirebaseScheduledTask | null> => {
  return updateScheduledTask(taskId, { isActive: false });
};

/**
 * Exclui uma tarefa agendada.
 */
export const deleteScheduledTask = async (taskId: string): Promise<void> => {
  const taskRef = db.collection(SCHEDULED_TASKS_COLLECTION).doc(taskId);
  try {
    await taskRef.delete();
    console.log(`Tarefa agendada (ID: ${taskId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir tarefa agendada (ID: ${taskId}):`, error);
    throw error;
  }
};

/**
 * Busca tarefas agendadas que devem ser executadas agora.
 */
export const getTasksDueForExecution = async (): Promise<FirebaseScheduledTask[]> => {
  try {
    const now = Timestamp.now();
    
    const snapshot = await db.collection(SCHEDULED_TASKS_COLLECTION)
      .where("isActive", "==", true)
      .where("nextRunAt", "<=", now)
      .get();
    
    const tasks: FirebaseScheduledTask[] = [];
    snapshot.forEach(doc => {
      tasks.push(doc.data() as FirebaseScheduledTask);
    });
    
    return tasks;
  } catch (error) {
    console.error(`Erro ao buscar tarefas para execução:`, error);
    throw error;
  }
};

/**
 * Atualiza a próxima execução de uma tarefa agendada.
 */
export const updateTaskNextRun = async (
  taskId: string,
  lastRunAt: Timestamp
): Promise<FirebaseScheduledTask | null> => {
  try {
    const task = await getScheduledTaskById(taskId);
    if (!task) {
      throw new Error(`Tarefa agendada (ID: ${taskId}) não encontrada.`);
    }
    
    // Calcular a próxima execução
    const nextRunAt = calculateNextRun(task.schedule, lastRunAt);
    
    return updateScheduledTask(taskId, {
      nextRunAt,
      lastRunAt
    });
  } catch (error) {
    console.error(`Erro ao atualizar próxima execução da tarefa (ID: ${taskId}):`, error);
    throw error;
  }
};

/**
 * Registra o início da execução de uma tarefa.
 */
export const logTaskExecutionStart = async (
  taskId: string,
  taskName: string,
  metadata?: Record<string, any> | null
): Promise<FirebaseTaskExecutionLog> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc();
  const now = Timestamp.now();

  const log: FirebaseTaskExecutionLog = {
    id: logRef.id,
    taskId,
    taskName,
    status: "in_progress",
    startedAt: now,
    completedAt: null,
    duration: null,
    result: null,
    error: null,
    metadata: metadata || null
  };

  await logRef.set(log);
  console.log(`Início da execução da tarefa (ID: ${taskId}, Nome: ${taskName}) registrado.`);
  return log;
};

/**
 * Registra o sucesso da execução de uma tarefa.
 */
export const logTaskExecutionSuccess = async (
  logId: string,
  result?: any | null
): Promise<FirebaseTaskExecutionLog> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  const now = Timestamp.now();
  
  // Obter o log atual para calcular a duração
  const logDoc = await logRef.get();
  if (!logDoc.exists) {
    throw new Error(`Log de execução (ID: ${logId}) não encontrado.`);
  }
  
  const log = logDoc.data() as FirebaseTaskExecutionLog;
  const duration = now.toMillis() - log.startedAt.toMillis();
  
  const updateData = {
    status: "success",
    completedAt: now,
    duration,
    result: result || null
  };
  
  await logRef.update(updateData);
  console.log(`Sucesso da execução da tarefa (ID: ${log.taskId}, Nome: ${log.taskName}) registrado.`);
  
  // Atualizar a próxima execução da tarefa
  await updateTaskNextRun(log.taskId, now);
  
  return {
    ...log,
    ...updateData
  } as FirebaseTaskExecutionLog;
};

/**
 * Registra a falha da execução de uma tarefa.
 */
export const logTaskExecutionFailure = async (
  logId: string,
  error: string
): Promise<FirebaseTaskExecutionLog> => {
  const logRef = db.collection(TASK_EXECUTION_LOGS_COLLECTION).doc(logId);
  const now = Timestamp.now();
  
  // Obter o log atual para calcular a duração
  const logDoc = await logRef.get();
  if (!logDoc.exists) {
    throw new Error(`Log de execução (ID: ${logId}) não encontrado.`);
  }
  
  const log = logDoc.data() as FirebaseTaskExecutionLog;
  const duration = now.toMillis() - log.startedAt.toMillis();
  
  const updateData = {
    status: "failure",
    completedAt: now,
    duration,
    error
  };
  
  await logRef.update(updateData);
  console.error(`Falha na execução da tarefa (ID: ${log.taskId}, Nome: ${log.taskName}): ${error}`);
  
  // Atualizar a próxima execução da tarefa
  await updateTaskNextRun(log.taskId, now);
  
  return {
    ...log,
    ...updateData
  } as FirebaseTaskExecutionLog;
};

/**
 * Busca logs de execução de tarefas com opções de filtro.
 */
export const getTaskExecutionLogs = async (
  options: {
    taskId?: string;
    status?: "success" | "failure" | "in_progress";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: FirebaseTaskExecutionLog[]; total: number }> => {
  try {
    let query: any = db.collection(TASK_EXECUTION_LOGS_COLLECTION);
    
    // Aplicar filtros
    if (options.taskId) {
      query = query.where("taskId", "==", options.taskId);
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
    query = query.orderBy("startedAt", "desc"); // Mais recentes primeiro
    
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
 * Calcula a próxima execução com base no agendamento.
 */
const calculateNextRun = (
  schedule: FirebaseScheduledTask["schedule"],
  lastRun?: Timestamp
): Timestamp => {
  const now = lastRun ? new Date(lastRun.toMillis()) : new Date();
  let nextRun = new Date(now);
  
  switch (schedule.frequency) {
    case "once":
      // Para tarefas de execução única, não há próxima execução
      // Definir uma data no futuro distante
      nextRun.setFullYear(nextRun.getFullYear() + 100);
      break;
      
    case "minutely":
      // Adicionar 1 minuto
      nextRun.setMinutes(nextRun.getMinutes() + 1);
      break;
      
    case "hourly":
      // Definir o minuto específico na próxima hora
      nextRun.setHours(nextRun.getHours() + 1);
      if (schedule.minute !== undefined) {
        nextRun.setMinutes(schedule.minute);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        
        // Se a hora atual já passou do minuto especificado, ajustar
        if (now.getMinutes() >= schedule.minute && lastRun === undefined) {
          nextRun.setHours(nextRun.getHours() + 1);
        }
      }
      break;
      
    case "daily":
      // Definir a hora e minuto específicos no próximo dia
      nextRun.setDate(nextRun.getDate() + 1);
      if (schedule.hour !== undefined) {
        nextRun.setHours(schedule.hour);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        
        // Se o dia atual ainda não chegou na hora especificada, ajustar para hoje
        if ((now.getHours() < schedule.hour || 
            (now.getHours() === schedule.hour && now.getMinutes() < (schedule.minute || 0))) && 
            lastRun === undefined) {
          nextRun.setDate(nextRun.getDate() - 1);
        }
      }
      break;
      
    case "weekly":
      // Definir o dia da semana, hora e minuto específicos
      const currentDay = now.getDay();
      const targetDay = schedule.dayOfWeek !== undefined ? schedule.dayOfWeek : currentDay;
      const daysToAdd = (targetDay + 7 - currentDay) % 7;
      
      nextRun.setDate(nextRun.getDate() + daysToAdd);
      if (schedule.hour !== undefined) {
        nextRun.setHours(schedule.hour);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        
        // Se estamos no dia certo mas ainda não chegou na hora, não adicionar 7 dias
        if (daysToAdd === 0 && 
            (now.getHours() < schedule.hour || 
            (now.getHours() === schedule.hour && now.getMinutes() < (schedule.minute || 0))) && 
            lastRun === undefined) {
          // Manter a data atual
        } else if (daysToAdd === 0) {
          // Se estamos no dia certo mas já passou da hora, adicionar 7 dias
          nextRun.setDate(nextRun.getDate() + 7);
        }
      }
      break;
      
    case "monthly":
      // Definir o dia do mês, hora e minuto específicos
      const targetDayOfMonth = schedule.dayOfMonth !== undefined ? schedule.dayOfMonth : now.getDate();
      
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(1); // Primeiro dia do próximo mês
      
      // Ajustar para o dia do mês desejado (ou o último dia se o dia for maior que o número de dias no mês)
      const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
      nextRun.setDate(Math.min(targetDayOfMonth, lastDayOfMonth));
      
      if (schedule.hour !== undefined) {
        nextRun.setHours(schedule.hour);
        nextRun.setMinutes(schedule.minute || 0);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        
        // Se estamos no mês atual e ainda não chegou no dia/hora, ajustar para o mês atual
        if (now.getDate() < targetDayOfMonth || 
            (now.getDate() === targetDayOfMonth && 
             (now.getHours() < schedule.hour || 
              (now.getHours() === schedule.hour && now.getMinutes() < (schedule.minute || 0)))) && 
            lastRun === undefined) {
          nextRun.setMonth(now.getMonth());
        }
      }
      break;
  }
  
  return Timestamp.fromDate(nextRun);
};