import { Router } from "express";
import adminController from "../../controllers/admin/adminController";
import adminValidator from "../../validators/admin.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { isAdmin } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { rateLimit } from "../../middlewares/rateLimit.middleware";

const router = Router();

// Middleware para todas as rotas administrativas
router.use(authenticate, isAdmin);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Obtém estatísticas para o dashboard administrativo
 * @access  Private (Admin)
 */
router.get(
  "/dashboard",
  rateLimit("admin_dashboard", 60, 60), // 60 por minuto
  validate(adminValidator.getDashboardStats),
  adminController.getDashboardStats
);

/**
 * @route   GET /api/admin/users
 * @desc    Gerencia usuários
 * @access  Private (Admin)
 */
router.get(
  "/users",
  rateLimit("admin_users", 60, 60), // 60 por minuto
  validate(adminValidator.getUserManagement),
  adminController.getUserManagement
);

/**
 * @route   GET /api/admin/content
 * @desc    Moderação de conteúdo
 * @access  Private (Admin)
 */
router.get(
  "/content",
  rateLimit("admin_content", 60, 60), // 60 por minuto
  validate(adminValidator.getContentModeration),
  adminController.getContentModeration
);

/**
 * @route   GET /api/admin/settings
 * @desc    Obtém configurações do sistema
 * @access  Private (Admin)
 */
router.get(
  "/settings",
  rateLimit("admin_settings", 60, 60), // 60 por minuto
  validate(adminValidator.getSystemSettings),
  adminController.getSystemSettings
);

/**
 * @route   GET /api/admin/payments
 * @desc    Relatórios de pagamento
 * @access  Private (Admin)
 */
router.get(
  "/payments",
  rateLimit("admin_payments", 60, 60), // 60 por minuto
  validate(adminValidator.getPaymentReports),
  adminController.getPaymentReports
);

/**
 * @route   GET /api/admin/logs/users
 * @desc    Logs de atividade de usuários
 * @access  Private (Admin)
 */
router.get(
  "/logs/users",
  rateLimit("admin_user_logs", 60, 60), // 60 por minuto
  validate(adminValidator.getUserActivityLogs),
  adminController.getUserActivityLogs
);

/**
 * @route   GET /api/admin/logs/system
 * @desc    Logs do sistema
 * @access  Private (Admin)
 */
router.get(
  "/logs/system",
  rateLimit("admin_system_logs", 60, 60), // 60 por minuto
  validate(adminValidator.getSystemLogs),
  adminController.getSystemLogs
);

/**
 * @route   POST /api/admin/backup
 * @desc    Realizar backup de dados
 * @access  Private (Admin)
 */
router.post(
  "/backup",
  rateLimit("admin_backup", 5, 60 * 60), // 5 por hora
  validate(adminValidator.performBackup),
  adminController.performBackup
);

/**
 * @route   POST /api/admin/features
 * @desc    Gerenciar flags de funcionalidades
 * @access  Private (Admin)
 */
router.post(
  "/features",
  rateLimit("admin_features", 30, 60), // 30 por minuto
  validate(adminValidator.manageFeatureFlags),
  adminController.manageFeatureFlags
);

/**
 * @route   GET /api/admin/analytics
 * @desc    Obter análises e métricas
 * @access  Private (Admin)
 */
router.get(
  "/analytics",
  rateLimit("admin_analytics", 60, 60), // 60 por minuto
  validate(adminValidator.getAnalytics),
  adminController.getAnalytics
);

/**
 * @route   POST /api/admin/notifications/bulk
 * @desc    Enviar notificações em massa
 * @access  Private (Admin)
 */
router.post(
  "/notifications/bulk",
  rateLimit("admin_bulk_notifications", 5, 60 * 60), // 5 por hora
  validate(adminValidator.sendBulkNotifications),
  adminController.sendBulkNotifications
);

export default router;