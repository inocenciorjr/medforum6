import { firestore as db } from "../config/firebaseAdmin";
import { 
  FirebaseCreditCardPayment, 
  FirebaseCreditCardPaymentStatus,
  FirebasePayment,
  FirebasePaymentStatus
} from "../types/firebasePaymentTypes";
import { Timestamp } from "firebase-admin/firestore";
import { getPaymentById, updatePayment } from "./firebasePaymentService";

const CREDIT_CARD_PAYMENTS_COLLECTION = "creditCardPayments";

/**
 * Cria um novo registro de pagamento por cartão de crédito.
 */
export const createCreditCardPayment = async (
  paymentData: Omit<FirebaseCreditCardPayment, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseCreditCardPayment> => {
  const paymentRef = db.collection(CREDIT_CARD_PAYMENTS_COLLECTION).doc();
  const now = Timestamp.now();

  const newPayment: FirebaseCreditCardPayment = {
    id: paymentRef.id,
    ...paymentData,
    createdAt: now,
    updatedAt: now,
  };

  await paymentRef.set(newPayment);
  console.log(`Pagamento por cartão de crédito (ID: ${newPayment.id}) para o pagamento ${newPayment.paymentId} criado com sucesso.`);
  
  // Atualizar o pagamento principal com os dados do cartão
  await updatePayment(paymentData.paymentId, {
    cardLastFourDigits: paymentData.cardLastFourDigits,
    cardBrand: paymentData.cardBrand,
    installments: paymentData.installments
  });
  
  return newPayment;
};

/**
 * Busca um pagamento por cartão de crédito pelo ID.
 */
export const getCreditCardPaymentById = async (paymentId: string): Promise<FirebaseCreditCardPayment | null> => {
  const docRef = db.collection(CREDIT_CARD_PAYMENTS_COLLECTION).doc(paymentId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseCreditCardPayment;
  }
  console.warn(`Pagamento por cartão de crédito (ID: ${paymentId}) não encontrado.`);
  return null;
};

/**
 * Busca um pagamento por cartão de crédito pelo ID do pagamento principal.
 */
export const getCreditCardPaymentByPaymentId = async (paymentId: string): Promise<FirebaseCreditCardPayment | null> => {
  try {
    const snapshot = await db.collection(CREDIT_CARD_PAYMENTS_COLLECTION)
      .where("paymentId", "==", paymentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`Nenhum pagamento por cartão de crédito encontrado para o pagamento ID: ${paymentId}`);
      return null;
    }

    return snapshot.docs[0].data() as FirebaseCreditCardPayment;
  } catch (error) {
    console.error(`Erro ao buscar pagamento por cartão de crédito para o pagamento ID: ${paymentId}:`, error);
    throw error;
  }
};

/**
 * Atualiza um registro de pagamento por cartão de crédito existente.
 */
export const updateCreditCardPayment = async (
  paymentId: string, 
  updates: Partial<Omit<FirebaseCreditCardPayment, "id" | "createdAt">>
): Promise<FirebaseCreditCardPayment | null> => {
  const paymentRef = db.collection(CREDIT_CARD_PAYMENTS_COLLECTION).doc(paymentId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await paymentRef.update(updateData);
    console.log(`Pagamento por cartão de crédito (ID: ${paymentId}) atualizado com sucesso.`);
    const updatedDoc = await paymentRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseCreditCardPayment : null;
  } catch (error) {
    console.error(`Erro ao atualizar pagamento por cartão de crédito (ID: ${paymentId}):`, error);
    if ((error as any).code === 'firestore/not-found' || (error as any).message.includes('NOT_FOUND')) {
      console.warn(`Tentativa de atualizar pagamento por cartão de crédito inexistente: ${paymentId}`);
    }
    throw error;
  }
};

/**
 * Atualiza o status de um pagamento por cartão de crédito e detalhes relacionados.
 */
export const updateCreditCardPaymentStatus = async (
  paymentId: string,
  status: FirebaseCreditCardPaymentStatus,
  details?: Partial<FirebaseCreditCardPayment>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }

  const updates: Partial<FirebaseCreditCardPayment> = {
    status,
  };

  if (details) {
    if (details.transactionId !== undefined) updates.transactionId = details.transactionId;
    if (details.authorizationCode !== undefined) updates.authorizationCode = details.authorizationCode;
    if (details.nsu !== undefined) updates.nsu = details.nsu;
    if (details.gatewayResponse !== undefined) updates.gatewayResponse = details.gatewayResponse;
    if (details.errorCode !== undefined) updates.errorCode = details.errorCode;
    if (details.errorMessage !== undefined) updates.errorMessage = details.errorMessage;
    if (details.refundId !== undefined) updates.refundId = details.refundId;
    if (details.refundAmount !== undefined) updates.refundAmount = details.refundAmount;
  }

  // Limpar campos de erro se o status for bem-sucedido
  if (status === FirebaseCreditCardPaymentStatus.AUTHORIZED || status === FirebaseCreditCardPaymentStatus.CAPTURED) {
    updates.errorCode = null;
    updates.errorMessage = null;
  }

  return updateCreditCardPayment(paymentId, updates);
};

/**
 * Autoriza um pagamento por cartão de crédito.
 * Este é o primeiro passo no processamento de cartão de crédito.
 */
export const authorizeCreditCardPayment = async (
  paymentId: string,
  transactionId: string,
  authorizationCode?: string,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebaseCreditCardPaymentStatus.PENDING) {
    console.warn(`Apenas pagamentos pendentes podem ser autorizados. Status atual: ${payment.status}`);
    return null;
  }

  return updateCreditCardPaymentStatus(paymentId, FirebaseCreditCardPaymentStatus.AUTHORIZED, {
    transactionId,
    authorizationCode,
    gatewayResponse
  });
};

/**
 * Captura um pagamento por cartão de crédito previamente autorizado.
 * Este é o segundo passo no processamento de cartão de crédito.
 */
export const captureCreditCardPayment = async (
  paymentId: string,
  transactionId?: string,
  nsu?: string,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebaseCreditCardPaymentStatus.AUTHORIZED) {
    console.warn(`Apenas pagamentos autorizados podem ser capturados. Status atual: ${payment.status}`);
    return null;
  }

  const updatedCCPayment = await updateCreditCardPaymentStatus(paymentId, FirebaseCreditCardPaymentStatus.CAPTURED, {
    transactionId: transactionId || payment.transactionId,
    nsu,
    gatewayResponse
  });

  // Atualizar o pagamento principal para aprovado
  if (updatedCCPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && mainPayment.status === FirebasePaymentStatus.PENDING) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.APPROVED,
          paidAt: Timestamp.now(),
          externalId: updatedCCPayment.transactionId || undefined,
          transactionData: {
            ...(mainPayment.transactionData || {}),
            creditCardCapture: updatedCCPayment.gatewayResponse
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após captura do cartão de crédito:`, error);
    }
  }

  return updatedCCPayment;
};

/**
 * Rejeita um pagamento por cartão de crédito.
 */
export const rejectCreditCardPayment = async (
  paymentId: string,
  errorCode: string,
  errorMessage: string,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebaseCreditCardPaymentStatus.PENDING && 
      payment.status !== FirebaseCreditCardPaymentStatus.AUTHORIZED) {
    console.warn(`Apenas pagamentos pendentes ou autorizados podem ser rejeitados. Status atual: ${payment.status}`);
    return null;
  }

  const updatedCCPayment = await updateCreditCardPaymentStatus(paymentId, FirebaseCreditCardPaymentStatus.REJECTED, {
    errorCode,
    errorMessage,
    gatewayResponse
  });

  // Atualizar o pagamento principal para rejeitado
  if (updatedCCPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && (mainPayment.status === FirebasePaymentStatus.PENDING)) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.REJECTED,
          failureReason: errorMessage,
          transactionData: {
            ...(mainPayment.transactionData || {}),
            creditCardRejection: updatedCCPayment.gatewayResponse
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após rejeição do cartão de crédito:`, error);
    }
  }

  return updatedCCPayment;
};

/**
 * Reembolsa um pagamento por cartão de crédito capturado.
 */
export const refundCreditCardPayment = async (
  paymentId: string,
  refundId: string,
  refundAmount?: number,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebaseCreditCardPaymentStatus.CAPTURED) {
    console.warn(`Apenas pagamentos capturados podem ser reembolsados. Status atual: ${payment.status}`);
    return null;
  }

  // Determinar se é um reembolso total ou parcial
  const isPartialRefund = refundAmount !== undefined && 
                          refundAmount > 0 && 
                          refundAmount < (payment.refundAmount || 0);
  
  const status = isPartialRefund 
    ? FirebaseCreditCardPaymentStatus.PARTIALLY_REFUNDED 
    : FirebaseCreditCardPaymentStatus.REFUNDED;

  const updatedCCPayment = await updateCreditCardPaymentStatus(paymentId, status, {
    refundId,
    refundAmount,
    gatewayResponse
  });

  // Atualizar o pagamento principal para reembolsado (apenas se for reembolso total)
  if (updatedCCPayment && !isPartialRefund) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && mainPayment.status === FirebasePaymentStatus.APPROVED) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.REFUNDED,
          refundReason: "Reembolso processado via gateway de pagamento",
          refundedAt: Timestamp.now(),
          transactionData: {
            ...(mainPayment.transactionData || {}),
            creditCardRefund: updatedCCPayment.gatewayResponse
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após reembolso do cartão de crédito:`, error);
    }
  }

  return updatedCCPayment;
};

/**
 * Cancela um pagamento por cartão de crédito pendente ou autorizado.
 */
export const cancelCreditCardPayment = async (
  paymentId: string,
  reason?: string,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebaseCreditCardPaymentStatus.PENDING && 
      payment.status !== FirebaseCreditCardPaymentStatus.AUTHORIZED) {
    console.warn(`Apenas pagamentos pendentes ou autorizados podem ser cancelados. Status atual: ${payment.status}`);
    return null;
  }

  const updatedCCPayment = await updateCreditCardPaymentStatus(paymentId, FirebaseCreditCardPaymentStatus.CANCELLED, {
    errorMessage: reason || "Cancelado pelo usuário ou sistema",
    gatewayResponse
  });

  // Atualizar o pagamento principal para cancelado
  if (updatedCCPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && (mainPayment.status === FirebasePaymentStatus.PENDING)) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.CANCELLED,
          cancelledAt: Timestamp.now(),
          failureReason: reason || "Cancelado pelo usuário ou sistema",
          transactionData: {
            ...(mainPayment.transactionData || {}),
            creditCardCancellation: updatedCCPayment.gatewayResponse
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após cancelamento do cartão de crédito:`, error);
    }
  }

  return updatedCCPayment;
};

/**
 * Marca um pagamento por cartão de crédito como chargeback.
 */
export const markCreditCardPaymentAsChargeback = async (
  paymentId: string,
  reason: string,
  gatewayResponse?: Record<string, any>
): Promise<FirebaseCreditCardPayment | null> => {
  const payment = await getCreditCardPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status === FirebaseCreditCardPaymentStatus.REFUNDED || 
      payment.status === FirebaseCreditCardPaymentStatus.CANCELLED) {
    console.warn(`Pagamentos reembolsados ou cancelados não podem ser marcados como chargeback. Status: ${payment.status}`);
    return null;
  }

  const updatedCCPayment = await updateCreditCardPaymentStatus(paymentId, FirebaseCreditCardPaymentStatus.CHARGEBACK, {
    errorMessage: reason,
    gatewayResponse
  });

  // Atualizar o pagamento principal para chargeback
  if (updatedCCPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && 
          mainPayment.status !== FirebasePaymentStatus.REFUNDED && 
          mainPayment.status !== FirebasePaymentStatus.CANCELLED) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.CHARGEBACK,
          chargebackReason: reason,
          transactionData: {
            ...(mainPayment.transactionData || {}),
            creditCardChargeback: updatedCCPayment.gatewayResponse
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após chargeback do cartão de crédito:`, error);
    }
  }

  return updatedCCPayment;
};

/**
 * Exclui um registro de pagamento por cartão de crédito.
 */
export const deleteCreditCardPayment = async (paymentId: string): Promise<void> => {
  const paymentRef = db.collection(CREDIT_CARD_PAYMENTS_COLLECTION).doc(paymentId);
  try {
    await paymentRef.delete();
    console.log(`Pagamento por cartão de crédito (ID: ${paymentId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir pagamento por cartão de crédito (ID: ${paymentId}):`, error);
    throw error;
  }
};