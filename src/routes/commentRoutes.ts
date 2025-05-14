import { Router } from "express";
import * as commentController from "../controllers/commentController";
import { authenticate } from "../middleware/authMiddleware";
import { isAdminOrAuthor, isAdminOrModerator } from "../middleware/authorizationMiddleware"; // Supondo middlewares de autorização

const router = Router();

// Rotas públicas (ou que podem ser acessadas por usuários logados para listar)
// A listagem de comentários geralmente é atrelada a um conteúdo específico (artigo, post, questão)
// Exemplo: GET /articles/:articleId/comments ou GET /questions/:questionId/comments
// Esta rota aqui será para um contentId genérico passado via query ou params.
router.get("/content/:contentId", commentController.listCommentsByContent); // Ou router.get("/"); se o contentId for sempre query
router.get("/:id", commentController.getCommentById); // Obter um comentário específico

// Rotas autenticadas
router.post("/", authenticate, commentController.createComment);
router.put("/:id", authenticate, isAdminOrAuthor("comment"), commentController.updateComment);
router.delete("/:id", authenticate, isAdminOrAuthor("comment"), commentController.deleteComment);

// Rotas de Moderação (admin ou mentor/moderador)
router.patch("/:id/approve", authenticate, isAdminOrModerator, commentController.approveComment);
router.patch("/:id/reject", authenticate, isAdminOrModerator, commentController.rejectComment);

export default router;

