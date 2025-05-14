import { Router } from "express";
import * as questionController from "../controllers/questionController";
import { authenticate } from "../middleware/authMiddleware";
import { isAdminOrMentor } from "../middleware/authorizationMiddleware"; // Supondo middleware para admin ou mentor

const router = Router();

// Rotas públicas ou para usuários logados (dependendo da lógica de visualização de questões)
router.get("/", questionController.listQuestions);
router.get("/:id", questionController.getQuestionById);

// Rotas para Admin ou Mentor (criar, atualizar, deletar questões)
router.post("/", authenticate, isAdminOrMentor, questionController.createQuestion);
router.put("/:id", authenticate, isAdminOrMentor, questionController.updateQuestion);
router.delete("/:id", authenticate, isAdminOrMentor, questionController.deleteQuestion);

// Rota para usuário logado submeter resposta
router.post("/:id/answer", authenticate, questionController.submitAnswer);

export default router;

