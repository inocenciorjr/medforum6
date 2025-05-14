import { Router } from 'express';
import userStatisticsController from '../../controllers/userStatistics/userStatisticsController';
import { validate } from '../../middlewares/validation.middleware';
import userStatisticsValidator from '../../validators/userStatistics.validator';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/statistics
 * @desc Obtém as estatísticas do usuário autenticado
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(userStatisticsValidator.getUserStatistics), 
  userStatisticsController.getUserStatistics
);

/**
 * @route GET /api/statistics/user/:userId
 * @desc Obtém as estatísticas de um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId', 
  authenticate, 
  validate(userStatisticsValidator.getUserStatistics), 
  userStatisticsController.getUserStatistics
);

/**
 * @route GET /api/statistics/period
 * @desc Obtém as estatísticas de estudo por período
 * @access Private
 */
router.get('/period', 
  authenticate, 
  validate(userStatisticsValidator.getStudyStatisticsByPeriod), 
  userStatisticsController.getStudyStatisticsByPeriod
);

/**
 * @route GET /api/statistics/user/:userId/period
 * @desc Obtém as estatísticas de estudo por período de um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId/period', 
  authenticate, 
  validate(userStatisticsValidator.getStudyStatisticsByPeriod), 
  userStatisticsController.getStudyStatisticsByPeriod
);

/**
 * @route GET /api/statistics/performance
 * @desc Obtém as estatísticas de desempenho por categoria
 * @access Private
 */
router.get('/performance', 
  authenticate, 
  validate(userStatisticsValidator.getPerformanceStatisticsByCategory), 
  userStatisticsController.getPerformanceStatisticsByCategory
);

/**
 * @route GET /api/statistics/user/:userId/performance
 * @desc Obtém as estatísticas de desempenho por categoria de um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId/performance', 
  authenticate, 
  validate(userStatisticsValidator.getPerformanceStatisticsByCategory), 
  userStatisticsController.getPerformanceStatisticsByCategory
);

/**
 * @route GET /api/statistics/improvement
 * @desc Obtém as áreas de melhoria recomendadas para o usuário
 * @access Private
 */
router.get('/improvement', 
  authenticate, 
  validate(userStatisticsValidator.getImprovementAreas), 
  userStatisticsController.getImprovementAreas
);

/**
 * @route GET /api/statistics/user/:userId/improvement
 * @desc Obtém as áreas de melhoria recomendadas para um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId/improvement', 
  authenticate, 
  validate(userStatisticsValidator.getImprovementAreas), 
  userStatisticsController.getImprovementAreas
);

/**
 * @route POST /api/statistics/study-session
 * @desc Atualiza as estatísticas após uma sessão de estudo
 * @access Private
 */
router.post('/study-session', 
  authenticate, 
  validate(userStatisticsValidator.updateStatisticsAfterStudySession), 
  userStatisticsController.updateStatisticsAfterStudySession
);

/**
 * @route GET /api/statistics/history
 * @desc Obtém o histórico de sessões de estudo
 * @access Private
 */
router.get('/history', 
  authenticate, 
  validate(userStatisticsValidator.getStudySessionHistory), 
  userStatisticsController.getStudySessionHistory
);

/**
 * @route GET /api/statistics/user/:userId/history
 * @desc Obtém o histórico de sessões de estudo de um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId/history', 
  authenticate, 
  validate(userStatisticsValidator.getStudySessionHistory), 
  userStatisticsController.getStudySessionHistory
);

/**
 * @route GET /api/statistics/goals
 * @desc Obtém o progresso do usuário em relação às metas
 * @access Private
 */
router.get('/goals', 
  authenticate, 
  validate(userStatisticsValidator.getGoalProgress), 
  userStatisticsController.getGoalProgress
);

/**
 * @route GET /api/statistics/user/:userId/goals
 * @desc Obtém o progresso de um usuário específico em relação às metas
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId/goals', 
  authenticate, 
  validate(userStatisticsValidator.getGoalProgress), 
  userStatisticsController.getGoalProgress
);

export default router;