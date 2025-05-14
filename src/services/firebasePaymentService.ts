import { firestore as db } from "../config/firebaseAdmin";
import AppError from "../utils/AppError"; // Importação adicionada
import { FirebasePayment, FirebasePaymentStatus, FirebasePlan, FirebaseUserPlanStatus, FirebasePaymentMethodType, FirebasePaymentMethod } from "../types/firebaseTypes";
import { Timestamp, FieldValue, Transaction, QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { getPlanById, createUserPlan, renewUserPlan, getActiveUserPlanByUserIdAndPlanId, getUserPlanById, updateUserPlanStatus } from "./firebaseUserPlanService";
import { createNotification, FirebaseNotificationType, FirebaseNotificationPriority } from "./firebaseNotificationService"; // Import notification service

const PAYMENTS_COLLECTION = "payments";
const USER_PLANS_COLLECTION = "user_plans"; // For transactions

// --- Funções existentes (createPayment, getPaymentById, etc.) permanecem as mesmas --- 

/**
 * Cria um novo registro de pagamento.
 */
export const createPayment = async (paymentData: Omit<FirebasePayment, "id" | "createdAt" | "updatedAt">): Promise<FirebasePayment> => {
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc();
  const now = Timestamp.now();

  const newPayment: FirebasePayment = {
    id: paymentRef.id,
    ...paymentData,
    createdAt: now,
    updatedAt: now,
  };

  await paymentRef.set(newPayment);
  console.log(`Pagamento (ID: ${newPayment.id}) para o usuário ${newPayment.userId} criado com sucesso.`);
  return newPayment;
};

/**
 * Busca um pagamento pelo ID.
 */
export const getPaymentById = async (paymentId: string): Promise<FirebasePayment | null> => {
  const docRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebasePayment;
  }
  console.warn(`Pagamento (ID: ${paymentId}) não encontrado.`);
  return null;
};

/**
 * Busca todos os pagamentos de um usuário específico.
 */
export const getPaymentsByUserId = async (userId: string): Promise<FirebasePayment[]> => {
  const payments: FirebasePayment[] = [];
  try {
    const snapshot = await db.collection(PAYMENTS_COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    snapshot.forEach(doc => {
      payments.push(doc.data() as FirebasePayment);
    });
    return payments;
  } catch (error) {
    console.warn("Erro ao buscar pagamentos com índice composto, tentando alternativa:", error);
    const snapshot = await db.collection(PAYMENTS_COLLECTION)
      .where("userId", "==", userId)
      .get();
    snapshot.forEach(doc => {
      payments.push(doc.data() as FirebasePayment);
    });
    payments.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    return payments;
  }
};

/**
 * Busca todos os pagamentos associados a uma assinatura de plano (UserPlan) específica.
 */
export const getPaymentsByUserPlanId = async (userPlanId: string): Promise<FirebasePayment[]> => {
  const payments: FirebasePayment[] = [];
  try {
    const snapshot = await db.collection(PAYMENTS_COLLECTION)
      .where("userPlanId", "==", userPlanId)
      .orderBy("createdAt", "desc")
      .get();
    snapshot.forEach(doc => {
      payments.push(doc.data() as FirebasePayment);
    });
    return payments;
  } catch (error) {
    console.warn("Erro ao buscar pagamentos por userPlanId com índice composto, tentando alternativa:", error);
    const snapshot = await db.collection(PAYMENTS_COLLECTION)
      .where("userPlanId", "==", userPlanId)
      .get();
    snapshot.forEach(doc => {
      payments.push(doc.data() as FirebasePayment);
    });
    payments.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    return payments;
  }
};

/**
 * Atualiza um registro de pagamento existente.
 */
export const updatePayment = async (paymentId: string, updates: Partial<Omit<FirebasePayment, "id" | "createdAt">>): Promise<FirebasePayment | null> => {
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await paymentRef.update(updateData);
    console.log(`Pagamento (ID: ${paymentId}) atualizado com sucesso.`);
    const updatedDoc = await paymentRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebasePayment : null;
  } catch (error) {
    console.error(`Erro ao atualizar pagamento (ID: ${paymentId}):`, error);
    if ((error as any).code === 'firestore/not-found' || (error as any).message.includes('NOT_FOUND')) {
        console.warn(`Tentativa de atualizar pagamento inexistente: ${paymentId}`);
    }
    throw error;
  }
};

/**
 * Aprova um pagamento pendente e ativa/estende o UserPlan associado.
 */
export const approvePayment = async (paymentId: string, externalId?: string, transactionData?: Record<string, any>, receiptUrl?: string): Promise<FirebasePayment | null> => {
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId);

  try {
    const updatedPayment = await db.runTransaction(async (transaction: Transaction) => {
      const paymentDoc = await transaction.get(paymentRef);
      if (!paymentDoc.exists) {
        console.warn(`Pagamento (ID: ${paymentId}) não encontrado para aprovação.`);
        throw new Error(`Pagamento ${paymentId} não encontrado.`);
      }
      const payment = paymentDoc.data() as FirebasePayment;

      if (payment.status !== FirebasePaymentStatus.PENDING) {
        console.warn(`Tentativa de aprovar pagamento (ID: ${paymentId}) que não está pendente. Status atual: ${payment.status}.`);
        // Modificado para lançar erro, conforme esperado pelos testes e para melhor tratamento de fluxo
        throw new AppError(`Pagamento ${paymentId} não está pendente e não pode ser aprovado. Status: ${payment.status}`, 400);
      }

      if (!payment.planId) {
        console.error(`Pagamento (ID: ${paymentId}) não possui planId associado. Não é possível ativar/estender plano.`);
        throw new Error(`Pagamento ${paymentId} sem planId.`);
      }

      const planDetails = await getPlanById(payment.planId);
      if (!planDetails) {
        console.error(`Plano (ID: ${payment.planId}) associado ao pagamento ${paymentId} não encontrado.`);
        throw new Error(`Plano ${payment.planId} não encontrado.`);
      }

      const updates: Partial<FirebasePayment> = {
        status: FirebasePaymentStatus.APPROVED,
        paidAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      if (externalId !== undefined) updates.externalId = externalId;
      if (transactionData !== undefined) updates.transactionData = transactionData;
      if (receiptUrl !== undefined) updates.receiptUrl = receiptUrl;

      transaction.update(paymentRef, updates);

      const existingUserPlan = await getActiveUserPlanByUserIdAndPlanId(payment.userId, payment.planId);
      const planDurationDays = planDetails.durationInDays ?? 30; // Corrected: durationInDays from FirebasePlan

      if (existingUserPlan && existingUserPlan.id) {
        const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(existingUserPlan.id);
        const currentEndsAt = existingUserPlan.endsAt ? existingUserPlan.endsAt.toDate() : new Date();
        const renewalStartDate = currentEndsAt < new Date() ? new Date() : currentEndsAt;
        const newEndsAtDate = new Date(renewalStartDate);
        newEndsAtDate.setDate(newEndsAtDate.getDate() + planDurationDays);

        transaction.update(userPlanRef, {
          endsAt: Timestamp.fromDate(newEndsAtDate),
          status: FirebaseUserPlanStatus.ACTIVE,
          paymentId: payment.id,
          paymentMethod: payment.paymentMethod, // Corrected: paymentMethod from FirebasePayment
          updatedAt: Timestamp.now(),
          autoRenew: existingUserPlan.autoRenew,
          cancellationReason: null,
          cancelledAt: null,
        });
        console.log(`UserPlan (ID: ${existingUserPlan.id}) renovado via transação para o pagamento ${paymentId}.`);
      } else {
        const newUserPlanRef = db.collection(USER_PLANS_COLLECTION).doc();
        const startDate = new Date();
        const endsAtDate = new Date(startDate);
        endsAtDate.setDate(endsAtDate.getDate() + planDurationDays);

        const newUserPlanData = {
          id: newUserPlanRef.id,
          userId: payment.userId,
          planId: payment.planId,
          startedAt: Timestamp.fromDate(startDate),
          endsAt: Timestamp.fromDate(endsAtDate),
          status: FirebaseUserPlanStatus.ACTIVE,
          paymentId: payment.id,
          paymentMethod: payment.paymentMethod as FirebasePaymentMethodType | FirebasePaymentMethod, // Corrected: paymentMethod from FirebasePayment
          autoRenew: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          metadata: payment.metadata || null,
          cancellationReason: null,
          cancelledAt: null,
        };
        transaction.set(newUserPlanRef, newUserPlanData);
        console.log(`Novo UserPlan (ID: ${newUserPlanRef.id}) criado via transação para o pagamento ${paymentId}.`);
      }
      return { ...payment, ...updates } as FirebasePayment;
    });
    console.log(`Pagamento (ID: ${paymentId}) aprovado e UserPlan atualizado/criado com sucesso via transação.`);
    return updatedPayment;
  } catch (error) {
    console.error(`Falha na transação de aprovação do pagamento ${paymentId}:`, error);
    // Lançar a exceção em vez de retornar null para que o teste possa capturá-la
    throw error;
  }
};

/**
 * Rejeita um pagamento pendente e notifica o usuário.
 */
export const rejectPayment = async (paymentId: string, failureReason: string, transactionData?: Record<string, any>): Promise<FirebasePayment | null> => {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  if (payment.status !== FirebasePaymentStatus.PENDING) {
    console.warn(`Apenas pagamentos pendentes podem ser rejeitados. Status atual: ${payment.status}`);
    return null;
  }

  const updates: Partial<FirebasePayment> = {
    status: FirebasePaymentStatus.REJECTED,
    failureReason: failureReason,
    updatedAt: Timestamp.now(), 
  };
  if (transactionData !== undefined) updates.transactionData = transactionData;

  const updatedPayment = await updatePayment(paymentId, updates);

  if (updatedPayment) {
    try {
      await createNotification({
        userId: updatedPayment.userId,
        type: FirebaseNotificationType.PAYMENT,
        title: "Falha no Pagamento",
        message: `Ocorreu um problema ao processar seu pagamento (ID: ${updatedPayment.id}). Motivo: ${failureReason}. Por favor, verifique seus dados ou tente outro método de pagamento.`,
        priority: FirebaseNotificationPriority.HIGH,
        relatedId: updatedPayment.id,
        relatedType: "payment",
      });
      console.log(`Notificação de rejeição de pagamento enviada para o usuário ${updatedPayment.userId} referente ao pagamento ${updatedPayment.id}.`);
    } catch (notificationError) {
      console.error(`Erro ao criar notificação de rejeição para o pagamento ${updatedPayment.id}:`, notificationError);
    }
  }
  return updatedPayment;
};

/**
 * Reembolsa um pagamento aprovado, ajusta o UserPlan e (simula) interage com o gateway.
 */
export const refundPayment = async (paymentId: string, refundReason: string, gatewayTransactionId?: string, adminUserId?: string): Promise<FirebasePayment | null> => {
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId);

  try {
    const updatedPayment = await db.runTransaction(async (transaction: Transaction) => {
      const paymentDoc = await transaction.get(paymentRef);
      if (!paymentDoc.exists) {
        console.warn(`Pagamento (ID: ${paymentId}) não encontrado para reembolso.`);
        throw new Error(`Pagamento ${paymentId} não encontrado.`);
      }
      const payment = paymentDoc.data() as FirebasePayment;

      if (payment.status !== FirebasePaymentStatus.APPROVED) {
        console.warn(`Apenas pagamentos aprovados podem ser reembolsados. Status atual: ${payment.status} para o pagamento ${paymentId}.`);
        throw new Error(`Pagamento ${paymentId} não está aprovado.`);
      }

      // TODO: INSTRUÇÃO PARA INTEGRAÇÃO FUTURA COM GATEWAY DE PAGAMENTO
      // Antes de confirmar o reembolso no sistema, processe o reembolso através do gateway de pagamento.
      // Exemplo (simulado):
      // const gatewayRefundSuccess = await processGatewayRefund(payment.externalId, payment.amount, refundReason, gatewayTransactionId);
      // if (!gatewayRefundSuccess) {
      //   throw new Error("Falha ao processar reembolso no gateway de pagamento.");
      // }
      // Se o gateway retornar um ID de transação de reembolso, armazene-o em `payment.transactionData.gatewayRefundId` ou similar.
      console.log(`[SIMULAÇÃO] Interação com gateway para reembolsar pagamento ${paymentId}. Detalhes: ${gatewayTransactionId}`);

      const updates: Partial<FirebasePayment> = {
        status: FirebasePaymentStatus.REFUNDED,
        refundReason: refundReason,
        refundedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        processedBy: adminUserId || null, // Opcional: ID do admin que processou o reembolso, fallback to null
        transactionData: {
          ...(payment.transactionData || {}),
          gatewayRefundId: gatewayTransactionId || null, // Exemplo de como armazenar ID do gateway
          refundProcessedBy: adminUserId || "system",
        }
      };

      transaction.update(paymentRef, updates);

      if (payment.userPlanId) {
        const userPlan = await getUserPlanById(payment.userPlanId);
        if (userPlan && userPlan.id && userPlan.status === FirebaseUserPlanStatus.ACTIVE) {
            const userPlanRefToUpdate = db.collection(USER_PLANS_COLLECTION).doc(userPlan.id);
            // Política: Cancelar o plano imediatamente após o reembolso.
            transaction.update(userPlanRefToUpdate, {
                status: FirebaseUserPlanStatus.CANCELLED,
                cancellationReason: `Reembolso do pagamento ${paymentId}: ${refundReason}`,
                cancelledAt: Timestamp.now(),
                autoRenew: false,
                updatedAt: Timestamp.now()
            });
            console.log(`UserPlan (ID: ${userPlan.id}) cancelado devido ao reembolso do pagamento ${paymentId}.`);
        }
      }
      
      return { ...payment, ...updates } as FirebasePayment;
    });

    console.log(`Pagamento (ID: ${paymentId}) reembolsado e UserPlan ajustado com sucesso via transação.`);
    
    if (updatedPayment) {
        try {
            await createNotification({
                userId: updatedPayment.userId,
                type: FirebaseNotificationType.PAYMENT,
                title: "Pagamento Reembolsado",
                message: `Seu pagamento (ID: ${updatedPayment.id}) foi reembolsado. Motivo: ${refundReason}. O acesso ao plano associado pode ter sido ajustado.`,
                priority: FirebaseNotificationPriority.MEDIUM,
                relatedId: updatedPayment.id,
                relatedType: "payment",
            });
            console.log(`Notificação de reembolso enviada para o usuário ${updatedPayment.userId} referente ao pagamento ${updatedPayment.id}.`);
        } catch (notificationError) {
            console.error(`Erro ao criar notificação de reembolso para o pagamento ${updatedPayment.id}:`, notificationError);
        }
    }
    return updatedPayment;

  } catch (error) {
    console.error(`Falha na transação de reembolso do pagamento ${paymentId}:`, error);
    return null;
  }
};

/**
 * Cancela um pagamento pendente.
 */
export const cancelPayment = async (paymentId: string, cancelReason?: string): Promise<FirebasePayment | null> => {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  if (payment.status !== FirebasePaymentStatus.PENDING) {
    console.warn(`Apenas pagamentos pendentes podem ser cancelados. Status atual: ${payment.status}`);
    return null;
  }

  const updates: Partial<FirebasePayment> = {
    status: FirebasePaymentStatus.CANCELLED,
    cancelledAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  if (cancelReason) {
    updates.cancellationReason = cancelReason;
  }

  const updatedPayment = await updatePayment(paymentId, updates);

  if (updatedPayment) {
    try {
      await createNotification({
        userId: updatedPayment.userId,
        type: FirebaseNotificationType.PAYMENT,
        title: "Pagamento Cancelado",
        message: `Seu pagamento (ID: ${updatedPayment.id}) foi cancelado. ${cancelReason ? `Motivo: ${cancelReason}.` : ""}`,
        priority: FirebaseNotificationPriority.MEDIUM,
        relatedId: updatedPayment.id,
        relatedType: "payment",
      });
      console.log(`Notificação de cancelamento de pagamento enviada para o usuário ${updatedPayment.userId} referente ao pagamento ${updatedPayment.id}.`);
    } catch (notificationError) {
      console.error(`Erro ao criar notificação de cancelamento para o pagamento ${updatedPayment.id}:`, notificationError);
    }
  }
  return updatedPayment;
};

/**
 * Busca todos os pagamentos com filtros e paginação.
 */
export const getAllPayments = async (queryParams: any): Promise<{ payments: FirebasePayment[]; nextPageStartAfter?: FirebasePayment | null }> => {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection(PAYMENTS_COLLECTION);

  // Aplicar filtros (exemplos)
  if (queryParams.status) {
    query = query.where("status", "==", queryParams.status);
  }
  if (queryParams.userId) {
    query = query.where("userId", "==", queryParams.userId);
  }
  if (queryParams.planId) {
    query = query.where("planId", "==", queryParams.planId);
  }
  if (queryParams.paymentMethod) {
    query = query.where("paymentMethod", "==", queryParams.paymentMethod);
  }
  if (queryParams.startDate) {
    query = query.where("createdAt", ">=", Timestamp.fromDate(new Date(queryParams.startDate)));
  }
  if (queryParams.endDate) {
    query = query.where("createdAt", "<=", Timestamp.fromDate(new Date(queryParams.endDate)));
  }

  // Ordenação (padrão por data de criação descendente)
  const sortBy = queryParams.sortBy || "createdAt";
  const sortDirection = queryParams.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);

  // Paginação
  const limit = parseInt(queryParams.limit, 10) || 10;
  if (queryParams.startAfter) {
    // Para paginar com startAfter, precisamos do DocumentSnapshot do último documento da página anterior.
    // Isso geralmente é obtido do resultado da consulta anterior.
    // Se startAfter for um ID, buscamos o documento.
    // Se for um objeto (como o próprio documento), podemos tentar usá-lo diretamente (mais complexo e depende do formato).
    // Por simplicidade, assumimos que startAfter é um ID de documento.
    const startAfterDoc = await db.collection(PAYMENTS_COLLECTION).doc(queryParams.startAfter).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    } else {
      console.warn(`Documento startAfter com ID ${queryParams.startAfter} não encontrado para paginação de pagamentos.`);
    }
  }
  
  query = query.limit(limit + 1); // Buscar um a mais para verificar se há próxima página

  const snapshot = await query.get();
  const payments = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data() as FirebasePayment);

  let nextPageStartAfter: FirebasePayment | null = null;
  if (payments.length > limit) {
    nextPageStartAfter = payments.pop() as FirebasePayment; // Remove o extra e guarda para nextPage
  }

  return { payments, nextPageStartAfter };
};



/**
 * Busca um pagamento pelo ID externo (ex: ID da transação do gateway).
 */
export const getPaymentByExternalId = async (externalPaymentId: string): Promise<FirebasePayment | null> => {
  if (!externalPaymentId) {
    console.warn("Tentativa de buscar pagamento com externalPaymentId vazio ou nulo.");
    return null;
  }
  try {
    const snapshot = await db.collection(PAYMENTS_COLLECTION)
      .where("externalId", "==", externalPaymentId)
      .orderBy("createdAt", "desc") // Pega o mais recente em caso de duplicidade (improvável)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`Pagamento com externalId "${externalPaymentId}" não encontrado.`);
      return null;
    }
    // Retorna o primeiro documento encontrado
    return snapshot.docs[0].data() as FirebasePayment;
  } catch (error) {
    console.error(`Erro ao buscar pagamento por externalId "${externalPaymentId}":`, error);
    // Em caso de erro (ex: índice faltando, embora 'externalId' deva ser indexado por padrão se usado em where)
    // pode-se tentar uma busca sem ordenação, mas isso é menos ideal.
    // Por ora, apenas logamos e retornamos null ou relançamos o erro dependendo da política.
    // Para este caso, vamos retornar null para que o controller possa lidar com isso.
    return null;
  }
};

