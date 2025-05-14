import { Router } from "express";
import * as adminController from "../controllers/adminController";
import { authenticate } from "../middleware/authMiddleware";
import { isAdmin } from "../middleware/authorizationMiddleware"; // Middleware para garantir que apenas admins acessem

const router = Router();

// Todas as rotas aqui devem ser protegidas pelo middleware isAdmin e authenticate
router.use(authenticate, isAdmin);

// Rotas de Gerenciamento de Usuários
router.get("/users", adminController.listAllUsers);
router.patch("/users/:userId/role", adminController.updateUserRole);
// Adicionar rotas para banir/desbanir usuários, etc.

// Rotas de Gerenciamento de Conteúdo
router.patch("/articles/:articleId/status", adminController.manageArticleStatus);
// Adicionar rotas para gerenciar status de comentários, questões, etc.

// Rota para Estatísticas do Dashboard Administrativo
router.get("/dashboard/stats", adminController.getAdminDashboardStats);

// Outras rotas administrativas conforme necessário:
// - Gerenciamento de Planos
// - Gerenciamento de Pagamentos (visualização, reembolsos manuais se necessário)
// - Gerenciamento de Mentorias (visualização geral, intervenções)
// - Gerenciamento de Simulados (geral)

export default router;

