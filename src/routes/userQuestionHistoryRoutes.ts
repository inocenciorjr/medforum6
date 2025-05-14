import { Router } from "express";
import * as userQuestionHistoryController from "../controllers/userQuestionHistoryController";
import { authenticate } from "../middleware/authMiddleware";
import { isAdmin } from "../middleware/authorizationMiddleware"; // Apenas admin pode ver histórico de outros, ou o próprio usuário

const router = Router();

// Rota para o usuário logado listar seu próprio histórico
router.get("/my-history", authenticate, userQuestionHistoryController.listUserHistory);

// Rota para admin obter uma entrada específica do histórico (ou o próprio usuário, se a lógica no controller permitir)
router.get("/:id", authenticate, userQuestionHistoryController.getHistoryEntry);

// Se houver uma rota para admin listar histórico de um usuário específico, seria algo como:
// router.get("/user/:userId", authenticate, isAdmin, userQuestionHistoryController.listUserHistoryForAdmin); 
// Isso exigiria uma adaptação no controller `listUserHistory` para aceitar um `userId` como parâmetro se o requisitante for admin.

export default router;

