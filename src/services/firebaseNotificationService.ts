import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para notificações
export enum FirebaseNotificationType {
  SYSTEM = "system",
  PAYMENT = "payment",
  USER = "user",
  CONTENT = "content",
  MENTORSHIP = "mentorship",
  ACHIEVEMENT = "achievement",
  PLAN = "plan",
  EXAM = "exam",
  REVIEW = "review",
  COMMENT = "comment"
}

export enum FirebaseNotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

export interface FirebaseNotification {
  id: string;
  userId: string;
  type: FirebaseNotificationType;
  title: string;
  message: string;
  priority: FirebaseNotificationPriority;
  isRead: boolean;
  readAt?: Timestamp | null;
  actionUrl?: string | null;
  imageUrl?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
  metadata?: Record<string, any> | null;
  expiresAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const NOTIFICATIONS_COLLECTION = "notifications";

/**
 * Cria uma nova notificação.
 */
export const createNotification = async (
  notificationData: Omit<FirebaseNotification, "id" | "isRead" | "readAt" | "createdAt" | "updatedAt">
): Promise<FirebaseNotification> => {
  const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc();
  const now = Timestamp.now();

  const newNotification: FirebaseNotification = {
    id: notificationRef.id,
    ...notificationData,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await notificationRef.set(newNotification);
  console.log(`Notificação (ID: ${newNotification.id}) criada com sucesso para o usuário ${newNotification.userId}.`);
  return newNotification;
};

/**
 * Busca uma notificação pelo ID.
 */
export const getNotificationById = async (notificationId: string): Promise<FirebaseNotification | null> => {
  const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseNotification;
  }
  console.warn(`Notificação (ID: ${notificationId}) não encontrada.`);
  return null;
};

/**
 * Busca notificações por ID de usuário com opções de filtro.
 */
export const getNotificationsByUserId = async (
  userId: string,
  options: {
    isRead?: boolean;
    type?: FirebaseNotificationType;
    priority?: FirebaseNotificationPriority;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
    includeExpired?: boolean;
  } = {}
): Promise<{ notifications: FirebaseNotification[]; total: number }> => {
  try {
    let query = db.collection(NOTIFICATIONS_COLLECTION)
      .where("userId", "==", userId);
    
    if (options.isRead !== undefined) {
      query = query.where("isRead", "==", options.isRead);
    }
    
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.priority) {
      query = query.where("priority", "==", options.priority);
    }
    
    // Excluir notificações expiradas, a menos que especificado o contrário
    if (!options.includeExpired) {
      const now = Timestamp.now();
      query = query.where("expiresAt", ">", now).orderBy("expiresAt");
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
    
    const notifications: FirebaseNotification[] = [];
    snapshot.forEach(doc => {
      notifications.push(doc.data() as FirebaseNotification);
    });
    
    return { notifications, total };
  } catch (error) {
    console.error(`Erro ao buscar notificações para o usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Marca uma notificação como lida.
 */
export const markNotificationAsRead = async (notificationId: string): Promise<FirebaseNotification | null> => {
  const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const now = Timestamp.now();
  
  try {
    await notificationRef.update({
      isRead: true,
      readAt: now,
      updatedAt: now
    });
    
    console.log(`Notificação (ID: ${notificationId}) marcada como lida.`);
    const updatedDoc = await notificationRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseNotification : null;
  } catch (error) {
    console.error(`Erro ao marcar notificação (ID: ${notificationId}) como lida:`, error);
    throw error;
  }
};

/**
 * Marca todas as notificações de um usuário como lidas.
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
  try {
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhuma notificação não lida encontrada para o usuário (ID: ${userId}).`);
      return 0;
    }
    
    const batch = db.batch();
    const now = Timestamp.now();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: now,
        updatedAt: now
      });
    });
    
    await batch.commit();
    console.log(`${snapshot.size} notificações marcadas como lidas para o usuário (ID: ${userId}).`);
    return snapshot.size;
  } catch (error) {
    console.error(`Erro ao marcar todas as notificações como lidas para o usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Atualiza uma notificação existente.
 */
export const updateNotification = async (
  notificationId: string, 
  updates: Partial<Omit<FirebaseNotification, "id" | "createdAt">>
): Promise<FirebaseNotification | null> => {
  const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await notificationRef.update(updateData);
    console.log(`Notificação (ID: ${notificationId}) atualizada com sucesso.`);
    const updatedDoc = await notificationRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseNotification : null;
  } catch (error) {
    console.error(`Erro ao atualizar notificação (ID: ${notificationId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma notificação.
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
  try {
    await notificationRef.delete();
    console.log(`Notificação (ID: ${notificationId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir notificação (ID: ${notificationId}):`, error);
    throw error;
  }
};

/**
 * Exclui todas as notificações de um usuário.
 */
export const deleteAllUserNotifications = async (userId: string): Promise<number> => {
  try {
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
      .where("userId", "==", userId)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhuma notificação encontrada para o usuário (ID: ${userId}).`);
      return 0;
    }
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`${snapshot.size} notificações excluídas para o usuário (ID: ${userId}).`);
    return snapshot.size;
  } catch (error) {
    console.error(`Erro ao excluir todas as notificações do usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Limpa notificações expiradas.
 * Esta função pode ser executada periodicamente por um job ou trigger.
 */
export const cleanupExpiredNotifications = async (): Promise<number> => {
  try {
    const now = Timestamp.now();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
      .where("expiresAt", "<", now)
      .get();
    
    if (snapshot.empty) {
      console.log("Nenhuma notificação expirada encontrada.");
      return 0;
    }
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`${snapshot.size} notificações expiradas excluídas.`);
    return snapshot.size;
  } catch (error) {
    console.error("Erro ao limpar notificações expiradas:", error);
    throw error;
  }
};

/**
 * Envia uma notificação para vários usuários.
 */
export const sendNotificationToMultipleUsers = async (
  userIds: string[],
  notificationData: Omit<FirebaseNotification, "id" | "userId" | "isRead" | "readAt" | "createdAt" | "updatedAt">
): Promise<number> => {
  if (!userIds.length) {
    console.warn("Nenhum usuário especificado para enviar notificação.");
    return 0;
  }
  
  try {
    const batch = db.batch();
    const now = Timestamp.now();
    const createdNotificationIds: string[] = [];
    
    for (const userId of userIds) {
      const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc();
      createdNotificationIds.push(notificationRef.id);
      
      const newNotification: FirebaseNotification = {
        id: notificationRef.id,
        userId,
        ...notificationData,
        isRead: false,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      };
      
      batch.set(notificationRef, newNotification);
    }
    
    await batch.commit();
    console.log(`${userIds.length} notificações enviadas com sucesso.`);
    return userIds.length;
  } catch (error) {
    console.error("Erro ao enviar notificações para múltiplos usuários:", error);
    throw error;
  }
};

/**
 * Conta o número de notificações não lidas para um usuário.
 */
export const countUnreadNotifications = async (userId: string): Promise<number> => {
  try {
    const now = Timestamp.now();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .where("expiresAt", ">", now)
      .count()
      .get();
    
    return snapshot.data().count;
  } catch (error) {
    console.error(`Erro ao contar notificações não lidas para o usuário (ID: ${userId}):`, error);
    throw error;
  }
};