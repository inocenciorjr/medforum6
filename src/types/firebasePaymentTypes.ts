import { Timestamp } from "firebase-admin/firestore";

// --- Payment Enums ---

export enum FirebasePaymentMethod {
  CREDIT_CARD = "credit_card",
  PIX = "pix",
  ADMIN = "admin",
  FREE = "free",
  BANK_SLIP = "bank_slip", // Added based on FirebasePaymentMethodType in firebaseTypes.ts
  OTHER = "other",       // Added based on FirebasePaymentMethodType in firebaseTypes.ts
}

export enum FirebasePaymentStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
  CHARGEBACK = "chargeback",
  FAILED = "failed", // Added for critical failures
}

export enum FirebaseCreditCardPaymentStatus {
  PENDING = "pending",
  AUTHORIZED = "authorized",
  CAPTURED = "captured",
  REJECTED = "rejected",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
  CANCELLED = "cancelled",
  CHARGEBACK = "chargeback",
}

export enum FirebasePixStatus {
  PENDING = "pending",
  APPROVED = "approved",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export enum FirebasePixKeyType {
  CPF = "cpf",
  CNPJ = "cnpj",
  EMAIL = "email",
  PHONE = "phone",
  RANDOM = "random",
}

// --- Payment Interfaces ---

export interface FirebasePayment {
  id: string;
  userId: string;
  planId: string;
  description?: string | null; // Adicionado para descrição do pagamento (ex: nome do plano)
  userPlanId?: string | null; 
  invoiceId?: string | null;       
  couponId?: string | null;        
  originalAmount: number;
  discountAmount: number;
  amount: number;
  currency: string;
  paymentMethod: FirebasePaymentMethod;
  paymentMethodDetails?: Record<string, any> | null; 
  status: FirebasePaymentStatus;
  externalId?: string | null;
  externalReference?: string | null;
  transactionData?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  pixCode?: string | null;
  pixExpirationDate?: Timestamp | null;
  cardLastFourDigits?: string | null;
  cardBrand?: string | null;
  installments?: number | null;
  receiptUrl?: string | null;
  failureReason?: string | null;
  refundReason?: string | null;
  chargebackReason?: string | null;
  cancellationReason?: string | null;
  processedAt?: Timestamp | null;    
  paidAt?: Timestamp | null;
  refundedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  chargebackAt?: Timestamp | null;    
  processedBy?: string | null;     
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseCreditCardPayment {
  id: string;
  paymentId: string;
  cardHolderName: string;
  cardLastFourDigits: string;
  cardBrand: string;
  installments: number;
  status: FirebaseCreditCardPaymentStatus;
  transactionId?: string | null;
  authorizationCode?: string | null;
  nsu?: string | null;
  acquirerName?: string | null;
  paymentMethodId?: string | null;
  statementDescriptor?: string | null;
  gatewayResponse?: Record<string, any> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  refundId?: string | null;
  refundAmount?: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebasePixPayment {
  id: string;
  paymentId: string;
  pixKey?: string | null;
  pixKeyType?: FirebasePixKeyType | null;
  pixQrCode: string;
  pixCopiaECola: string;
  expirationDate: Timestamp;
  status: FirebasePixStatus;
  transactionId?: string | null;
  endToEndId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseCoupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  expirationDate?: Timestamp | null;
  maxUses?: number | null;
  timesUsed: number;
  isActive: boolean;
  applicablePlanIds?: string[] | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebasePaymentNotification {
  id: string;
  paymentId?: string | null;
  userId: string;
  type: string; // Considerar um Enum mais específico para tipos de notificação de pagamento
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Timestamp | null;
  relatedId?: string | null; // Adicionado para referenciar entidades relacionadas (ex: paymentId, invoiceId)
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

