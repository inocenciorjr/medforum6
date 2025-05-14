import { Router } from 'express';
import paymentController from '../../controllers/payment/paymentController';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import { rateLimit } from "../../middlewares/rateLimit.middleware";

const paymentRouter = Router();

// --- Payment Creation & Retrieval --- //

/**
 * @route   POST /api/payments
 * @desc    Cria um novo pagamento (inicia processo de compra de plano).
 * @access  Private
 */
paymentRouter.post(
  '/',
  authenticate,
  rateLimit('payment_create', 10, 60 * 15), // 10 tentativas por 15 minutos
  paymentController.create
);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Busca um pagamento específico por ID (acessível pelo usuário dono ou admin).
 * @access  Private
 */
paymentRouter.get(
  '/:paymentId',
  authenticate,
  paymentController.findById
);

/**
 * @route   GET /api/payments/user/me
 * @desc    Busca os pagamentos do usuário autenticado.
 * @access  Private
 */
paymentRouter.get(
  '/user/me',
  authenticate,
  paymentController.findByUser
);

// --- Admin Payment Management --- //

/**
 * @route   GET /api/payments
 * @desc    Busca todos os pagamentos com paginação e filtros (Admin only).
 * @access  Private (Admin)
 */
paymentRouter.get(
  '/',
  authenticate,
  isAdmin,
  paymentController.findAll
);

/**
 * @route   PUT /api/payments/:paymentId/status
 * @desc    Atualiza o status de um pagamento manualmente (Admin only).
 * @access  Private (Admin)
 */
paymentRouter.put(
  '/:paymentId/status',
  authenticate,
  isAdmin,
  paymentController.updateStatus
);

/**
 * @route   GET /api/payments/statistics
 * @desc    Busca estatísticas gerais de pagamentos (Admin only).
 * @access  Private (Admin)
 */
paymentRouter.get(
  '/statistics',
  authenticate,
  isAdmin,
  paymentController.getStatistics
);

// --- Refunds --- //

/**
 * @route   POST /api/payments/:paymentId/refund
 * @desc    Solicita o reembolso de um pagamento (pode ser iniciado pelo usuário ou admin).
 * @access  Private
 */
paymentRouter.post(
  '/:paymentId/refund',
  authenticate,
  rateLimit('payment_refund', 3, 60 * 60), // 3 tentativas por hora
  paymentController.refund
);

// --- Webhooks --- //

/**
 * @route   POST /api/payments/webhook
 * @desc    Endpoint para receber notificações de status de pagamento do gateway.
 * @access  Public
 */
paymentRouter.post(
  '/webhook',
  // Webhooks não precisam de autenticação, mas podem ter verificação de assinatura
  paymentController.webhook
);

// --- Utilities & Information --- //

/**
 * @route   GET /api/payments/methods/available
 * @desc    Busca os métodos de pagamento disponíveis e configurados no sistema.
 * @access  Private
 */
paymentRouter.get(
  '/methods/available',
  authenticate,
  paymentController.getPaymentMethods
);

/**
 * @route   GET /api/payments/invoices/:paymentId
 * @desc    Gera ou busca a fatura (invoice) para um pagamento específico.
 * @access  Private
 */
paymentRouter.get(
  '/invoices/:paymentId',
  authenticate,
  paymentController.generateInvoice
);

export default paymentRouter;