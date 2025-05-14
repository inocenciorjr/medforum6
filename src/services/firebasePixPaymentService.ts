import { firestore as db } from "../config/firebaseAdmin";
import { 
  FirebasePixPayment, 
  FirebasePixStatus,
  FirebasePayment,
  FirebasePaymentStatus
} from "../types/firebasePaymentTypes";
import { Timestamp } from "firebase-admin/firestore";
import { getPaymentById, updatePayment } from "./firebasePaymentService";

const PIX_PAYMENTS_COLLECTION = "pixPayments";

/**
 * Cria um novo registro de pagamento PIX.
 */
export const createPixPayment = async (
  paymentData: Omit<FirebasePixPayment, "id" | "createdAt" | "updatedAt">
): Promise<FirebasePixPayment> => {
  const paymentRef = db.collection(PIX_PAYMENTS_COLLECTION).doc();
  const now = Timestamp.now();

  const newPayment: FirebasePixPayment = {
    id: paymentRef.id,
    ...paymentData,
    createdAt: now,
    updatedAt: now,
  };

  await paymentRef.set(newPayment);
  console.log(`Pagamento PIX (ID: ${newPayment.id}) para o pagamento ${newPayment.paymentId} criado com sucesso.`);
  
  // Atualizar o pagamento principal com os dados do PIX
  await updatePayment(paymentData.paymentId, {
    pixCode: paymentData.pixCopiaECola,
    pixExpirationDate: paymentData.expirationDate
  });
  
  return newPayment;
};

/**
 * Busca um pagamento PIX pelo ID.
 */
export const getPixPaymentById = async (paymentId: string): Promise<FirebasePixPayment | null> => {
  const docRef = db.collection(PIX_PAYMENTS_COLLECTION).doc(paymentId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebasePixPayment;
  }
  console.warn(`Pagamento PIX (ID: ${paymentId}) não encontrado.`);
  return null;
};

/**
 * Busca um pagamento PIX pelo ID do pagamento principal.
 */
export const getPixPaymentByPaymentId = async (paymentId: string): Promise<FirebasePixPayment | null> => {
  try {
    const snapshot = await db.collection(PIX_PAYMENTS_COLLECTION)
      .where("paymentId", "==", paymentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`Nenhum pagamento PIX encontrado para o pagamento ID: ${paymentId}`);
      return null;
    }

    return snapshot.docs[0].data() as FirebasePixPayment;
  } catch (error) {
    console.error(`Erro ao buscar pagamento PIX para o pagamento ID: ${paymentId}:`, error);
    throw error;
  }
};

/**
 * Atualiza um registro de pagamento PIX existente.
 */
export const updatePixPayment = async (
  paymentId: string, 
  updates: Partial<Omit<FirebasePixPayment, "id" | "createdAt">>
): Promise<FirebasePixPayment | null> => {
  const paymentRef = db.collection(PIX_PAYMENTS_COLLECTION).doc(paymentId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await paymentRef.update(updateData);
    console.log(`Pagamento PIX (ID: ${paymentId}) atualizado com sucesso.`);
    const updatedDoc = await paymentRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebasePixPayment : null;
  } catch (error) {
    console.error(`Erro ao atualizar pagamento PIX (ID: ${paymentId}):`, error);
    if ((error as any).code === 'firestore/not-found' || (error as any).message.includes('NOT_FOUND')) {
      console.warn(`Tentativa de atualizar pagamento PIX inexistente: ${paymentId}`);
    }
    throw error;
  }
};

/**
 * Verifica se um pagamento PIX está expirado.
 */
export const isPixPaymentExpired = (payment: FirebasePixPayment): boolean => {
  if (payment.status !== FirebasePixStatus.PENDING) {
    return payment.status === FirebasePixStatus.EXPIRED;
  }
  
  try {
    const expDate = payment.expirationDate.toDate();
    return !isNaN(expDate.getTime()) && expDate < new Date();
  } catch (error) {
    console.error(`Erro ao verificar expiração do PIX para ID ${payment.id}:`, error);
    return true; // Assume expirado em caso de erro
  }
};

/**
 * Verifica e marca um pagamento PIX como expirado se necessário.
 */
export const checkAndMarkPixPaymentAsExpired = async (paymentId: string): Promise<boolean> => {
  const payment = await getPixPaymentById(paymentId);
  if (!payment) {
    return false;
  }
  
  if (payment.status === FirebasePixStatus.PENDING && isPixPaymentExpired(payment)) {
    await updatePixPayment(paymentId, { status: FirebasePixStatus.EXPIRED });
    
    // Atualizar o pagamento principal
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && mainPayment.status === FirebasePaymentStatus.PENDING) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.REJECTED,
          failureReason: "PIX Expirado"
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após expiração do PIX:`, error);
    }
    
    return true;
  }
  
  return false;
};

/**
 * Marca um pagamento PIX como aprovado.
 */
export const approvePixPayment = async (
  paymentId: string,
  transactionId: string,
  endToEndId?: string
): Promise<FirebasePixPayment | null> => {
  const payment = await getPixPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebasePixStatus.PENDING) {
    console.warn(`Apenas pagamentos PIX pendentes podem ser aprovados. Status atual: ${payment.status}`);
    return null;
  }
  
  if (isPixPaymentExpired(payment)) {
    console.warn(`Não é possível aprovar um pagamento PIX expirado.`);
    await checkAndMarkPixPaymentAsExpired(paymentId);
    return null;
  }
  
  const updates: Partial<FirebasePixPayment> = {
    status: FirebasePixStatus.APPROVED,
    transactionId
  };
  
  if (endToEndId !== undefined) {
    updates.endToEndId = endToEndId;
  }
  
  const updatedPixPayment = await updatePixPayment(paymentId, updates);
  
  // Atualizar o pagamento principal
  if (updatedPixPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && mainPayment.status === FirebasePaymentStatus.PENDING) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.APPROVED,
          paidAt: Timestamp.now(),
          externalId: transactionId,
          transactionData: {
            ...(mainPayment.transactionData || {}),
            pixEndToEndId: endToEndId,
            pixTransactionId: transactionId
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após aprovação do PIX:`, error);
    }
  }
  
  return updatedPixPayment;
};

/**
 * Cancela um pagamento PIX pendente.
 */
export const cancelPixPayment = async (paymentId: string): Promise<FirebasePixPayment | null> => {
  const payment = await getPixPaymentById(paymentId);
  if (!payment) {
    return null;
  }
  
  if (payment.status !== FirebasePixStatus.PENDING) {
    console.warn(`Apenas pagamentos PIX pendentes podem ser cancelados. Status atual: ${payment.status}`);
    return null;
  }
  
  const updatedPixPayment = await updatePixPayment(paymentId, { status: FirebasePixStatus.CANCELLED });
  
  // Atualizar o pagamento principal
  if (updatedPixPayment) {
    try {
      const mainPayment = await getPaymentById(payment.paymentId);
      if (mainPayment && mainPayment.status === FirebasePaymentStatus.PENDING) {
        await updatePayment(payment.paymentId, {
          status: FirebasePaymentStatus.CANCELLED,
          cancelledAt: Timestamp.now(),
          failureReason: "PIX Cancelado pelo usuário ou sistema"
        });
      }
    } catch (error) {
      console.error(`Erro ao atualizar pagamento principal após cancelamento do PIX:`, error);
    }
  }
  
  return updatedPixPayment;
};

/**
 * Verifica e atualiza o status de todos os pagamentos PIX pendentes que estão expirados.
 * Útil para ser executado periodicamente por um job ou trigger.
 */
export const checkAndUpdateExpiredPixPayments = async (): Promise<number> => {
  try {
    const now = Timestamp.now();
    const snapshot = await db.collection(PIX_PAYMENTS_COLLECTION)
      .where("status", "==", FirebasePixStatus.PENDING)
      .where("expirationDate", "<", now)
      .get();
    
    if (snapshot.empty) {
      console.log("Nenhum pagamento PIX expirado encontrado.");
      return 0;
    }
    
    const batch = db.batch();
    const expiredPaymentIds: string[] = [];
    
    snapshot.forEach(doc => {
      const pixPayment = doc.data() as FirebasePixPayment;
      expiredPaymentIds.push(pixPayment.paymentId);
      batch.update(doc.ref, { 
        status: FirebasePixStatus.EXPIRED,
        updatedAt: now
      });
    });
    
    await batch.commit();
    console.log(`${expiredPaymentIds.length} pagamentos PIX marcados como expirados.`);
    
    // Atualizar os pagamentos principais em lote
    const mainPaymentsBatch = db.batch();
    const mainPaymentsSnapshot = await db.collection("payments")
      .where("status", "==", FirebasePaymentStatus.PENDING)
      .where("__name__", "in", expiredPaymentIds)
      .get();
    
    mainPaymentsSnapshot.forEach(doc => {
      mainPaymentsBatch.update(doc.ref, {
        status: FirebasePaymentStatus.REJECTED,
        failureReason: "PIX Expirado",
        updatedAt: now
      });
    });
    
    await mainPaymentsBatch.commit();
    console.log(`${mainPaymentsSnapshot.size} pagamentos principais atualizados após expiração do PIX.`);
    
    return expiredPaymentIds.length;
  } catch (error) {
    console.error("Erro ao verificar pagamentos PIX expirados:", error);
    throw error;
  }
};

/**
 * Exclui um registro de pagamento PIX.
 */
export const deletePixPayment = async (paymentId: string): Promise<void> => {
  const paymentRef = db.collection(PIX_PAYMENTS_COLLECTION).doc(paymentId);
  try {
    await paymentRef.delete();
    console.log(`Pagamento PIX (ID: ${paymentId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir pagamento PIX (ID: ${paymentId}):`, error);
    throw error;
  }
};