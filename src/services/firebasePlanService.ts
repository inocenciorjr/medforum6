import admin, { firestore } from "../config/firebaseAdmin";
import { FirebasePlan, FirebasePlanInterval } from "../types/firebaseTypes";

const plansCollection = firestore.collection("plans");

/**
 * Cria um novo plano no Firestore.
 * O ID do plano pode ser fornecido ou será gerado automaticamente pelo Firestore.
 */
export const createPlan = async (planData: Omit<FirebasePlan, "id" | "createdAt" | "updatedAt">, planId?: string): Promise<FirebasePlan> => {
  try {
    const docRef = planId ? plansCollection.doc(planId) : plansCollection.doc();
    const newPlan: FirebasePlan = {
      id: docRef.id,
      ...planData,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };
    await docRef.set(newPlan);
    console.log(`Plano "${newPlan.name}" (ID: ${newPlan.id}) criado com sucesso.`);
    return newPlan;
  } catch (error) {
    console.error("Erro ao criar novo plano:", error);
    throw error;
  }
};

/**
 * Busca um plano no Firestore pelo ID.
 */
export const getPlan = async (planId: string): Promise<FirebasePlan | null> => {
  try {
    const doc = await plansCollection.doc(planId).get();
    if (!doc.exists) {
      console.log(`Plano com ID ${planId} não encontrado.`);
      return null;
    }
    return doc.data() as FirebasePlan;
  } catch (error) {
    console.error(`Erro ao buscar plano ${planId}:`, error);
    throw error;
  }
};

/**
 * Busca todos os planos ativos e públicos.
 * Ordena por displayOrder se disponível, senão por nome.
 */
export const getActivePublicPlans = async (): Promise<FirebasePlan[]> => {
  try {
    // Usando uma abordagem alternativa para evitar a necessidade de índice composto
    // Primeiro filtramos por isActive e depois filtramos o resultado em memória
    const snapshot = await plansCollection
      .where("isActive", "==", true)
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    
    // Filtragem em memória para isPublic
    const activePlans = snapshot.docs.map(doc => doc.data() as FirebasePlan);
    const activePublicPlans = activePlans.filter(plan => plan.isPublic === true);
    
    // Ordenação opcional em memória
    // activePublicPlans.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    
    return activePublicPlans;
  } catch (error) {
    console.error("Erro ao buscar planos ativos e públicos:", error);
    throw error;
  }
};

/**
 * Busca todos os planos (ativos ou inativos, públicos ou não), ordenados por nome.
 * Útil para painéis de administração.
 */
export const getAllPlansAdmin = async (): Promise<FirebasePlan[]> => {
  try {
    const snapshot = await plansCollection.orderBy("name", "asc").get();
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => doc.data() as FirebasePlan);
  } catch (error) {
    console.error("Erro ao buscar todos os planos (admin):", error);
    throw error;
  }
};


/**
 * Atualiza um plano existente no Firestore.
 */
export const updatePlan = async (planId: string, updates: Partial<Omit<FirebasePlan, "id" | "createdAt" | "updatedAt">>): Promise<FirebasePlan | null> => {
  try {
    const docRef = plansCollection.doc(planId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`Plano com ID ${planId} não encontrado para atualização.`);
    }
    const dataToUpdate = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.update(dataToUpdate);
    console.log(`Plano (ID: ${planId}) atualizado com sucesso.`);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as FirebasePlan;
  } catch (error: any) {
    console.error(`Erro ao atualizar plano (ID: ${planId}):`, error);
    throw error;
  }
};

/**
 * Exclui um plano do Firestore.
 */
export const deletePlan = async (planId: string): Promise<void> => {
  try {
    const docRef = plansCollection.doc(planId);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.warn(`Plano (ID: ${planId}) não encontrado para exclusão.`);
      return;
    }
    await docRef.delete();
    console.log(`Plano (ID: ${planId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir plano (ID: ${planId}):`, error);
    throw error;
  }
};

