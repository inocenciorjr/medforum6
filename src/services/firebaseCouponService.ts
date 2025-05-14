import { firestore as db } from "../config/firebaseAdmin";
import { FirebaseCoupon } from "../types/firebasePaymentTypes";
import { Timestamp } from "firebase-admin/firestore";

const COUPONS_COLLECTION = "coupons";

/**
 * Cria um novo cupom de desconto.
 */
export const createCoupon = async (
  couponData: Omit<FirebaseCoupon, "id" | "timesUsed" | "createdAt" | "updatedAt">
): Promise<FirebaseCoupon> => {
  // Verificar se já existe um cupom com o mesmo código
  const existingCoupon = await getCouponByCode(couponData.code);
  if (existingCoupon) {
    throw new Error(`Já existe um cupom com o código '${couponData.code}'.`);
  }

  const couponRef = db.collection(COUPONS_COLLECTION).doc();
  const now = Timestamp.now();

  const newCoupon: FirebaseCoupon = {
    id: couponRef.id,
    ...couponData,
    timesUsed: 0,
    createdAt: now,
    updatedAt: now,
  };

  await couponRef.set(newCoupon);
  console.log(`Cupom (ID: ${newCoupon.id}, Código: ${newCoupon.code}) criado com sucesso.`);
  return newCoupon;
};

/**
 * Busca um cupom pelo ID.
 */
export const getCouponById = async (couponId: string): Promise<FirebaseCoupon | null> => {
  const docRef = db.collection(COUPONS_COLLECTION).doc(couponId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseCoupon;
  }
  console.warn(`Cupom (ID: ${couponId}) não encontrado.`);
  return null;
};

/**
 * Busca um cupom pelo código.
 */
export const getCouponByCode = async (code: string): Promise<FirebaseCoupon | null> => {
  try {
    const snapshot = await db.collection(COUPONS_COLLECTION)
      .where("code", "==", code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as FirebaseCoupon;
  } catch (error) {
    console.error(`Erro ao buscar cupom pelo código '${code}':`, error);
    throw error;
  }
};

/**
 * Atualiza um cupom existente.
 */
export const updateCoupon = async (
  couponId: string, 
  updates: Partial<Omit<FirebaseCoupon, "id" | "createdAt" | "code">>
): Promise<FirebaseCoupon | null> => {
  const couponRef = db.collection(COUPONS_COLLECTION).doc(couponId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await couponRef.update(updateData);
    console.log(`Cupom (ID: ${couponId}) atualizado com sucesso.`);
    const updatedDoc = await couponRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseCoupon : null;
  } catch (error) {
    console.error(`Erro ao atualizar cupom (ID: ${couponId}):`, error);
    if ((error as any).code === 'firestore/not-found' || (error as any).message.includes('NOT_FOUND')) {
      console.warn(`Tentativa de atualizar cupom inexistente: ${couponId}`);
    }
    throw error;
  }
};

/**
 * Incrementa o contador de uso de um cupom.
 */
export const incrementCouponUsage = async (couponId: string): Promise<FirebaseCoupon | null> => {
  const couponRef = db.collection(COUPONS_COLLECTION).doc(couponId);
  
  try {
    // Usar transação para garantir atomicidade
    const result = await db.runTransaction(async (transaction) => {
      const couponDoc = await transaction.get(couponRef);
      
      if (!couponDoc.exists) {
        throw new Error(`Cupom (ID: ${couponId}) não encontrado.`);
      }
      
      const coupon = couponDoc.data() as FirebaseCoupon;
      
      // Verificar se o cupom está ativo
      if (!coupon.isActive) {
        throw new Error(`Cupom (ID: ${couponId}, Código: ${coupon.code}) está inativo.`);
      }
      
      // Verificar se o cupom expirou
      if (coupon.expirationDate && coupon.expirationDate.toDate() < new Date()) {
        throw new Error(`Cupom (ID: ${couponId}, Código: ${coupon.code}) expirou em ${coupon.expirationDate.toDate()}.`);
      }
      
      // Verificar se o cupom atingiu o limite de usos
      if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.timesUsed >= coupon.maxUses) {
        throw new Error(`Cupom (ID: ${couponId}, Código: ${coupon.code}) atingiu o limite de ${coupon.maxUses} usos.`);
      }
      
      // Incrementar o contador de uso
      const newTimesUsed = coupon.timesUsed + 1;
      transaction.update(couponRef, { 
        timesUsed: newTimesUsed,
        updatedAt: Timestamp.now()
      });
      
      // Se atingiu o limite de usos, desativar o cupom
      if (coupon.maxUses !== null && coupon.maxUses !== undefined && newTimesUsed >= coupon.maxUses) {
        transaction.update(couponRef, { isActive: false });
      }
      
      return {
        ...coupon,
        timesUsed: newTimesUsed
      };
    });
    
    console.log(`Uso do cupom (ID: ${couponId}) incrementado com sucesso.`);
    return result as FirebaseCoupon;
  } catch (error) {
    console.error(`Erro ao incrementar uso do cupom (ID: ${couponId}):`, error);
    throw error;
  }
};

/**
 * Valida um cupom para uso.
 * Verifica se o cupom existe, está ativo, não expirou e não atingiu o limite de usos.
 * Também verifica se o cupom é aplicável ao plano especificado, se houver.
 */
export const validateCoupon = async (
  code: string, 
  planId?: string
): Promise<{ valid: boolean; coupon: FirebaseCoupon | null; message?: string }> => {
  try {
    const coupon = await getCouponByCode(code);
    
    if (!coupon) {
      return { valid: false, coupon: null, message: `Cupom com código '${code}' não encontrado.` };
    }
    
    if (!coupon.isActive) {
      return { valid: false, coupon, message: "Cupom está inativo." };
    }
    
    if (coupon.expirationDate && coupon.expirationDate.toDate() < new Date()) {
      return { valid: false, coupon, message: `Cupom expirou em ${coupon.expirationDate.toDate()}.` };
    }
    
    if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.timesUsed >= coupon.maxUses) {
      return { valid: false, coupon, message: `Cupom atingiu o limite de ${coupon.maxUses} usos.` };
    }
    
    if (planId && coupon.applicablePlanIds && coupon.applicablePlanIds.length > 0) {
      if (!coupon.applicablePlanIds.includes(planId)) {
        return { valid: false, coupon, message: "Cupom não é aplicável ao plano selecionado." };
      }
    }
    
    return { valid: true, coupon };
  } catch (error) {
    console.error(`Erro ao validar cupom com código '${code}':`, error);
    throw error;
  }
};

/**
 * Calcula o valor do desconto para um determinado valor e cupom.
 */
export const calculateDiscount = (
  originalAmount: number, 
  coupon: FirebaseCoupon
): { discountAmount: number; finalAmount: number } => {
  let discountAmount = 0;
  
  if (coupon.discountType === "percentage") {
    // Desconto percentual
    discountAmount = (originalAmount * coupon.discountValue) / 100;
  } else if (coupon.discountType === "fixed_amount") {
    // Desconto de valor fixo
    discountAmount = coupon.discountValue;
  }
  
  // Garantir que o desconto não seja maior que o valor original
  discountAmount = Math.min(discountAmount, originalAmount);
  
  // Arredondar para 2 casas decimais
  discountAmount = Math.round(discountAmount * 100) / 100;
  
  const finalAmount = originalAmount - discountAmount;
  
  return { discountAmount, finalAmount };
};

/**
 * Busca todos os cupons ativos.
 */
export const getActiveCoupons = async (): Promise<FirebaseCoupon[]> => {
  try {
    const snapshot = await db.collection(COUPONS_COLLECTION)
      .where("isActive", "==", true)
      .get();
    
    const coupons: FirebaseCoupon[] = [];
    snapshot.forEach(doc => {
      coupons.push(doc.data() as FirebaseCoupon);
    });
    
    return coupons;
  } catch (error) {
    console.error("Erro ao buscar cupons ativos:", error);
    throw error;
  }
};

/**
 * Busca todos os cupons com opções de filtro.
 */
export const getCoupons = async (
  options: {
    isActive?: boolean;
    createdBy?: string;
    applicablePlanId?: string;
  } = {}
): Promise<FirebaseCoupon[]> => {
  try {
    let query: any = db.collection(COUPONS_COLLECTION);
    
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    if (options.applicablePlanId) {
      query = query.where("applicablePlanIds", "array-contains", options.applicablePlanId);
    }
    
    const snapshot = await query.get();
    
    const coupons: FirebaseCoupon[] = [];
    snapshot.forEach((doc: any) => {
      coupons.push(doc.data() as FirebaseCoupon);
    });
    
    return coupons;
  } catch (error) {
    console.error("Erro ao buscar cupons:", error);
    throw error;
  }
};

/**
 * Exclui um cupom.
 */
export const deleteCoupon = async (couponId: string): Promise<void> => {
  const couponRef = db.collection(COUPONS_COLLECTION).doc(couponId);
  try {
    await couponRef.delete();
    console.log(`Cupom (ID: ${couponId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir cupom (ID: ${couponId}):`, error);
    throw error;
  }
};