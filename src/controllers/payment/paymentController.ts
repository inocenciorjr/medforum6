import { Request, Response } from "express";
import { AppError } from "../../utils/errors";
import { FirebasePaymentStatus, FirebasePaymentMethod, FirebasePayment as FirebasePaymentType, FirebasePixStatus, FirebaseCreditCardPaymentStatus } from "../../types/firebasePaymentTypes"; // Renomeado FirebasePayment para FirebasePaymentType
import * as paymentService from "../../services/firebasePaymentService";
import * as creditCardPaymentService from "../../services/firebaseCreditCardPaymentService";
import * as pixPaymentService from "../../services/firebasePixPaymentService";
import * as userPlanService from "../../services/firebaseUserPlanService";
import * as couponService from "../../services/firebaseCouponService";
import { Timestamp } from "firebase-admin/firestore";
import { UserRole, FirebasePlan, FirebaseUserPlanStatus } from "../../types/firebaseTypes"; // Adicionado FirebasePlan

// Interface para o objeto de estatísticas de plano
interface PlanStats {
  [planId: string]: {
    name: string;
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    revenue: number;
  };
}

class PaymentController {
  /**
   * Obtém o ID do usuário autenticado da requisição
   */
  private getAuthenticatedUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized("Usuário não autenticado");
    }
    return userId;
  }

  /**
   * Obtém o ID do usuário autenticado e verifica se é admin
   */
  private getAuthenticatedAdminId(req: Request): string {
    const userId = this.getAuthenticatedUserId(req);
    if (req.user?.role !== UserRole.ADMIN) {
      throw AppError.forbidden("Acesso negado. Apenas administradores podem realizar esta operação.");
    }
    return userId;
  }

  /**
   * Cria um novo pagamento (inicia processo de compra de plano)
   * POST /api/payments
   */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const {
        planId,
        paymentMethod, // "pix" ou "credit_card"
        paymentDetails, // Detalhes específicos do método
        couponCode // Opcional
      } = req.body;

      // Validação básica
      if (!planId || !paymentMethod) {
        throw AppError.badRequest("ID do plano e método de pagamento são obrigatórios.");
      }

      // Buscar o plano para obter o valor
      const plan = await userPlanService.getPlanById(planId);
      if (!plan || plan.price === undefined) { // Adicionado verificação de plan.price
        throw AppError.notFound("Plano não encontrado ou preço não definido.");
      }

      // Verificar se o usuário já tem um plano ativo
      const userPlans = await userPlanService.getUserActivePlans(userId);
      if (userPlans.some(up => up.planId === planId && up.status === FirebaseUserPlanStatus.ACTIVE)) {
        throw AppError.badRequest("Você já possui este plano ativo.");
      }

      // Calcular valor com desconto se houver cupom
      let amount = plan.price;
      let appliedCoupon = null;
      
      if (couponCode) {
        const validationResult = await couponService.validateCoupon(couponCode, planId); // planId is optional
        if (validationResult.valid && validationResult.coupon) {
          const discountResult = couponService.calculateDiscount(amount, validationResult.coupon);
          amount = discountResult.finalAmount;
          appliedCoupon = validationResult.coupon; // Store the actual coupon object
        }
      }

      // Criar o pagamento base
      const basePaymentData = {
        userId,
        planId,
        userPlanId: "", // Será preenchido após criar o plano do usuário
        originalAmount: plan.price,
        discountAmount: appliedCoupon ? (plan.price - amount) : 0,
        amount,
        currency: "BRL",
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: paymentMethod as FirebasePaymentMethod,
        couponId: appliedCoupon?.id || null,
        metadata: {
          description: `Assinatura do plano ${plan.name}`
        }
      };

      let result;

      if (paymentMethod === "pix") {
        // Criar pagamento PIX
        const payment = await paymentService.createPayment(basePaymentData);
        
        // Gerar código PIX (simulado aqui, na prática seria integrado com gateway)
        const expirationDate = new Timestamp(
          Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 horas
          0
        );
        
        const pixData = {
          paymentId: payment.id,
          pixQrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020126580014BR.GOV.BCB.PIX0136${Math.random().toString(36).substring(2, 15)}5204000053039865802BR5913MedForum LTDA6008Sao Paulo62070503***63041234`,
          pixCopiaECola: `00020126580014BR.GOV.BCB.PIX0136${Math.random().toString(36).substring(2, 15)}5204000053039865802BR5913MedForum LTDA6008Sao Paulo62070503***63041234`,
          status: FirebasePixStatus.PENDING, // Uses the general payment status
          expirationDate
        };
        
        const pixPayment = await pixPaymentService.createPixPayment(pixData);
        
        result = {
          payment,
          pixPayment
        };
      } else if (paymentMethod === "credit_card") {
        // Validar dados do cartão
        if (!paymentDetails?.cardToken || !paymentDetails?.installments || 
            !paymentDetails?.cardLastFourDigits || !paymentDetails?.cardBrand) {
          throw AppError.badRequest("Detalhes do cartão de crédito são obrigatórios.");
        }

        // Criar pagamento principal
        const payment = await paymentService.createPayment(basePaymentData);
        
        // Criar pagamento de cartão de crédito
        const creditCardData = {
          paymentId: payment.id,
          cardHolderName: paymentDetails.cardHolderName || "Cliente MedForum",
          cardLastFourDigits: paymentDetails.cardLastFourDigits,
          cardBrand: paymentDetails.cardBrand,
          installments: paymentDetails.installments,
          status: FirebaseCreditCardPaymentStatus.PENDING,
          paymentMethodId: paymentDetails.cardToken
        };
        
        const ccPayment = await creditCardPaymentService.createCreditCardPayment(creditCardData);
        
        // Aqui seria feita a integração com o gateway de pagamento
        // Simulando processamento bem-sucedido
        await creditCardPaymentService.authorizeCreditCardPayment(
          ccPayment.id, 
          `auth_${Date.now()}`, 
          `code_${Math.random().toString(36).substring(2, 10)}`,
          { success: true }
        );
        
        await creditCardPaymentService.captureCreditCardPayment(
          ccPayment.id,
          `trans_${Date.now()}`,
          `nsu_${Math.random().toString(36).substring(2, 10)}`,
          { success: true }
        );
        
        // Buscar os dados atualizados
        const updatedCCPayment = await creditCardPaymentService.getCreditCardPaymentById(ccPayment.id);
        const updatedPayment = await paymentService.getPaymentById(payment.id);
        
        result = {
          payment: updatedPayment,
          creditCardPayment: updatedCCPayment
        };
      } else {
        throw AppError.badRequest("Método de pagamento inválido.");
      }

      res.status(201).json({
        success: true,
        message: "Processo de pagamento iniciado com sucesso.",
        data: result
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao criar pagamento:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao processar pagamento."
        });
      }
    }
  };

  /**
   * Busca um pagamento específico por ID
   * GET /api/payments/:paymentId
   */
  findById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const userRole = req.user!.role;
      const { paymentId } = req.params;
      
      const payment = await paymentService.getPaymentById(paymentId);

      if (!payment) {
        throw AppError.notFound("Pagamento não encontrado.");
      }

      // Verificação de autorização: usuário só pode ver seus próprios pagamentos, admin pode ver todos
      if (userRole !== UserRole.ADMIN && payment.userId !== userId) {
        throw AppError.forbidden("Você não tem permissão para visualizar este pagamento.");
      }

      // Buscar detalhes específicos do método de pagamento
      let paymentDetails = null;
      if (payment.paymentMethod === FirebasePaymentMethod.CREDIT_CARD) { // Usar Enum
        paymentDetails = await creditCardPaymentService.getCreditCardPaymentByPaymentId(paymentId);
      } else if (payment.paymentMethod === FirebasePaymentMethod.PIX) { // Usar Enum
        paymentDetails = await pixPaymentService.getPixPaymentByPaymentId(paymentId);
      }

      res.status(200).json({
        success: true,
        data: {
          payment,
          paymentDetails
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao buscar pagamento:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao buscar pagamento."
        });
      }
    }
  };

  /**
   * Busca os pagamentos do usuário autenticado
   * GET /api/payments/user/me
   */
  findByUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const payments = await paymentService.getPaymentsByUserId(userId);
      
      res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao buscar pagamentos do usuário:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao buscar pagamentos."
        });
      }
    }
  };

  /**
   * Busca todos os pagamentos (Admin only)
   * GET /api/payments
   */
  findAll = async (req: Request, res: Response): Promise<void> => {
    try {
      this.getAuthenticatedAdminId(req);
      
      // Implementar paginação e filtros aqui
      // Por enquanto, retorna todos os pagamentos (não recomendado para produção)
      const snapshot = await paymentService.getAllPayments(req.query);
      
      res.status(200).json({
        success: true,
        data: snapshot.payments, // Access the payments array from the snapshot object
        pagination: { // Optionally include pagination info if needed by frontend
            nextPageStartAfter: snapshot.nextPageStartAfter
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao buscar todos os pagamentos:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao buscar pagamentos."
        });
      }
    }
  };

  /**
   * Atualiza o status de um pagamento manualmente (Admin only)
   * PUT /api/payments/:paymentId/status
   */
  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      this.getAuthenticatedAdminId(req);
      const { paymentId } = req.params;
      const { status } = req.body;
      
      if (!status || !Object.values(FirebasePaymentStatus).includes(status as FirebasePaymentStatus)) { // Cast status
        throw AppError.badRequest("Status inválido fornecido.");
      }

      const payment = await paymentService.getPaymentById(paymentId);
      if (!payment) {
        throw AppError.notFound("Pagamento não encontrado.");
      }

      // Atualizar o status do pagamento
      const updatedPayment = await paymentService.updatePayment(paymentId, { status: status as FirebasePaymentStatus }); // Cast status

      // Atualizar também o pagamento específico (PIX ou cartão de crédito)
      if (payment.paymentMethod === FirebasePaymentMethod.PIX) { // Usar Enum
        const pixPayment = await pixPaymentService.getPixPaymentByPaymentId(paymentId);
        if (pixPayment) {
          if (status === FirebasePaymentStatus.APPROVED) {
            await pixPaymentService.approvePixPayment(pixPayment.id, `manual_${Date.now()}`);
          } else if (status === FirebasePaymentStatus.CANCELLED) {
            await pixPaymentService.cancelPixPayment(pixPayment.id);
          }
        }
      } else if (payment.paymentMethod === FirebasePaymentMethod.CREDIT_CARD) { // Usar Enum
        const ccPayment = await creditCardPaymentService.getCreditCardPaymentByPaymentId(paymentId);
        if (ccPayment) {
          if (status === FirebasePaymentStatus.APPROVED) {
            await creditCardPaymentService.captureCreditCardPayment(ccPayment.id, `manual_${Date.now()}`);
          } else if (status === FirebasePaymentStatus.CANCELLED) {
            await creditCardPaymentService.cancelCreditCardPayment(ccPayment.id, "Cancelado manualmente pelo administrador");
          } else if (status === FirebasePaymentStatus.REFUNDED) {
            await creditCardPaymentService.refundCreditCardPayment(ccPayment.id, `refund_${Date.now()}`);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Status do pagamento atualizado com sucesso.",
        data: updatedPayment
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao atualizar status do pagamento:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao atualizar status do pagamento."
        });
      }
    }
  };

  /**
   * Solicita o reembolso de um pagamento
   * POST /api/payments/:paymentId/refund
   */
  refund = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const userRole = req.user!.role;
      const { paymentId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        throw AppError.badRequest("Motivo do reembolso é obrigatório.");
      }

      const payment = await paymentService.getPaymentById(paymentId);
      if (!payment) {
        throw AppError.notFound("Pagamento não encontrado.");
      }

      // Verificar autorização: apenas o próprio usuário ou admin pode solicitar reembolso
      if (userRole !== UserRole.ADMIN && payment.userId !== userId) {
        throw AppError.forbidden("Você não tem permissão para solicitar reembolso deste pagamento.");
      }

      // Verificar se o pagamento pode ser reembolsado
      if (payment.status !== FirebasePaymentStatus.APPROVED) {
        throw AppError.badRequest("Apenas pagamentos aprovados podem ser reembolsados.");
      }

      // Processar o reembolso
      const refundedPayment = await paymentService.refundPayment(paymentId, reason);

      // Processar o reembolso específico (PIX ou cartão de crédito)
      if (payment.paymentMethod === FirebasePaymentMethod.CREDIT_CARD) { // Usar Enum
        const ccPayment = await creditCardPaymentService.getCreditCardPaymentByPaymentId(paymentId);
        if (ccPayment) {
          await creditCardPaymentService.refundCreditCardPayment(
            ccPayment.id, 
            `refund_${Date.now()}`, 
            undefined, 
            { reason }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Solicitação de reembolso processada.",
        data: refundedPayment
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        console.error("Erro ao solicitar reembolso:", error);
        res.status(500).json({
          success: false,
          message: "Erro interno ao processar reembolso."
        });
      }
    }
  };

  /**
   * Processa notificações de webhook enviadas pelo provedor de pagamento
   * POST /api/payments/webhook
   */
  webhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers["stripe-signature"] as string || req.headers["x-pagarme-signature"] as string || ""; // Cast para string
      const rawBody = (req as any).rawBody;
      const payload = req.body;

      // Verificar assinatura (simulado)
      console.log("Webhook recebido:", {
        signature,
        payload
      });

      // Processar o webhook com base no tipo de evento
      const eventType = payload.type || payload.event;
      const paymentData = payload.data?.object || payload.current_status || payload; // Ajustar conforme o provedor
      const paymentIdFromProvider = paymentData?.id || paymentData?.payment_id || paymentData?.transaction?.id;
      const paymentIntentId = payload.data?.object?.payment_intent; // Para Stripe

      let payment: FirebasePaymentType | null = null; // Usar o tipo renomeado

      if (paymentIntentId) { // Stripe usa payment_intent para buscar o pagamento interno
        payment = await paymentService.getPaymentByExternalId(paymentIntentId);
        if (!payment) {
            console.warn(`Pagamento não encontrado via paymentIntentId: ${paymentIntentId} para o webhook.`);
        }
      } else if (paymentIdFromProvider) {
        // Tentar buscar pelo ID externo do pagamento no nosso sistema
        // Isso requer que o externalId seja salvo corretamente ao criar/processar o pagamento
        payment = await paymentService.getPaymentByExternalId(paymentIdFromProvider);
        if (!payment) {
            console.warn(`Pagamento não encontrado via paymentIdFromProvider: ${paymentIdFromProvider} para o webhook.`);
        }
      }
      
      // Se não encontrou pelo ID externo, pode ser que o ID do nosso sistema esteja no metadata
      const internalPaymentId = payload.data?.object?.metadata?.internal_payment_id || payload.metadata?.internal_payment_id;
      if (!payment && internalPaymentId) {
          payment = await paymentService.getPaymentById(internalPaymentId);
      }

      if (!payment) {
        console.warn("Pagamento não encontrado para o webhook:", payload);
        res.status(404).send("Pagamento não encontrado no sistema.");
        return;
      }

      // Lógica para lidar com diferentes eventos
      switch (eventType) {
        case "payment_intent.succeeded": // Stripe
        case "charge.paid": // Pagar.me
        case "transaction.paid": // Outro provedor
          await paymentService.approvePayment(payment.id, paymentIdFromProvider, payload);
          // Ativar plano do usuário
          // await userPlanService.activateUserPlanAfterPayment(payment.id); // This function does not exist in userPlanService, payment confirmation should trigger this.
          break;
        case "payment_intent.payment_failed": // Stripe
        case "charge.failed": // Pagar.me
        case "transaction.refused": // Outro provedor
          await paymentService.rejectPayment(payment.id, payload.failure_message || "Falha no pagamento informada pelo gateway", payload);
          break;
        case "charge.refunded": // Pagar.me
          // Stripe envia charge.refunded para cada refund object, não para o payment_intent
          await paymentService.refundPayment(payment.id, "Reembolso processado pelo gateway", payload);
          // Desativar ou ajustar plano do usuário
          await userPlanService.handlePlanChangeAfterRefund(payment.id);
          break;
        // Adicionar mais casos conforme necessário (disputas, cancelamentos, etc.)
        default:
          console.log(`Webhook não tratado: ${eventType}`);
      }

      res.status(200).send("Webhook recebido e processado.");
    } catch (error) {
      console.error("Erro ao processar webhook de pagamento:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar webhook."
      });
    }
  };

  /**
   * Gera estatísticas de pagamento (Admin only)
   * GET /api/payments/stats
   */
  getPaymentStats = async (req: Request, res: Response): Promise<void> => {
    try {
      this.getAuthenticatedAdminId(req);
      
      const allPayments = await paymentService.getAllPayments({});
      const allPlans = await userPlanService.getAllPlans(); // Supondo que existe essa função

      const planMap: { [planId: string]: FirebasePlan } = {}; // Tipagem para planMap
      allPlans.forEach(plan => {
        planMap[plan.id] = plan;
      });

      const stats = {
        totalPayments: allPayments.payments.length,
        totalRevenue: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        refundedCount: 0,
        byMethod: {} as { [method: string]: number }, // Adicionado tipo
        byPlan: {} as PlanStats // Usar a interface PlanStats
      };

      allPayments.payments.forEach((p: FirebasePaymentType) => {
        if (p.status === FirebasePaymentStatus.APPROVED) {
          stats.totalRevenue += p.amount;
          stats.approvedCount++;
        } else if (p.status === FirebasePaymentStatus.PENDING) {
          stats.pendingCount++;
        } else if (p.status === FirebasePaymentStatus.REJECTED) {
          stats.rejectedCount++;
        } else if (p.status === FirebasePaymentStatus.REFUNDED) {
          stats.refundedCount++;
        }

        stats.byMethod[p.paymentMethod] = (stats.byMethod[p.paymentMethod] || 0) + 1;

        if (p.planId) {
          if (!stats.byPlan[p.planId]) {
            stats.byPlan[p.planId] = {
              name: planMap[p.planId]?.name || "Plano Desconhecido",
              total: 0,
              approved: 0,
              pending: 0,
              rejected: 0,
              revenue: 0
            };
          }
          stats.byPlan[p.planId].total++;
          if (p.status === FirebasePaymentStatus.APPROVED) {
            stats.byPlan[p.planId].approved++;
            stats.byPlan[p.planId].revenue += p.amount;
          }
        }
      });

      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
      } else {
        console.error("Erro ao gerar estatísticas de pagamento:", error);
        res.status(500).json({ success: false, message: "Erro interno ao gerar estatísticas." });
      }
    }
  };
}

export default new PaymentController();

