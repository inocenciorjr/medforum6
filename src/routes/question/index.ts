import { Router } from "express";
import questionController from "../../controllers/question/questionController";
import questionValidator from "../../validators/question.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { isAdmin } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { rateLimit } from "../../middlewares/rateLimit.middleware";

const router = Router();

/**
 * @route   POST /api/questions
 * @desc    Cria uma nova questão
 * @access  Private (Admin)
 */
router.post(
  "/",
  authenticate,
  isAdmin,
  rateLimit("create_question", 50, 60 * 60), // 50 por hora
  validate(questionValidator.createQuestion),
  questionController.createQuestion
);

/**
 * @route   GET /api/questions/:questionId
 * @desc    Obtém uma questão pelo ID
 * @access  Public
 */
router.get(
  "/:questionId",
  validate(questionValidator.getQuestionById),
  questionController.getQuestionById
);

/**
 * @route   GET /api/questions
 * @desc    Lista questões com filtros e paginação
 * @access  Public
 */
router.get(
  "/",
  validate(questionValidator.getQuestions),
  questionController.getQuestions
);

/**
 * @route   GET /api/questions/category/:categoryId
 * @desc    Obtém questões por categoria
 * @access  Public
 */
router.get(
  "/category/:categoryId",
  validate([
    ...questionValidator.getQuestions,
    ...questionValidator.getQuestionById
  ]),
  questionController.getQuestionsByCategory
);

/**
 * @route   GET /api/questions/random
 * @desc    Obtém questões aleatórias
 * @access  Public
 */
router.get(
  "/random",
  validate(questionValidator.getQuestions),
  questionController.getRandomQuestions
);

/**
 * @route   PUT /api/questions/:questionId
 * @desc    Atualiza uma questão existente
 * @access  Private (Admin)
 */
router.put(
  "/:questionId",
  authenticate,
  isAdmin,
  validate(questionValidator.updateQuestion),
  questionController.updateQuestion
);

/**
 * @route   DELETE /api/questions/:questionId
 * @desc    Exclui uma questão
 * @access  Private (Admin)
 */
router.delete(
  "/:questionId",
  authenticate,
  isAdmin,
  validate(questionValidator.deleteQuestion),
  questionController.deleteQuestion
);

/**
 * @route   POST /api/questions/import
 * @desc    Importa questões em lote
 * @access  Private (Admin)
 */
router.post(
  "/import",
  authenticate,
  isAdmin,
  rateLimit("import_questions", 10, 60 * 60), // 10 por hora
  validate(questionValidator.importQuestions),
  questionController.importQuestions
);

/**
 * @route   GET /api/questions/export
 * @desc    Exporta questões
 * @access  Private (Admin)
 */
router.get(
  "/export",
  authenticate,
  isAdmin,
  validate(questionValidator.exportQuestions),
  questionController.exportQuestions
);

/**
 * @route   POST /api/questions/:questionId/report
 * @desc    Reporta um problema em uma questão
 * @access  Private
 */
router.post(
  "/:questionId/report",
  authenticate,
  rateLimit("report_question", 20, 60 * 60), // 20 por hora
  validate(questionValidator.reportQuestion),
  questionController.reportQuestion
);

export default router;