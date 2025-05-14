import { firestore as db } from "../config/firebaseAdmin";
import { FirebaseInvoice, FirebasePayment, FirebaseUserProfile, FirebaseUser, FirebasePaymentStatus } from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { generateInvoicePDF, InvoiceData } from "../utils/pdf/invoiceGenerator"; // Assuming InvoiceData is the type for pdf generator input
import * as userService from "./firebaseUserService";
import * as paymentService from "./firebasePaymentService";
import * as couponService from "./firebaseCouponService"; // Assuming a coupon service exists

const INVOICES_COLLECTION = "invoices";

/**
 * Cria um novo registro de fatura.
 */
export const createInvoice = async (invoiceData: Omit<FirebaseInvoice, "id" | "createdAt" | "updatedAt">): Promise<FirebaseInvoice> => {
  const invoiceRef = db.collection(INVOICES_COLLECTION).doc();
  const now = Timestamp.now();

  const newInvoice: FirebaseInvoice = {
    id: invoiceRef.id,
    ...invoiceData,
    createdAt: now,
    updatedAt: now,
  };

  await invoiceRef.set(newInvoice);
  console.log(`Fatura (ID: ${newInvoice.id}) para o pagamento ${newInvoice.paymentId} criada com sucesso.`);
  return newInvoice;
};

/**
 * Busca uma fatura pelo ID.
 */
export const getInvoiceById = async (invoiceId: string): Promise<FirebaseInvoice | null> => {
  const docRef = db.collection(INVOICES_COLLECTION).doc(invoiceId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseInvoice;
  }
  console.warn(`Fatura (ID: ${invoiceId}) não encontrada.`);
  return null;
};

/**
 * Busca uma fatura pelo ID do pagamento.
 */
export const getInvoiceByPaymentId = async (paymentId: string): Promise<FirebaseInvoice | null> => {
  const snapshot = await db.collection(INVOICES_COLLECTION)
    .where("paymentId", "==", paymentId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.warn(`Nenhuma fatura encontrada para o pagamento (ID: ${paymentId}).`);
    return null;
  }

  return snapshot.docs[0].data() as FirebaseInvoice;
};

/**
 * Busca todas as faturas de um usuário específico.
 */
export const getInvoicesByUserId = async (userId: string): Promise<FirebaseInvoice[]> => {
  const invoices: FirebaseInvoice[] = [];
  try {
    const snapshot = await db.collection(INVOICES_COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    
    snapshot.forEach(doc => {
      invoices.push(doc.data() as FirebaseInvoice);
    });
    return invoices;
  } catch (error) {
    console.warn("Erro ao buscar faturas com índice composto, tentando alternativa:", error);
    
    const snapshot = await db.collection(INVOICES_COLLECTION)
      .where("userId", "==", userId)
      .get();
    
    if (snapshot && typeof snapshot.docs !== 'undefined') {
      snapshot.docs.forEach(doc => {
        invoices.push(doc.data() as FirebaseInvoice);
      });
    } else {
      console.warn("Snapshot (catch block) is not a QuerySnapshot or docs is not available in getInvoicesByUserId. Snapshot:", snapshot);
    }
    
    invoices.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return invoices;
  }
};

/**
 * Atualiza um registro de fatura existente.
 */
export const updateInvoice = async (invoiceId: string, updates: Partial<Omit<FirebaseInvoice, "id" | "createdAt">>): Promise<FirebaseInvoice | null> => {
  const invoiceRef = db.collection(INVOICES_COLLECTION).doc(invoiceId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await invoiceRef.update(updateData);
    console.log(`Fatura (ID: ${invoiceId}) atualizada com sucesso.`);
    const updatedDoc = await invoiceRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseInvoice : null;
  } catch (error) {
    console.error(`Erro ao atualizar fatura (ID: ${invoiceId}):`, error);
    throw error;
  }
};

/**
 * Gera ou recupera uma fatura para um pagamento específico.
 */
export const generateOrRetrieveInvoice = async (paymentId: string): Promise<FirebaseInvoice | null> => {
  const existingInvoice = await getInvoiceByPaymentId(paymentId);
  if (existingInvoice) {
    return existingInvoice;
  }

  const payment = await paymentService.getPaymentById(paymentId);
  if (!payment) {
    console.warn(`Pagamento (ID: ${paymentId}) não encontrado para gerar fatura.`);
    return null;
  }

  if (payment.status !== FirebasePaymentStatus.APPROVED) { // Use Enum
    console.warn(`Não é possível gerar fatura para pagamento não aprovado. Status: ${payment.status}`);
    return null;
  }

  const user = await userService.getUser(payment.userId);
  const userProfile = await userService.getUserProfile(payment.userId);

  if (!user) {
    console.warn(`Usuário (ID: ${payment.userId}) não encontrado para gerar fatura.`);
    return null;
  }

  const companyDetails = {
    name: "MedForum Educação Médica Ltda",
    document: "12.345.678/0001-90",
    address: "Av. Paulista, 1000, São Paulo - SP, CEP 01310-100"
  };

  let couponDiscountAmount = 0;
  let couponCodeValue: string | undefined = undefined;
  if (payment.couponId) {
    const coupon = await couponService.getCouponById(payment.couponId); // Assuming getCouponById exists
    if (coupon && coupon.isActive) {
        couponCodeValue = coupon.code; // Assuming coupon has a 'code' field
        if (coupon.discountType === "percentage") {
            couponDiscountAmount = (payment.amount * coupon.discountValue) / 100;
        } else if (coupon.discountType === "fixed_amount") {
            couponDiscountAmount = coupon.discountValue;
        }
        // Ensure discount doesn't exceed payment amount
        couponDiscountAmount = Math.min(couponDiscountAmount, payment.amount);
    }
  }

  const items = [
    {
      description: payment.description || `Assinatura do plano (ID: ${payment.planId})`,
      // Original amount before discount
      amount: payment.amount + couponDiscountAmount, 
      quantity: 1
    }
  ];

  const discounts = couponDiscountAmount > 0 && couponCodeValue ? [
    {
      description: `Cupom: ${couponCodeValue}`,
      amount: couponDiscountAmount
    }
  ] : undefined;

  // Prepare user details for PDF, handling potential nulls
  const pdfUserDetails: InvoiceData["userDetails"] = {
    name: userProfile?.name || user.displayName || "Cliente",
    email: user.email || "", // Ensure email is a string
    // document: userProfile?.document, // 'document' does not exist on FirebaseUserProfile
    address: userProfile?.address || undefined // Ensure address is string or undefined
  };
  if (userProfile?.postalCode) {
    pdfUserDetails.postalCode = userProfile.postalCode;
  }
  if (userProfile?.city) {
    pdfUserDetails.city = userProfile.city;
  }
  if (userProfile?.state) {
    pdfUserDetails.state = userProfile.state;
  }

  const pdfUrl = await generateInvoicePDF({
    payment,
    userDetails: pdfUserDetails,
    companyDetails,
    items,
    discounts
  });

  const invoiceData: Omit<FirebaseInvoice, "id" | "createdAt" | "updatedAt"> = {
    paymentId: payment.id,
    userId: payment.userId,
    invoiceNumber: `INV-${payment.id.substring(0, 8)}-${Date.now().toString().slice(-4)}`, // More unique invoice number
    amount: payment.amount, // Final amount after discount
    status: 'paid',
    pdfUrl,
    items,
    discounts: discounts || [],
    paymentMethod: payment.paymentMethod.toString(), // Ensure it's a string
    paidAt: payment.paidAt || Timestamp.now()
  };

  return createInvoice(invoiceData);
};
