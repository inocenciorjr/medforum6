import { firestore as db } from "../config/firebaseAdmin";
import { FirebaseUserPlan, FirebasePaymentMethodType, FirebaseUserPlanStatus, FirebasePaymentMethod, FirebasePlan } from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";

const USER_PLANS_COLLECTION = "user_plans";
const PLANS_COLLECTION = "plans";

/**
 * Busca um plano pelo ID.
 */
export const getPlanById = async (planId: string): Promise<FirebasePlan | null> => {
  const docRef = db.collection(PLANS_COLLECTION).doc(planId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebasePlan;
  }
  console.warn(`Plano (ID: ${planId}) não encontrado.`);
  return null;
};

/**
 * Busca todos os planos ativos de um usuário.
 */
export const getUserActivePlans = async (userId: string): Promise<FirebaseUserPlan[]> => {
  const plans: FirebaseUserPlan[] = [];
  const snapshot = await db.collection(USER_PLANS_COLLECTION)
    .where("userId", "==", userId)
    .where("status", "==", FirebaseUserPlanStatus.ACTIVE)
    .get();
  
  snapshot.forEach(doc => {
    plans.push(doc.data() as FirebaseUserPlan);
  });
  return plans;
};

/**
 * Cria uma nova assinatura de plano para um usuário.
 */
export const createUserPlan = async (
  userId: string, 
  planId: string, 
  startedAtDate: Date,
  endsAtDate: Date | null,
  status: FirebaseUserPlanStatus, 
  paymentId?: string, 
  paymentMethod?: FirebasePaymentMethodType | FirebasePaymentMethod | null, 
  autoRenew: boolean = false, 
  paymentGatewaySubscriptionId?: string | null,
  metadata?: Record<string, any>
): Promise<FirebaseUserPlan> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc();
  const now = Timestamp.now();

  const newUserPlan: FirebaseUserPlan = {
    id: userPlanRef.id,
    userId,
    planId,
    startDate: Timestamp.fromDate(startedAtDate), // Adicionado para compatibilidade
    startedAt: Timestamp.fromDate(startedAtDate),
    endsAt: endsAtDate ? Timestamp.fromDate(endsAtDate) : null,
    // expiresAt is intentionally omitted, use endsAt
    status,
    paymentId: paymentId ?? null,
    paymentMethod: paymentMethod ?? null,
    autoRenew,
    paymentGatewaySubscriptionId: paymentGatewaySubscriptionId ?? null,
    cancellationReason: null,
    cancelledAt: null,
    metadata: metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await userPlanRef.set(newUserPlan);
  console.log(`UserPlan (ID: ${newUserPlan.id}) para o usuário ${userId} e plano ${planId} criado com sucesso.`);
  return newUserPlan;
};

/**
 * Busca uma assinatura de plano pelo ID.
 */
export const getUserPlanById = async (userPlanId: string): Promise<FirebaseUserPlan | null> => {
  const docRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseUserPlan;
  }
  console.warn(`UserPlan (ID: ${userPlanId}) não encontrado.`);
  return null;
};

/**
 * Busca todas as assinaturas de plano de um usuário específico.
 */
export const getUserPlansByUserId = async (userId: string): Promise<FirebaseUserPlan[]> => {
  const plans: FirebaseUserPlan[] = [];
  // Adicionar ordenação para consistência, se necessário, ex: .orderBy("createdAt", "desc")
  const snapshot = await db.collection(USER_PLANS_COLLECTION).where("userId", "==", userId).get();
  snapshot.forEach(doc => {
    plans.push(doc.data() as FirebaseUserPlan);
  });
  return plans;
};

/**
 * Busca a assinatura ativa de um usuário para um plano específico (se houver).
 */
export const getActiveUserPlanByUserIdAndPlanId = async (userId: string, planId: string): Promise<FirebaseUserPlan | null> => {
  const snapshot = await db.collection(USER_PLANS_COLLECTION)
    .where("userId", "==", userId)
    .where("planId", "==", planId)
    .where("status", "==", FirebaseUserPlanStatus.ACTIVE)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return snapshot.docs[0].data() as FirebaseUserPlan;
  }
  return null;
};

/**
 * Atualiza uma assinatura de plano existente.
 * Garante que Timestamps sejam tratados corretamente.
 */
export const updateUserPlan = async (userPlanId: string, updates: Partial<Omit<FirebaseUserPlan, "id" | "createdAt">>): Promise<FirebaseUserPlan | null> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  
  const updateData: any = { ...updates, updatedAt: Timestamp.now() }; 

  // Converter datas para Timestamps, se presentes e forem instâncias de Date
  if (updates.startedAt && updates.startedAt instanceof Date) {
    updateData.startedAt = Timestamp.fromDate(updates.startedAt);
  }
  if (updates.endsAt && updates.endsAt instanceof Date) {
    updateData.endsAt = Timestamp.fromDate(updates.endsAt);
  }
  if (updates.endsAt === null) { 
    updateData.endsAt = null; // Permitir definir endsAt como null explicitamente
  }
  if (updates.expiresAt && updates.expiresAt instanceof Date) { // Manter compatibilidade se alguém usar expiresAt
    updateData.expiresAt = Timestamp.fromDate(updates.expiresAt);
    if (!updates.endsAt) updateData.endsAt = updateData.expiresAt; // Sincronizar com endsAt se não definido
  }
   if (updates.expiresAt === null) { 
    updateData.expiresAt = null;
    if (updates.endsAt === undefined) updateData.endsAt = null;
  }
  if (updates.cancelledAt && updates.cancelledAt instanceof Date) {
    updateData.cancelledAt = Timestamp.fromDate(updates.cancelledAt);
  }
  if (updates.cancelledAt === null) { 
    updateData.cancelledAt = null;
  }

  // Remover expiresAt do objeto de atualização final se endsAt estiver presente, para evitar redundância
  if (updateData.endsAt !== undefined && updateData.expiresAt !== undefined) {
    delete updateData.expiresAt;
  }

  await userPlanRef.update(updateData as Partial<FirebaseUserPlan>); 
  console.log(`UserPlan (ID: ${userPlanId}) atualizado com sucesso.`);
  const updatedDoc = await userPlanRef.get();
  return updatedDoc.exists ? updatedDoc.data() as FirebaseUserPlan : null;
};

/**
 * Exclui uma assinatura de plano.
 */
export const deleteUserPlan = async (userPlanId: string): Promise<void> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  await userPlanRef.delete();
  console.log(`UserPlan (ID: ${userPlanId}) excluído com sucesso.`);
};

/**
 * Renova uma assinatura de plano estendendo a data de término.
 */
export const renewUserPlan = async (
  userPlanId: string, 
  durationDays: number, 
  newPaymentId?: string, 
  newPaymentMethod?: FirebasePaymentMethodType | FirebasePaymentMethod | null,
  newPaymentGatewaySubscriptionId?: string | null
): Promise<FirebaseUserPlan | null> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  const docSnap = await userPlanRef.get();

  if (!docSnap.exists) {
    console.error(`UserPlan (ID: ${userPlanId}) não encontrado para renovação.`);
    return null;
  }

  const userPlan = docSnap.data() as FirebaseUserPlan;
  const currentEndsAt = userPlan.endsAt ? userPlan.endsAt.toDate() : new Date();
  // Se o plano já expirou, a renovação começa a partir de agora.
  // Se ainda está ativo, a renovação estende a data de término atual.
  const renewalStartDate = currentEndsAt < new Date() ? new Date() : currentEndsAt;

  const newEndsAtDate = new Date(renewalStartDate);
  newEndsAtDate.setDate(newEndsAtDate.getDate() + durationDays);

  const updates: Partial<FirebaseUserPlan> = {
    endsAt: Timestamp.fromDate(newEndsAtDate),
    // expiresAt: Timestamp.fromDate(newEndsAtDate), // Omitir, usar endsAt
    status: FirebaseUserPlanStatus.ACTIVE,
    paymentId: newPaymentId ?? userPlan.paymentId,
    paymentMethod: newPaymentMethod ?? userPlan.paymentMethod,
    paymentGatewaySubscriptionId: newPaymentGatewaySubscriptionId !== undefined ? newPaymentGatewaySubscriptionId : userPlan.paymentGatewaySubscriptionId,
    autoRenew: userPlan.autoRenew, // Manter a configuração de autoRenew existente, a menos que explicitamente alterada
    cancellationReason: null, // Limpar motivo de cancelamento anterior, se houver
    cancelledAt: null,      // Limpar data de cancelamento anterior, se houver
    updatedAt: Timestamp.now(),
  };

  await userPlanRef.update(updates);
  console.log(`UserPlan (ID: ${userPlanId}) renovado com sucesso até ${newEndsAtDate.toISOString()}.`);
  const updatedDoc = await userPlanRef.get();
  return updatedDoc.exists ? updatedDoc.data() as FirebaseUserPlan : null;
};

/**
 * Cancela uma assinatura de plano.
 */
export const cancelUserPlan = async (userPlanId: string, reason?: string): Promise<FirebaseUserPlan | null> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  const docSnap = await userPlanRef.get();

  if (!docSnap.exists) {
    console.error(`UserPlan (ID: ${userPlanId}) não encontrado para cancelamento.`);
    return null;
  }

  const userPlan = docSnap.data() as FirebaseUserPlan;

  if (userPlan.status === FirebaseUserPlanStatus.CANCELLED) {
    console.warn(`UserPlan (ID: ${userPlanId}) já está cancelado.`);
    return userPlan;
  }

  const updates: Partial<FirebaseUserPlan> = {
    status: FirebaseUserPlanStatus.CANCELLED,
    autoRenew: false, // Cancelamento geralmente implica em não renovar automaticamente
    cancelledAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  if (reason) {
    updates.cancellationReason = reason;
  }

  await userPlanRef.update(updates);
  console.log(`UserPlan (ID: ${userPlanId}) cancelado com sucesso. Motivo: ${reason || 'Não especificado'}`);
  const updatedDoc = await userPlanRef.get();
  return updatedDoc.exists ? updatedDoc.data() as FirebaseUserPlan : null;
};

/**
 * Atualiza o status de uma assinatura de plano.
 */
export const updateUserPlanStatus = async (userPlanId: string, newStatus: FirebaseUserPlanStatus, reason?: string): Promise<FirebaseUserPlan | null> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  const docSnap = await userPlanRef.get();

  if (!docSnap.exists) {
    console.error(`UserPlan (ID: ${userPlanId}) não encontrado para atualização de status.`);
    return null;
  }
  const userPlan = docSnap.data() as FirebaseUserPlan;

  if (userPlan.status === newStatus) {
    console.warn(`UserPlan (ID: ${userPlanId}) já está com o status ${newStatus}.`);
    return userPlan;
  }

  const updates: Partial<FirebaseUserPlan> = {
    status: newStatus,
    updatedAt: Timestamp.now(),
  };

  if (newStatus === FirebaseUserPlanStatus.EXPIRED || newStatus === FirebaseUserPlanStatus.CANCELLED || newStatus === FirebaseUserPlanStatus.SUSPENDED) {
    updates.autoRenew = false;
  }
  if (newStatus === FirebaseUserPlanStatus.CANCELLED) {
    updates.cancelledAt = userPlan.cancelledAt || Timestamp.now(); // Manter data original se já cancelado, senão nova data
    updates.cancellationReason = reason || userPlan.cancellationReason || "Cancelado pelo sistema";
  }
  if (newStatus === FirebaseUserPlanStatus.SUSPENDED) {
    // Poderia adicionar um campo `suspendedAt` ou `suspensionReason` se necessário
    updates.cancellationReason = reason || "Plano suspenso"; 
  }
  if (newStatus === FirebaseUserPlanStatus.ACTIVE) {
    updates.cancellationReason = null;
    updates.cancelledAt = null;
  }

  await userPlanRef.update(updates);
  console.log(`Status do UserPlan (ID: ${userPlanId}) atualizado para ${newStatus}.`);
  const updatedDoc = await userPlanRef.get();
  return updatedDoc.exists ? updatedDoc.data() as FirebaseUserPlan : null;
};

/**
 * Adiciona ou atualiza metadados para uma assinatura de plano.
 */
export const updateUserPlanMetadata = async (userPlanId: string, metadataUpdates: Record<string, any>): Promise<FirebaseUserPlan | null> => {
  const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(userPlanId);
  const docSnap = await userPlanRef.get();

  if (!docSnap.exists) {
    console.error(`UserPlan (ID: ${userPlanId}) não encontrado para atualização de metadados.`);
    return null;
  }

  const userPlan = docSnap.data() as FirebaseUserPlan;
  const newMetadata = { ...(userPlan.metadata || {}), ...metadataUpdates };

  try {
    JSON.stringify(newMetadata); 
  } catch (error) {
    console.error(`Erro ao serializar metadados para UserPlan ID ${userPlanId}:`, error);
    throw new Error("Falha ao atualizar metadados: dados inválidos.");
  }

  const updates: Partial<FirebaseUserPlan> = {
    metadata: newMetadata,
    updatedAt: Timestamp.now(),
  };

  await userPlanRef.update(updates);
  console.log(`Metadados do UserPlan (ID: ${userPlanId}) atualizados com sucesso.`);
  const updatedDoc = await userPlanRef.get();
  return updatedDoc.exists ? updatedDoc.data() as FirebaseUserPlan : null;
};

/**
 * Verifica e atualiza o status de planos de usuário expirados.
 * Agora usa `endsAt` para verificar a expiração.
 */
export const checkAndExpireUserPlans = async (): Promise<{ updatedCount: number }> => {
  const now = Timestamp.now();
  const plansToExpireQuery = db.collection(USER_PLANS_COLLECTION)
    .where("status", "in", [FirebaseUserPlanStatus.ACTIVE, FirebaseUserPlanStatus.PENDING_RENEWAL]) // Inclui PENDING_RENEWAL
    .where("endsAt", "!=", null)
    .where("endsAt", "<", now);

  const snapshot = await plansToExpireQuery.get();

  if (snapshot.empty) {
    console.log("[UserPlan Check] Nenhum plano de usuário para expirar.");
    return { updatedCount: 0 };
  }

  const batch = db.batch();
  snapshot.forEach(doc => {
    const userPlanRef = db.collection(USER_PLANS_COLLECTION).doc(doc.id);
    batch.update(userPlanRef, { 
      status: FirebaseUserPlanStatus.EXPIRED, 
      autoRenew: false, // Planos expirados não devem renovar automaticamente
      updatedAt: Timestamp.now()
    });
  });

  await batch.commit();
  console.log(`[UserPlan Check] ${snapshot.size} planos de usuário atualizados para o status EXPIRED.`);
  return { updatedCount: snapshot.size };
};



/**
 * Manipula a alteração do plano do usuário após um reembolso.
 * Por exemplo, cancela ou ajusta o plano associado ao pagamento reembolsado.
 */
export const handlePlanChangeAfterRefund = async (paymentId: string): Promise<void> => {
  console.log(`[UserPlan Service] Iniciando manipulação de plano após reembolso para paymentId: ${paymentId}`);
  const snapshot = await db.collection(USER_PLANS_COLLECTION)
    .where("paymentId", "==", paymentId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.warn(`[UserPlan Service] Nenhum UserPlan encontrado para o paymentId: ${paymentId} durante o reembolso.`);
    return;
  }

  const userPlanDoc = snapshot.docs[0];
  const userPlan = userPlanDoc.data() as FirebaseUserPlan;

  console.log(`[UserPlan Service] UserPlan (ID: ${userPlan.id}) encontrado para paymentId: ${paymentId}. Status atual: ${userPlan.status}`);

  // Lógica de exemplo: Cancelar o plano ou marcar como expirado.
  // A lógica exata pode depender dos requisitos de negócio.
  // Por ora, vamos cancelar o plano se ele estiver ativo.
  if (userPlan.status === FirebaseUserPlanStatus.ACTIVE || userPlan.status === FirebaseUserPlanStatus.PENDING_RENEWAL) {
    const updates: Partial<FirebaseUserPlan> = {
      status: FirebaseUserPlanStatus.CANCELLED,
      cancellationReason: "Reembolso processado para o pagamento associado.",
      cancelledAt: Timestamp.now(),
      autoRenew: false,
      updatedAt: Timestamp.now(),
    };
    await userPlanDoc.ref.update(updates);
    console.log(`[UserPlan Service] UserPlan (ID: ${userPlan.id}) status atualizado para CANCELLED devido a reembolso.`);
  } else {
    console.log(`[UserPlan Service] UserPlan (ID: ${userPlan.id}) não estava ATIVO ou PENDENTE_RENOVAÇÃO. Nenhuma alteração de status aplicada devido a reembolso.`);
  }
};

/**
 * Busca todos os planos disponíveis no sistema (coleção 'plans').
 */
export const getAllPlans = async (): Promise<FirebasePlan[]> => {
  const plans: FirebasePlan[] = [];
  const snapshot = await db.collection(PLANS_COLLECTION).get();
  
  snapshot.forEach(doc => {
    plans.push({ id: doc.id, ...doc.data() } as FirebasePlan);
  });
  console.log(`[UserPlan Service] ${plans.length} planos encontrados.`);
  return plans;
};

