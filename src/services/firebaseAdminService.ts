import { firestore as db } from "../config/firebaseAdmin";
import { auth } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { UserRole } from "../types/firebaseTypes";

// Definição de tipos para administração
export interface FirebaseAdminAction {
  id: string;
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  status: "success" | "failure" | "pending";
  errorMessage?: string | null;
  createdAt: Timestamp;
}

export interface FirebaseAdminTask {
  id: string;
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseAdminStats {
  id: string;
  date: string; // formato: YYYY-MM-DD
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  totalPayments: number;
  totalRevenue: number;
  activeSubscriptions: number;
  contentCount: Record<string, number>;
  updatedAt: Timestamp;
}

const ADMIN_ACTIONS_COLLECTION = "adminActions";
const ADMIN_TASKS_COLLECTION = "adminTasks";
const ADMIN_STATS_COLLECTION = "adminStats";

/**
 * Registra uma ação administrativa.
 */
export const logAdminAction = async (
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, any>,
  status: "success" | "failure" | "pending" = "success",
  errorMessage?: string
): Promise<FirebaseAdminAction> => {
  const actionRef = db.collection(ADMIN_ACTIONS_COLLECTION).doc();
  const now = Timestamp.now();

  const action: FirebaseAdminAction = {
    id: actionRef.id,
    adminId,
    actionType,
    targetType,
    targetId,
    details,
    status,
    errorMessage: errorMessage || null,
    createdAt: now
  };

  await actionRef.set(action);
  console.log(`Ação administrativa (ID: ${action.id}) registrada com sucesso.`);
  return action;
};

/**
 * Busca ações administrativas com opções de filtro.
 */
export const getAdminActions = async (
  options: {
    adminId?: string;
    actionType?: string;
    targetType?: string;
    targetId?: string;
    status?: "success" | "failure" | "pending";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ actions: FirebaseAdminAction[]; total: number }> => {
  try {
    let query = db.collection(ADMIN_ACTIONS_COLLECTION);
    
    // Aplicar filtros
    if (options.adminId) {
      query = query.where("adminId", "==", options.adminId);
    }
    
    if (options.actionType) {
      query = query.where("actionType", "==", options.actionType);
    }
    
    if (options.targetType) {
      query = query.where("targetType", "==", options.targetType);
    }
    
    if (options.targetId) {
      query = query.where("targetId", "==", options.targetId);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
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
    
    const actions: FirebaseAdminAction[] = [];
    snapshot.forEach(doc => {
      actions.push(doc.data() as FirebaseAdminAction);
    });
    
    return { actions, total };
  } catch (error) {
    console.error(`Erro ao buscar ações administrativas:`, error);
    throw error;
  }
};

/**
 * Cria uma nova tarefa administrativa.
 */
export const createAdminTask = async (
  taskData: Omit<FirebaseAdminTask, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseAdminTask> => {
  const taskRef = db.collection(ADMIN_TASKS_COLLECTION).doc();
  const now = Timestamp.now();

  const newTask: FirebaseAdminTask = {
    id: taskRef.id,
    ...taskData,
    createdAt: now,
    updatedAt: now,
  };

  await taskRef.set(newTask);
  console.log(`Tarefa administrativa (ID: ${newTask.id}) criada com sucesso.`);
  return newTask;
};

/**
 * Busca uma tarefa administrativa pelo ID.
 */
export const getAdminTaskById = async (taskId: string): Promise<FirebaseAdminTask | null> => {
  const docRef = db.collection(ADMIN_TASKS_COLLECTION).doc(taskId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseAdminTask;
  }
  console.warn(`Tarefa administrativa (ID: ${taskId}) não encontrada.`);
  return null;
};

/**
 * Busca tarefas administrativas com opções de filtro.
 */
export const getAdminTasks = async (
  options: {
    assignedTo?: string;
    status?: "pending" | "in_progress" | "completed" | "cancelled";
    priority?: "low" | "medium" | "high" | "urgent";
    createdBy?: string;
    dueBeforeDate?: Date;
    dueAfterDate?: Date;
    limit?: number;
    offset?: number;
    orderBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ tasks: FirebaseAdminTask[]; total: number }> => {
  try {
    let query = db.collection(ADMIN_TASKS_COLLECTION);
    
    // Aplicar filtros
    if (options.assignedTo) {
      query = query.where("assignedTo", "==", options.assignedTo);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.priority) {
      query = query.where("priority", "==", options.priority);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    // Filtrar por data de vencimento
    if (options.dueBeforeDate) {
      const beforeTimestamp = Timestamp.fromDate(options.dueBeforeDate);
      query = query.where("dueDate", "<=", beforeTimestamp);
    }
    
    if (options.dueAfterDate) {
      const afterTimestamp = Timestamp.fromDate(options.dueAfterDate);
      query = query.where("dueDate", ">=", afterTimestamp);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'dueDate';
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
    
    const tasks: FirebaseAdminTask[] = [];
    snapshot.forEach(doc => {
      tasks.push(doc.data() as FirebaseAdminTask);
    });
    
    return { tasks, total };
  } catch (error) {
    console.error(`Erro ao buscar tarefas administrativas:`, error);
    throw error;
  }
};

/**
 * Atualiza uma tarefa administrativa existente.
 */
export const updateAdminTask = async (
  taskId: string, 
  updates: Partial<Omit<FirebaseAdminTask, "id" | "createdAt" | "createdBy">>
): Promise<FirebaseAdminTask | null> => {
  const taskRef = db.collection(ADMIN_TASKS_COLLECTION).doc(taskId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  // Se estiver marcando como concluída, adicionar timestamp de conclusão
  if (updates.status === "completed" && !updates.completedAt) {
    updateData.completedAt = Timestamp.now();
  }

  try {
    await taskRef.update(updateData);
    console.log(`Tarefa administrativa (ID: ${taskId}) atualizada com sucesso.`);
    const updatedDoc = await taskRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseAdminTask : null;
  } catch (error) {
    console.error(`Erro ao atualizar tarefa administrativa (ID: ${taskId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma tarefa administrativa.
 */
export const deleteAdminTask = async (taskId: string): Promise<void> => {
  const taskRef = db.collection(ADMIN_TASKS_COLLECTION).doc(taskId);
  try {
    await taskRef.delete();
    console.log(`Tarefa administrativa (ID: ${taskId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir tarefa administrativa (ID: ${taskId}):`, error);
    throw error;
  }
};

/**
 * Gera estatísticas administrativas diárias.
 * Esta função deve ser executada periodicamente (por exemplo, uma vez por dia).
 */
export const generateAdminStats = async (date: Date = new Date()): Promise<FirebaseAdminStats> => {
  try {
    // Formatar a data como YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    
    // Definir o intervalo de tempo para o dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 1. Contar usuários totais
    const { users: allUsers } = await auth.listUsers();
    const totalUsers = allUsers.length;
    
    // 2. Contar novos usuários (criados no dia)
    const newUsers = allUsers.filter(user => {
      const creationTime = new Date(user.metadata.creationTime);
      return creationTime >= startOfDay && creationTime <= endOfDay;
    }).length;
    
    // 3. Contar usuários ativos (que fizeram login no dia)
    const activeUsers = allUsers.filter(user => {
      if (!user.metadata.lastSignInTime) return false;
      const lastSignInTime = new Date(user.metadata.lastSignInTime);
      return lastSignInTime >= startOfDay && lastSignInTime <= endOfDay;
    }).length;
    
    // 4. Contar pagamentos e receita (simplificado - em um caso real, você consultaria a coleção de pagamentos)
    const totalPayments = 0;
    const totalRevenue = 0;
    
    // 5. Contar assinaturas ativas (simplificado - em um caso real, você consultaria a coleção de assinaturas)
    const activeSubscriptions = 0;
    
    // 6. Contar conteúdo por tipo (simplificado - em um caso real, você consultaria as coleções de conteúdo)
    const contentCount: Record<string, number> = {
      articles: 0,
      videos: 0,
      courses: 0,
      questions: 0
    };
    
    // Criar ou atualizar o documento de estatísticas
    const statsRef = db.collection(ADMIN_STATS_COLLECTION).doc(dateString);
    const now = Timestamp.now();
    
    const stats: FirebaseAdminStats = {
      id: dateString,
      date: dateString,
      totalUsers,
      newUsers,
      activeUsers,
      totalPayments,
      totalRevenue,
      activeSubscriptions,
      contentCount,
      updatedAt: now
    };
    
    await statsRef.set(stats);
    console.log(`Estatísticas administrativas para ${dateString} geradas com sucesso.`);
    
    return stats;
  } catch (error) {
    console.error(`Erro ao gerar estatísticas administrativas:`, error);
    throw error;
  }
};

/**
 * Busca estatísticas administrativas.
 */
export const getAdminStats = async (
  startDate: string,
  endDate: string
): Promise<FirebaseAdminStats[]> => {
  try {
    const snapshot = await db.collection(ADMIN_STATS_COLLECTION)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .orderBy("date", "asc")
      .get();
    
    const stats: FirebaseAdminStats[] = [];
    snapshot.forEach(doc => {
      stats.push(doc.data() as FirebaseAdminStats);
    });
    
    return stats;
  } catch (error) {
    console.error(`Erro ao buscar estatísticas administrativas:`, error);
    throw error;
  }
};

/**
 * Verifica se um usuário é administrador.
 */
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    const userRecord = await auth.getUser(userId);
    
    // Verificar claims personalizadas
    const customClaims = userRecord.customClaims || {};
    if (customClaims.role === UserRole.ADMIN || customClaims.admin === true) {
      return true;
    }
    
    // Verificar no Firestore (caso as claims não estejam definidas)
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.role === UserRole.ADMIN;
    }
    
    return false;
  } catch (error) {
    console.error(`Erro ao verificar se o usuário (ID: ${userId}) é administrador:`, error);
    return false;
  }
};

/**
 * Define um usuário como administrador.
 */
export const setUserAsAdmin = async (
  userId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verificar se o usuário que está fazendo a alteração é administrador
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      throw new Error(`Usuário (ID: ${adminId}) não tem permissão para definir administradores.`);
    }
    
    // Atualizar claims personalizadas
    await auth.setCustomUserClaims(userId, { role: UserRole.ADMIN, admin: true });
    
    // Atualizar no Firestore
    await db.collection("users").doc(userId).update({
      role: UserRole.ADMIN,
      updatedAt: Timestamp.now()
    });
    
    // Registrar a ação administrativa
    await logAdminAction(
      adminId,
      "set_admin",
      "user",
      userId,
      { role: UserRole.ADMIN },
      "success"
    );
    
    console.log(`Usuário (ID: ${userId}) definido como administrador com sucesso.`);
  } catch (error) {
    console.error(`Erro ao definir usuário (ID: ${userId}) como administrador:`, error);
    
    // Registrar a falha
    await logAdminAction(
      adminId,
      "set_admin",
      "user",
      userId,
      { role: UserRole.ADMIN },
      "failure",
      (error as Error).message
    );
    
    throw error;
  }
};

/**
 * Remove privilégios de administrador de um usuário.
 */
export const removeUserAdmin = async (
  userId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verificar se o usuário que está fazendo a alteração é administrador
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      throw new Error(`Usuário (ID: ${adminId}) não tem permissão para remover administradores.`);
    }
    
    // Atualizar claims personalizadas
    await auth.setCustomUserClaims(userId, { role: UserRole.USER, admin: false });
    
    // Atualizar no Firestore
    await db.collection("users").doc(userId).update({
      role: UserRole.USER,
      updatedAt: Timestamp.now()
    });
    
    // Registrar a ação administrativa
    await logAdminAction(
      adminId,
      "remove_admin",
      "user",
      userId,
      { role: UserRole.USER },
      "success"
    );
    
    console.log(`Privilégios de administrador removidos do usuário (ID: ${userId}) com sucesso.`);
  } catch (error) {
    console.error(`Erro ao remover privilégios de administrador do usuário (ID: ${userId}):`, error);
    
    // Registrar a falha
    await logAdminAction(
      adminId,
      "remove_admin",
      "user",
      userId,
      { role: UserRole.USER },
      "failure",
      (error as Error).message
    );
    
    throw error;
  }
};

/**
 * Bloqueia um usuário.
 */
export const blockUser = async (
  userId: string,
  adminId: string,
  reason: string
): Promise<void> => {
  try {
    // Verificar se o usuário que está fazendo a alteração é administrador
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      throw new Error(`Usuário (ID: ${adminId}) não tem permissão para bloquear usuários.`);
    }
    
    // Desabilitar o usuário no Authentication
    await auth.updateUser(userId, { disabled: true });
    
    // Atualizar no Firestore
    await db.collection("users").doc(userId).update({
      isBlocked: true,
      blockReason: reason,
      blockedBy: adminId,
      blockedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // Registrar a ação administrativa
    await logAdminAction(
      adminId,
      "block_user",
      "user",
      userId,
      { reason },
      "success"
    );
    
    console.log(`Usuário (ID: ${userId}) bloqueado com sucesso.`);
  } catch (error) {
    console.error(`Erro ao bloquear usuário (ID: ${userId}):`, error);
    
    // Registrar a falha
    await logAdminAction(
      adminId,
      "block_user",
      "user",
      userId,
      { reason },
      "failure",
      (error as Error).message
    );
    
    throw error;
  }
};

/**
 * Desbloqueia um usuário.
 */
export const unblockUser = async (
  userId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verificar se o usuário que está fazendo a alteração é administrador
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      throw new Error(`Usuário (ID: ${adminId}) não tem permissão para desbloquear usuários.`);
    }
    
    // Habilitar o usuário no Authentication
    await auth.updateUser(userId, { disabled: false });
    
    // Atualizar no Firestore
    await db.collection("users").doc(userId).update({
      isBlocked: false,
      blockReason: null,
      unblockedBy: adminId,
      unblockedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // Registrar a ação administrativa
    await logAdminAction(
      adminId,
      "unblock_user",
      "user",
      userId,
      {},
      "success"
    );
    
    console.log(`Usuário (ID: ${userId}) desbloqueado com sucesso.`);
  } catch (error) {
    console.error(`Erro ao desbloquear usuário (ID: ${userId}):`, error);
    
    // Registrar a falha
    await logAdminAction(
      adminId,
      "unblock_user",
      "user",
      userId,
      {},
      "failure",
      (error as Error).message
    );
    
    throw error;
  }
};

/**
 * Exclui um usuário.
 */
export const deleteUserByAdmin = async (
  userId: string,
  adminId: string,
  reason: string
): Promise<void> => {
  try {
    // Verificar se o usuário que está fazendo a alteração é administrador
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      throw new Error(`Usuário (ID: ${adminId}) não tem permissão para excluir usuários.`);
    }
    
    // Excluir o usuário no Authentication
    await auth.deleteUser(userId);
    
    // Registrar a exclusão no Firestore (opcional - você pode querer manter um registro)
    await db.collection("deletedUsers").doc(userId).set({
      deletedBy: adminId,
      deletedAt: Timestamp.now(),
      reason
    });
    
    // Registrar a ação administrativa
    await logAdminAction(
      adminId,
      "delete_user",
      "user",
      userId,
      { reason },
      "success"
    );
    
    console.log(`Usuário (ID: ${userId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir usuário (ID: ${userId}):`, error);
    
    // Registrar a falha
    await logAdminAction(
      adminId,
      "delete_user",
      "user",
      userId,
      { reason },
      "failure",
      (error as Error).message
    );
    
    throw error;
  }
};