import { Router } from "express";
import * as mentorshipController from "../controllers/mentorshipController";
import { authenticate } from "../middleware/authMiddleware";
import { isAdmin, isMentorOrStudentOrAdmin } from "../middleware/authorizationMiddleware"; // Supondo middlewares de autorização

const router = Router();

// Estudante solicita mentoria para um mentor
router.post("/request", authenticate, mentorshipController.requestMentorship);

// Mentor aceita uma solicitação de mentoria
router.patch("/:id/accept", authenticate, mentorshipController.acceptMentorshipRequest);

// Listar mentorias (para o usuário logado, seja como mentor ou estudante, ou admin)
router.get("/", authenticate, mentorshipController.listMentorships);

// Obter detalhes de uma mentoria específica
router.get("/:id", authenticate, isMentorOrStudentOrAdmin("mentorship"), mentorshipController.getMentorshipById);

// Atualizar detalhes da mentoria (objetivos, frequência - por mentor ou estudante)
router.put("/:id/details", authenticate, isMentorOrStudentOrAdmin("mentorship"), mentorshipController.updateMentorshipDetails);

// Cancelar uma mentoria (pelo mentor, estudante ou admin)
router.patch("/:id/cancel", authenticate, isMentorOrStudentOrAdmin("mentorship"), mentorshipController.cancelMentorshipByUser);

// Completar uma mentoria (pelo mentor)
router.patch("/:id/complete", authenticate, mentorshipController.completeMentorshipByMentor);

// Registrar conclusão de uma reunião (pelo mentor)
router.post("/:id/record-meeting", authenticate, mentorshipController.recordMeetingCompletionByMentor);

// Admin atualiza status de uma mentoria (rota específica para admin)
router.patch("/:id/admin/status", authenticate, isAdmin, mentorshipController.updateMentorshipStatusByAdmin);

export default router;

