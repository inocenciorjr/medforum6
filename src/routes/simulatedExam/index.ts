import { Router } from 'express';
import simulatedExamController from '../../controllers/simulatedExam/simulatedExamController';
import { validate } from '../../middlewares/validation.middleware';
import simulatedExamValidator from '../../validators/simulatedExam.validator';
import { authenticate } from '../../middlewares/auth.middleware';
import { checkRole } from '../../middlewares/role.middleware';
import { UserRole } from '../../types/firebaseTypes';

const router = Router();

/**
 * @route POST /api/simulated-exams
 * @desc Cria um novo simulado
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(simulatedExamValidator.createSimulatedExam), 
  simulatedExamController.createSimulatedExam
);

/**
 * @route GET /api/simulated-exams
 * @desc Obtém todos os simulados do usuário
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(simulatedExamValidator.getUserSimulatedExams), 
  simulatedExamController.getUserSimulatedExams
);

/**
 * @route GET /api/simulated-exams/public
 * @desc Obtém simulados públicos
 * @access Public
 */
router.get('/public', 
  validate(simulatedExamValidator.getPublicSimulatedExams), 
  simulatedExamController.getPublicSimulatedExams
);

/**
 * @route GET /api/simulated-exams/attempts
 * @desc Obtém todas as tentativas de simulado do usuário
 * @access Private
 */
router.get('/attempts', 
  authenticate, 
  validate(simulatedExamValidator.getUserSimulatedExamAttempts), 
  simulatedExamController.getUserSimulatedExamAttempts
);

/**
 * @route GET /api/simulated-exams/statistics
 * @desc Obtém estatísticas de simulados do usuário
 * @access Private
 */
router.get('/statistics', 
  authenticate, 
  validate(simulatedExamValidator.getUserSimulatedExamStatistics), 
  simulatedExamController.getUserSimulatedExamStatistics
);

/**
 * @route GET /api/simulated-exams/:examId
 * @desc Obtém um simulado pelo ID
 * @access Private
 */
router.get('/:examId', 
  authenticate, 
  validate(simulatedExamValidator.getSimulatedExamById), 
  simulatedExamController.getSimulatedExamById
);

/**
 * @route PUT /api/simulated-exams/:examId
 * @desc Atualiza um simulado
 * @access Private
 */
router.put('/:examId', 
  authenticate, 
  validate(simulatedExamValidator.updateSimulatedExam), 
  simulatedExamController.updateSimulatedExam
);

/**
 * @route DELETE /api/simulated-exams/:examId
 * @desc Exclui um simulado
 * @access Private
 */
router.delete('/:examId', 
  authenticate, 
  validate(simulatedExamValidator.deleteSimulatedExam), 
  simulatedExamController.deleteSimulatedExam
);

/**
 * @route POST /api/simulated-exams/:examId/start
 * @desc Inicia um simulado
 * @access Private
 */
router.post('/:examId/start', 
  authenticate, 
  validate(simulatedExamValidator.startSimulatedExam), 
  simulatedExamController.startSimulatedExam
);

/**
 * @route POST /api/simulated-exams/attempts/:attemptId/submit
 * @desc Submete respostas para um simulado
 * @access Private
 */
router.post('/attempts/:attemptId/submit', 
  authenticate, 
  validate(simulatedExamValidator.submitSimulatedExamAnswers), 
  simulatedExamController.submitSimulatedExamAnswers
);

/**
 * @route GET /api/simulated-exams/attempts/:attemptId/result
 * @desc Obtém o resultado de uma tentativa de simulado
 * @access Private
 */
router.get('/attempts/:attemptId/result', 
  authenticate, 
  validate(simulatedExamValidator.getSimulatedExamAttemptResult), 
  simulatedExamController.getSimulatedExamAttemptResult
);

/**
 * @route POST /api/simulated-exams/:examId/rate
 * @desc Avalia um simulado
 * @access Private
 */
router.post('/:examId/rate', 
  authenticate, 
  validate(simulatedExamValidator.rateSimulatedExam), 
  simulatedExamController.rateSimulatedExam
);

/**
 * @route GET /api/simulated-exams/:examId/export/pdf
 * @desc Exporta um simulado para PDF
 * @access Private
 */
router.get('/:examId/export/pdf', 
  authenticate, 
  validate(simulatedExamValidator.exportSimulatedExamToPdf), 
  simulatedExamController.exportSimulatedExamToPdf
);

/**
 * @route POST /api/simulated-exams/:examId/questions
 * @desc Adiciona questões a um simulado
 * @access Private
 */
router.post('/:examId/questions', 
  authenticate, 
  validate(simulatedExamValidator.addQuestionsToSimulatedExam), 
  simulatedExamController.addQuestionsToSimulatedExam
);

/**
 * @route DELETE /api/simulated-exams/:examId/questions
 * @desc Remove questões de um simulado
 * @access Private
 */
router.delete('/:examId/questions', 
  authenticate, 
  validate(simulatedExamValidator.removeQuestionsFromSimulatedExam), 
  simulatedExamController.removeQuestionsFromSimulatedExam
);

/**
 * @route POST /api/simulated-exams/:examId/duplicate
 * @desc Duplica um simulado
 * @access Private
 */
router.post('/:examId/duplicate', 
  authenticate, 
  validate(simulatedExamValidator.duplicateSimulatedExam), 
  simulatedExamController.duplicateSimulatedExam
);

export default router;