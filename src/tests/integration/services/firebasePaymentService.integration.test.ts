import { initializeAppIfNeeded, firestore, clearCollection } from "../../../config/firebaseAdmin";
import {
    createPayment,
    getPaymentById,
    getPaymentsByUserId,
    updatePayment,
    approvePayment,
    rejectPayment,
    refundPayment,
    // cancelPayment, // Função não implementada ou não exportada, ou verificar se o nome está correto
    // markPaymentAsChargeback, // Função não implementada ou não exportada
    // deletePayment, // Função não implementada ou não exportada
    getPaymentsByUserPlanId
} from "../../../services/firebasePaymentService";
import {
    FirebasePayment,
    FirebasePaymentStatus,
    FirebasePaymentMethod,
    FirebaseUserPlanStatus,
    FirebasePlanInterval
} from "../../../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";

// Coleções para limpeza
const PAYMENTS_COLLECTION = "payments";
const USERS_COLLECTION = "users";
const PLANS_COLLECTION = "plans";
const USER_PLANS_COLLECTION = "userPlans";
const COUPONS_COLLECTION = "coupons";

describe("FirebasePaymentService Integration Tests", () => {
    let testUserId = `testUser_PaySvc_${Date.now()}`;
    let testPlanId = `testPlan_PaySvc_${Date.now()}`;
    let testUserPlanId = `testUserPlan_PaySvc_${Date.now()}`;
    let testCouponId = `testCoupon_PaySvc_${Date.now()}`;
    let createdPaymentId: string;

    const ensureTestUser = async (userId: string) => {
        const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                id: userId, uid: userId, name: "Test User Payment", email: `${userId}@example.com`,
                createdAt: Timestamp.now(), updatedAt: Timestamp.now(), role: "student", isActive: true 
            });
        }
    };

    const ensureTestPlan = async (planId: string) => {
        const planRef = firestore.collection(PLANS_COLLECTION).doc(planId);
        const planDoc = await planRef.get();
        if (!planDoc.exists) {
            await planRef.set({
                id: planId, name: "Test Plan", price: 100, currency: "BRL", interval: FirebasePlanInterval.MONTHLY,
                isActive: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), features: []
            });
        }
    };

    const ensureTestUserPlan = async (userPlanId: string, userId: string, planId: string) => {
        const userPlanRef = firestore.collection(USER_PLANS_COLLECTION).doc(userPlanId);
        const userPlanDoc = await userPlanRef.get();
        if (!userPlanDoc.exists) {
            await userPlanRef.set({
                id: userPlanId, userId, planId, status: FirebaseUserPlanStatus.ACTIVE, autoRenew: true, 
                startDate: Timestamp.now(), endDate: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now()
            });
        }
    };
    
    const ensureTestCoupon = async (couponId: string) => {
        const couponRef = firestore.collection(COUPONS_COLLECTION).doc(couponId);
        const couponDoc = await couponRef.get();
        if (!couponDoc.exists) {
            await couponRef.set({
                id: couponId, code: `COUPON${Date.now()}`.toUpperCase(), discountType: "percentage", discountValue: 10, isActive: true, timesUsed: 0, createdBy: testUserId, 
                createdAt: Timestamp.now(), updatedAt: Timestamp.now()
            });
        }
    };

    beforeAll(async () => {
        // Firebase Admin SDK já foi inicializado no jest.setup.js
        await ensureTestUser(testUserId);
        await ensureTestPlan(testPlanId);
        await ensureTestUserPlan(testUserPlanId, testUserId, testPlanId);
        await ensureTestCoupon(testCouponId);
    });

    afterEach(async () => {
        if (createdPaymentId) {
            await clearCollection(PAYMENTS_COLLECTION, ref => ref.where("id", "==", createdPaymentId));
        }
        await clearCollection(PAYMENTS_COLLECTION, ref => ref.where("userId", "==", testUserId));
        createdPaymentId = ""; 
    });

    afterAll(async () => {
        await clearCollection(USERS_COLLECTION, ref => ref.where("id", "==", testUserId));
        await clearCollection(PLANS_COLLECTION, ref => ref.where("id", "==", testPlanId));
        await clearCollection(USER_PLANS_COLLECTION, ref => ref.where("id", "==", testUserPlanId));
        await clearCollection(COUPONS_COLLECTION, ref => ref.where("id", "==", testCouponId));
    });

    describe("createPayment", () => {
        it("should create a new payment successfully", async () => {
            const paymentData: Omit<FirebasePayment, "id" | "createdAt" | "updatedAt"> = {
                userId: testUserId,
                planId: testPlanId,
                userPlanId: testUserPlanId,
                amount: 100,
                currency: "BRL",
                paymentMethod: FirebasePaymentMethod.CREDIT_CARD,
                status: FirebasePaymentStatus.PENDING,
                originalAmount: 100,
                discountAmount: 0,
            };
            const payment = await createPayment(paymentData);
            createdPaymentId = payment.id; 

            expect(payment).toBeDefined();
            expect(payment.id).toBeTruthy();
            expect(payment.userId).toBe(testUserId);
            expect(payment.status).toBe(FirebasePaymentStatus.PENDING);

            const fetchedPayment = await getPaymentById(payment.id);
            expect(fetchedPayment).toEqual(payment);
        });
    });

    describe("approvePayment", () => {
        it("should approve a pending payment", async () => {
            const payment = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 50, currency: "BRL", paymentMethod: FirebasePaymentMethod.PIX, status: FirebasePaymentStatus.PENDING, originalAmount: 50, discountAmount: 0 });
            createdPaymentId = payment.id;

            const approvedPayment = await approvePayment(payment.id, "external_trans_123");
            expect(approvedPayment?.status).toBe(FirebasePaymentStatus.APPROVED);
            expect(approvedPayment?.paidAt).toBeInstanceOf(Timestamp);
            expect(approvedPayment?.externalId).toBe("external_trans_123");
        });

        it("should not approve an already approved payment", async () => {
            const payment = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 50, currency: "BRL", paymentMethod: FirebasePaymentMethod.PIX, status: FirebasePaymentStatus.APPROVED, paidAt: Timestamp.now(), originalAmount: 50, discountAmount: 0 });
            createdPaymentId = payment.id;
            await expect(approvePayment(payment.id)).rejects.toThrow(); 
        });
    });

    describe("rejectPayment", () => {
        it("should reject a pending payment", async () => {
            const payment = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 70, currency: "BRL", paymentMethod: FirebasePaymentMethod.CREDIT_CARD, status: FirebasePaymentStatus.PENDING, originalAmount: 70, discountAmount: 0 });
            createdPaymentId = payment.id;

            const rejectedPayment = await rejectPayment(payment.id, "Insufficient funds");
            expect(rejectedPayment?.status).toBe(FirebasePaymentStatus.REJECTED);
            expect(rejectedPayment?.failureReason).toBe("Insufficient funds");
        });
    });

    describe("refundPayment", () => {
        it("should refund an approved payment", async () => {
            const payment = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 120, currency: "BRL", paymentMethod: FirebasePaymentMethod.CREDIT_CARD, status: FirebasePaymentStatus.APPROVED, paidAt: Timestamp.now(), originalAmount: 120, discountAmount: 0 });
            createdPaymentId = payment.id;

            const refundedPayment = await refundPayment(payment.id, "User request");
            expect(refundedPayment?.status).toBe(FirebasePaymentStatus.REFUNDED);
            expect(refundedPayment?.refundReason).toBe("User request");
            expect(refundedPayment?.refundedAt).toBeInstanceOf(Timestamp);
        });
    });
    
    describe("getPaymentsByUserPlanId", () => {
        it("should retrieve all payments for a specific user plan ID", async () => {
            const payment1 = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 10, currency: "BRL", paymentMethod: FirebasePaymentMethod.CREDIT_CARD, status: FirebasePaymentStatus.APPROVED, paidAt: Timestamp.now(), originalAmount: 10, discountAmount: 0 });
            const payment2 = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: testUserPlanId, amount: 20, currency: "BRL", paymentMethod: FirebasePaymentMethod.PIX, status: FirebasePaymentStatus.PENDING, originalAmount: 20, discountAmount: 0 });
            
            const otherUserPlanId = `otherUserPlan_${Date.now()}`;
            await ensureTestUserPlan(otherUserPlanId, testUserId, testPlanId); 
            const paymentForOtherPlan = await createPayment({ userId: testUserId, planId: testPlanId, userPlanId: otherUserPlanId, amount: 30, currency: "BRL", paymentMethod: FirebasePaymentMethod.CREDIT_CARD, status: FirebasePaymentStatus.APPROVED, paidAt: Timestamp.now(), originalAmount: 30, discountAmount: 0 });

            const payments = await getPaymentsByUserPlanId(testUserPlanId);
            expect(payments.length).toBe(2);
            expect(payments.some(p => p.id === payment1.id)).toBe(true);
            expect(payments.some(p => p.id === payment2.id)).toBe(true);
            expect(payments.some(p => p.id === paymentForOtherPlan.id)).toBe(false);

            await clearCollection(PAYMENTS_COLLECTION, ref => ref.where("id", "==", paymentForOtherPlan.id));
            await clearCollection(USER_PLANS_COLLECTION, ref => ref.where("id", "==", otherUserPlanId));
        });
    });
});

