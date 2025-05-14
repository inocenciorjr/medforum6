import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import * as crypto from 'crypto';

// Definição de tipos para webhooks
export enum FirebaseWebhookEvent {
  PAYMENT_CREATED = "payment.created",
  PAYMENT_APPROVED = "payment.approved",
  PAYMENT_REJECTED = "payment.rejected",
  PAYMENT_REFUNDED = "payment.refunded",
  PAYMENT_CANCELLED = "payment.cancelled",
  PAYMENT_CHARGEBACK = "payment.chargeback",
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_RENEWED = "subscription.renewed",
  SUBSCRIPTION_CANCELLED = "subscription.cancelled",
  SUBSCRIPTION_EXPIRED = "subscription.expired",
  USER_REGISTERED = "user.registered",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
  CONTENT_CREATED = "content.created",
  CONTENT_UPDATED = "content.updated",
  CONTENT_DELETED = "content.deleted",
  CUSTOM = "custom"
}

export enum FirebaseWebhookStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  FAILED = "failed"
}

export interface FirebaseWebhookEndpoint {
  id: string;
  url: string;
  events: FirebaseWebhookEvent[];
  description?: string | null;
  status: FirebaseWebhookStatus;
  secret: string;
  headers?: Record<string, string> | null;
  failureCount: number;
  lastFailureMessage?: string | null;
  lastFailureTime?: Timestamp | null;
  lastSuccessTime?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseWebhookDelivery {
  id: string;
  endpointId: string;
  event: FirebaseWebhookEvent;
  payload: Record<string, any>;
  status: "pending" | "success" | "failed" | "retrying";
  statusCode?: number | null;
  response?: string | null;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttempt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const WEBHOOK_ENDPOINTS_COLLECTION = "webhookEndpoints";
const WEBHOOK_DELIVERIES_COLLECTION = "webhookDeliveries";

/**
 * Cria um novo endpoint de webhook.
 */
export const createWebhookEndpoint = async (
  endpointData: Omit<FirebaseWebhookEndpoint, "id" | "status" | "secret" | "failureCount" | "lastFailureMessage" | "lastFailureTime" | "lastSuccessTime" | "createdAt" | "updatedAt">
): Promise<FirebaseWebhookEndpoint> => {
  const endpointRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc();
  const now = Timestamp.now();

  // Gerar um segredo aleatório para assinatura
  const secret = crypto.randomBytes(32).toString('hex');

  const newEndpoint: FirebaseWebhookEndpoint = {
    id: endpointRef.id,
    ...endpointData,
    status: FirebaseWebhookStatus.ACTIVE,
    secret,
    failureCount: 0,
    lastFailureMessage: null,
    lastFailureTime: null,
    lastSuccessTime: null,
    createdAt: now,
    updatedAt: now,
  };

  await endpointRef.set(newEndpoint);
  console.log(`Endpoint de webhook (ID: ${newEndpoint.id}) criado com sucesso.`);
  return newEndpoint;
};

/**
 * Busca um endpoint de webhook pelo ID.
 */
export const getWebhookEndpointById = async (endpointId: string): Promise<FirebaseWebhookEndpoint | null> => {
  const docRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc(endpointId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseWebhookEndpoint;
  }
  console.warn(`Endpoint de webhook (ID: ${endpointId}) não encontrado.`);
  return null;
};

/**
 * Busca endpoints de webhook com opções de filtro.
 */
export const getWebhookEndpoints = async (
  options: {
    status?: FirebaseWebhookStatus;
    event?: FirebaseWebhookEvent;
    createdBy?: string;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ endpoints: FirebaseWebhookEndpoint[]; total: number }> => {
  try {
    let query = db.collection(WEBHOOK_ENDPOINTS_COLLECTION);
    
    // Aplicar filtros
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.event) {
      query = query.where("events", "array-contains", options.event);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
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
    
    const endpoints: FirebaseWebhookEndpoint[] = [];
    snapshot.forEach(doc => {
      endpoints.push(doc.data() as FirebaseWebhookEndpoint);
    });
    
    return { endpoints, total };
  } catch (error) {
    console.error(`Erro ao buscar endpoints de webhook:`, error);
    throw error;
  }
};

/**
 * Atualiza um endpoint de webhook existente.
 */
export const updateWebhookEndpoint = async (
  endpointId: string, 
  updates: Partial<Omit<FirebaseWebhookEndpoint, "id" | "secret" | "createdBy" | "createdAt" | "updatedAt">>
): Promise<FirebaseWebhookEndpoint | null> => {
  const endpointRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc(endpointId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await endpointRef.update(updateData);
    console.log(`Endpoint de webhook (ID: ${endpointId}) atualizado com sucesso.`);
    const updatedDoc = await endpointRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseWebhookEndpoint : null;
  } catch (error) {
    console.error(`Erro ao atualizar endpoint de webhook (ID: ${endpointId}):`, error);
    throw error;
  }
};

/**
 * Regenera o segredo de um endpoint de webhook.
 */
export const regenerateWebhookSecret = async (endpointId: string): Promise<string> => {
  const endpointRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc(endpointId);
  const now = Timestamp.now();
  
  // Gerar um novo segredo aleatório
  const newSecret = crypto.randomBytes(32).toString('hex');
  
  try {
    await endpointRef.update({
      secret: newSecret,
      updatedAt: now
    });
    
    console.log(`Segredo do endpoint de webhook (ID: ${endpointId}) regenerado com sucesso.`);
    return newSecret;
  } catch (error) {
    console.error(`Erro ao regenerar segredo do endpoint de webhook (ID: ${endpointId}):`, error);
    throw error;
  }
};

/**
 * Exclui um endpoint de webhook.
 */
export const deleteWebhookEndpoint = async (endpointId: string): Promise<void> => {
  const endpointRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc(endpointId);
  try {
    await endpointRef.delete();
    console.log(`Endpoint de webhook (ID: ${endpointId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir endpoint de webhook (ID: ${endpointId}):`, error);
    throw error;
  }
};

/**
 * Cria uma nova entrega de webhook.
 */
export const createWebhookDelivery = async (
  endpointId: string,
  event: FirebaseWebhookEvent,
  payload: Record<string, any>,
  maxAttempts: number = 3
): Promise<FirebaseWebhookDelivery> => {
  const deliveryRef = db.collection(WEBHOOK_DELIVERIES_COLLECTION).doc();
  const now = Timestamp.now();

  const newDelivery: FirebaseWebhookDelivery = {
    id: deliveryRef.id,
    endpointId,
    event,
    payload,
    status: "pending",
    statusCode: null,
    response: null,
    error: null,
    attempts: 0,
    maxAttempts,
    nextAttempt: now,
    createdAt: now,
    updatedAt: now,
  };

  await deliveryRef.set(newDelivery);
  console.log(`Entrega de webhook (ID: ${newDelivery.id}) criada com sucesso.`);
  return newDelivery;
};

/**
 * Atualiza o status de uma entrega de webhook.
 */
export const updateWebhookDeliveryStatus = async (
  deliveryId: string,
  status: "pending" | "success" | "failed" | "retrying",
  updates: {
    statusCode?: number;
    response?: string;
    error?: string;
    nextAttempt?: Date;
  } = {}
): Promise<FirebaseWebhookDelivery | null> => {
  const deliveryRef = db.collection(WEBHOOK_DELIVERIES_COLLECTION).doc(deliveryId);
  const now = Timestamp.now();
  
  const updateData: Record<string, any> = {
    status,
    updatedAt: now
  };
  
  if (updates.statusCode !== undefined) {
    updateData.statusCode = updates.statusCode;
  }
  
  if (updates.response !== undefined) {
    updateData.response = updates.response;
  }
  
  if (updates.error !== undefined) {
    updateData.error = updates.error;
  }
  
  if (updates.nextAttempt) {
    updateData.nextAttempt = Timestamp.fromDate(updates.nextAttempt);
  }
  
  if (status === "success" || status === "failed") {
    // Atualizar o endpoint relacionado
    try {
      const delivery = await getWebhookDeliveryById(deliveryId);
      if (delivery) {
        const endpoint = await getWebhookEndpointById(delivery.endpointId);
        if (endpoint) {
          const endpointRef = db.collection(WEBHOOK_ENDPOINTS_COLLECTION).doc(endpoint.id);
          
          if (status === "success") {
            await endpointRef.update({
              lastSuccessTime: now,
              updatedAt: now
            });
          } else if (status === "failed") {
            const failureCount = endpoint.failureCount + 1;
            await endpointRef.update({
              failureCount,
              lastFailureTime: now,
              lastFailureMessage: updates.error || "Falha na entrega do webhook",
              status: failureCount >= 10 ? FirebaseWebhookStatus.FAILED : endpoint.status,
              updatedAt: now
            });
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao atualizar endpoint relacionado à entrega (ID: ${deliveryId}):`, error);
    }
  }
  
  try {
    await deliveryRef.update(updateData);
    console.log(`Status da entrega de webhook (ID: ${deliveryId}) atualizado para ${status}.`);
    const updatedDoc = await deliveryRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseWebhookDelivery : null;
  } catch (error) {
    console.error(`Erro ao atualizar status da entrega de webhook (ID: ${deliveryId}):`, error);
    throw error;
  }
};

/**
 * Incrementa o contador de tentativas de uma entrega de webhook.
 */
export const incrementWebhookDeliveryAttempts = async (deliveryId: string): Promise<FirebaseWebhookDelivery | null> => {
  const deliveryRef = db.collection(WEBHOOK_DELIVERIES_COLLECTION).doc(deliveryId);
  
  try {
    // Usar transação para garantir atomicidade
    const result = await db.runTransaction(async (transaction) => {
      const deliveryDoc = await transaction.get(deliveryRef);
      
      if (!deliveryDoc.exists) {
        throw new Error(`Entrega de webhook (ID: ${deliveryId}) não encontrada.`);
      }
      
      const delivery = deliveryDoc.data() as FirebaseWebhookDelivery;
      const attempts = delivery.attempts + 1;
      
      // Determinar o próximo status com base no número de tentativas
      let status: "pending" | "failed" | "retrying";
      let nextAttempt: Timestamp | null = null;
      
      if (attempts >= delivery.maxAttempts) {
        status = "failed";
      } else {
        status = "retrying";
        
        // Calcular o próximo tempo de tentativa com backoff exponencial
        const backoffMinutes = Math.pow(2, attempts);
        const nextAttemptDate = new Date();
        nextAttemptDate.setMinutes(nextAttemptDate.getMinutes() + backoffMinutes);
        nextAttempt = Timestamp.fromDate(nextAttemptDate);
      }
      
      transaction.update(deliveryRef, {
        attempts,
        status,
        nextAttempt,
        updatedAt: Timestamp.now()
      });
      
      return {
        ...delivery,
        attempts,
        status,
        nextAttempt,
        updatedAt: Timestamp.now()
      };
    });
    
    console.log(`Tentativas da entrega de webhook (ID: ${deliveryId}) incrementadas para ${result.attempts}.`);
    return result as FirebaseWebhookDelivery;
  } catch (error) {
    console.error(`Erro ao incrementar tentativas da entrega de webhook (ID: ${deliveryId}):`, error);
    throw error;
  }
};

/**
 * Busca uma entrega de webhook pelo ID.
 */
export const getWebhookDeliveryById = async (deliveryId: string): Promise<FirebaseWebhookDelivery | null> => {
  const docRef = db.collection(WEBHOOK_DELIVERIES_COLLECTION).doc(deliveryId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseWebhookDelivery;
  }
  console.warn(`Entrega de webhook (ID: ${deliveryId}) não encontrada.`);
  return null;
};

/**
 * Busca entregas de webhook com opções de filtro.
 */
export const getWebhookDeliveries = async (
  options: {
    endpointId?: string;
    event?: FirebaseWebhookEvent;
    status?: "pending" | "success" | "failed" | "retrying";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ deliveries: FirebaseWebhookDelivery[]; total: number }> => {
  try {
    let query = db.collection(WEBHOOK_DELIVERIES_COLLECTION);
    
    // Aplicar filtros
    if (options.endpointId) {
      query = query.where("endpointId", "==", options.endpointId);
    }
    
    if (options.event) {
      query = query.where("event", "==", options.event);
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
    
    const deliveries: FirebaseWebhookDelivery[] = [];
    snapshot.forEach(doc => {
      deliveries.push(doc.data() as FirebaseWebhookDelivery);
    });
    
    return { deliveries, total };
  } catch (error) {
    console.error(`Erro ao buscar entregas de webhook:`, error);
    throw error;
  }
};

/**
 * Busca entregas de webhook pendentes que devem ser processadas.
 */
export const getPendingWebhookDeliveries = async (): Promise<FirebaseWebhookDelivery[]> => {
  try {
    const now = Timestamp.now();
    
    const snapshot = await db.collection(WEBHOOK_DELIVERIES_COLLECTION)
      .where("status", "in", ["pending", "retrying"])
      .where("nextAttempt", "<=", now)
      .orderBy("nextAttempt", "asc")
      .limit(100) // Limitar para não sobrecarregar
      .get();
    
    const deliveries: FirebaseWebhookDelivery[] = [];
    snapshot.forEach(doc => {
      deliveries.push(doc.data() as FirebaseWebhookDelivery);
    });
    
    return deliveries;
  } catch (error) {
    console.error(`Erro ao buscar entregas de webhook pendentes:`, error);
    throw error;
  }
};

/**
 * Gera uma assinatura HMAC para um payload de webhook.
 */
export const generateWebhookSignature = (
  payload: Record<string, any>,
  secret: string
): string => {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
};

/**
 * Envia um evento de webhook para todos os endpoints inscritos.
 */
export const dispatchWebhookEvent = async (
  event: FirebaseWebhookEvent,
  payload: Record<string, any>
): Promise<number> => {
  try {
    // Buscar todos os endpoints ativos inscritos para este evento
    const { endpoints } = await getWebhookEndpoints({
      status: FirebaseWebhookStatus.ACTIVE,
      event
    });
    
    if (endpoints.length === 0) {
      console.log(`Nenhum endpoint inscrito para o evento ${event}.`);
      return 0;
    }
    
    // Criar entregas para cada endpoint
    const deliveryPromises = endpoints.map(endpoint => 
      createWebhookDelivery(endpoint.id, event, payload)
    );
    
    await Promise.all(deliveryPromises);
    console.log(`${endpoints.length} entregas de webhook criadas para o evento ${event}.`);
    
    return endpoints.length;
  } catch (error) {
    console.error(`Erro ao despachar evento de webhook ${event}:`, error);
    throw error;
  }
};