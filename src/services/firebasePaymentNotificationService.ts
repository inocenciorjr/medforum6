import { firestore as db } from "../config/firebaseAdmin";
import { FirebasePaymentNotification } from "../types/firebasePaymentTypes";
import { Timestamp } from "firebase-admin/firestore";

const PAYMENT_NOTIFICATIONS_COLLECTION = "paymentNotifications";

/**
 * Cria uma nova notificação de pagamento.
 */
export const createPaymentNotification = async (
  notificationData: Omit<FirebasePaymentNotification, "id" | "isRead" | "readAt" | "createdAt" | "updatedAt">
): Promise<FirebasePaymentNotification> => {
  const notificationRef = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION).doc();
  const now = Timestamp.now();

  const newNotification: FirebasePaymentNotification = {
    id: notificationRef.id,
    ...notificationData,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await notificationRef.set(newNotification);
  console.log(`Notificação de pagamento (ID: ${newNotification.id}) criada com sucesso.`);
  return newNotification;
};

/**
 * Busca uma notificação de pagamento pelo ID.
 */
export const getPaymentNotificationById = async (notificationId: string): Promise<FirebasePaymentNotification | null> => {
  const docRef = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION).doc(notificationId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebasePaymentNotification;
  }
  console.warn(`Notificação de pagamento (ID: ${notificationId}) não encontrada.`);
  return null;
};

/**
 * Busca notificações de pagamento por ID de usuário.
 */
export const getPaymentNotificationsByUserId = async (
  userId: string,
  options: {
    isRead?: boolean;
    limit?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<FirebasePaymentNotification[]> => {
  try {
    let query = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION)
      .where("userId", "==", userId);
    
    if (options.isRead !== undefined) {
      query = query.where("isRead", "==", options.isRead);
    }
    
    if (options.orderByCreatedAt) {
      query = query.orderBy("createdAt", options.orderByCreatedAt);
    } else {
      query = query.orderBy("createdAt", "desc"); // Padrão: mais recentes primeiro
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const notifications: FirebasePaymentNotification[] = [];
    snapshot.forEach(doc => {
      notifications.push(doc.data() as FirebasePaymentNotification);
    });
    
    return notifications;
  } catch (error) {
    console.error(`Erro ao buscar notificações de pagamento para o usuário (ID: ${userId}):`, error);
    throw error;
  }
};

/**
 * Busca notificações de pagamento por ID de pagamento.
 */
export const getPaymentNotificationsByPaymentId = async (paymentId: string): Promise<FirebasePaymentNotification[]> => {
  try {
    const snapshot = await db.collection(PAYMENT_NOTIFICATIONS_COLLECTION)
      .where("paymentId", "==", paymentId)
      .orderBy("createdAt", "desc")
      .get();
    
    const notifications: FirebasePaymentNotification[] = [];
    snapshot.forEach(doc => {
      notifications.push(doc.data() as FirebasePaymentNotification);
    });
    
    return notifications;
  } catch (error) {
    console.error(`Erro ao buscar notificações para o pagamento (ID: ${paymentId}):`, error);
    throw error;
  }
};

/**
 * Marca uma notificação de pagamento como lida.
 */
export const markPaymentNotificationAsRead = async (notificationId: string): Promise<FirebasePaymentNotification | null> => {
  const notificationRef = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION).doc(notificationId);
  const now = Timestamp.now();
  
  try {
    await notificationRef.update({
      isRead: true,
      readAt: now,
      updatedAt: now
    });
    
    console.log(`Notificação de pagamento (ID: ${notificationId}) marcada como lida.`);
    const updatedDoc = await notificationRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebasePaymentNotification : null;
  } catch (error) {
    console.error(`Erro ao marcar notificação de pagamento (ID: ${notificationId}) como lida:`, error);
    throw error;
  }
};

/**
 * Marca todas as notificações de pagamento de um usuário como lidas.
 */
export const markAllPaymentNotificationsAsRead = async (userId: string): Promise<number> => {
  try {
    const snapshot = await db.collection(PAYMENT_NOTIFICATIONS_COLLECTION)
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
 * Processa uma notificação de webhook de pagamento.
 * Esta função analisa os dados do webhook e cria notificações apropriadas.
 */
export const processPaymentWebhook = async (
  webhookData: any,
  paymentId?: string
): Promise<FirebasePaymentNotification | null> => {
  try {
    // Extrair informações do webhook
    const webhookType = webhookData.type || webhookData.event || "unknown";
    const userId = webhookData.userId || webhookData.user_id;
    
    if (!userId) {
      console.error("Webhook de pagamento não contém ID de usuário:", webhookData);
      return null;
    }
    
    // Determinar título e mensagem com base no tipo de webhook
    let title = "Atualização de Pagamento";
    let message = "Seu pagamento foi atualizado.";
    
    switch (webhookType.toLowerCase()) {
      case "payment.created":
      case "payment_created":
        title = "Novo Pagamento";
        message = "Um novo pagamento foi criado.";
        break;
      case "payment.approved":
      case "payment_approved":
        title = "Pagamento Aprovado";
        message = "Seu pagamento foi aprovado com sucesso!";
        break;
      case "payment.rejected":
      case "payment_rejected":
        title = "Pagamento Rejeitado";
        message = "Seu pagamento foi rejeitado. Por favor, tente novamente.";
        break;
      case "payment.refunded":
      case "payment_refunded":
        title = "Pagamento Reembolsado";
        message = "Seu pagamento foi reembolsado.";
        break;
      case "payment.cancelled":
      case "payment_cancelled":
        title = "Pagamento Cancelado";
        message = "Seu pagamento foi cancelado.";
        break;
      case "payment.chargeback":
      case "payment_chargeback":
        title = "Chargeback Detectado";
        message = "Um chargeback foi registrado para seu pagamento.";
        break;
      case "pix.expired":
      case "pix_expired":
        title = "PIX Expirado";
        message = "Seu código PIX expirou. Por favor, gere um novo.";
        break;
      case "subscription.created":
      case "subscription_created":
        title = "Nova Assinatura";
        message = "Sua assinatura foi criada com sucesso.";
        break;
      case "subscription.cancelled":
      case "subscription_cancelled":
        title = "Assinatura Cancelada";
        message = "Sua assinatura foi cancelada.";
        break;
      case "subscription.renewed":
      case "subscription_renewed":
        title = "Assinatura Renovada";
        message = "Sua assinatura foi renovada com sucesso.";
        break;
      case "subscription.expiring":
      case "subscription_expiring":
        title = "Assinatura Expirando";
        message = "Sua assinatura irá expirar em breve.";
        break;
      default:
        title = "Notificação de Pagamento";
        message = `Atualização de pagamento: ${webhookType}`;
    }
    
    // Criar a notificação
    const notificationData: Omit<FirebasePaymentNotification, "id" | "isRead" | "readAt" | "createdAt" | "updatedAt"> = {
      userId,
      paymentId: paymentId || null,
      type: webhookType,
      title,
      message,
      metadata: webhookData
    };
    
    return await createPaymentNotification(notificationData);
  } catch (error) {
    console.error("Erro ao processar webhook de pagamento:", error);
    throw error;
  }
};

/**
 * Atualiza uma notificação de pagamento existente.
 */
export const updatePaymentNotification = async (
  notificationId: string, 
  updates: Partial<Omit<FirebasePaymentNotification, "id" | "createdAt">>
): Promise<FirebasePaymentNotification | null> => {
  const notificationRef = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION).doc(notificationId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await notificationRef.update(updateData);
    console.log(`Notificação de pagamento (ID: ${notificationId}) atualizada com sucesso.`);
    const updatedDoc = await notificationRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebasePaymentNotification : null;
  } catch (error) {
    console.error(`Erro ao atualizar notificação de pagamento (ID: ${notificationId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma notificação de pagamento.
 */
export const deletePaymentNotification = async (notificationId: string): Promise<void> => {
  const notificationRef = db.collection(PAYMENT_NOTIFICATIONS_COLLECTION).doc(notificationId);
  try {
    await notificationRef.delete();
    console.log(`Notificação de pagamento (ID: ${notificationId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir notificação de pagamento (ID: ${notificationId}):`, error);
    throw error;
  }
};