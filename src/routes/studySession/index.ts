import { Router } from 'express';
import studySessionController from '../../controllers/studySession/studySessionController';
import { validate } from '../../middlewares/validation.middleware';
import studySessionValidator from '../../validators/studySession.validator';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /api/study-sessions/start
 * @desc Inicia uma nova sessão de estudo
 * @access Private
 */
router.post('/start', 
  authenticate, 
  validate(studySessionValidator.startStudySession), 
  studySessionController.startStudySession
);

/**
 * @route POST /api/study-sessions/end
 * @desc Finaliza uma sessão de estudo
 * @access Private
 */
router.post('/end', 
  authenticate, 
  validate(studySessionValidator.endStudySession), 
  studySessionController.endStudySession
);

/**
 * @route GET /api/study-sessions/:sessionId
 * @desc Obtém uma sessão de estudo pelo ID
 * @access Private
 */
router.get('/:sessionId', 
  authenticate, 
  validate(studySessionValidator.getStudySessionById), 
  studySessionController.getStudySessionById
);

/**
 * @route GET /api/study-sessions/user
 * @desc Obtém todas as sessões de estudo do usuário autenticado
 * @access Private
 */
router.get('/user', 
  authenticate, 
  validate(studySessionValidator.getUserStudySessions), 
  studySessionController.getUserStudySessions
);

/**
 * @route GET /api/study-sessions/user/:userId
 * @desc Obtém todas as sessões de estudo de um usuário específico
 * @access Private (Admin ou próprio usuário)
 */
router.get('/user/:userId', 
  authenticate, 
  validate(studySessionValidator.getUserStudySessions), 
  studySessionController.getUserStudySessions
);

/**
 * @route GET /api/study-sessions/deck/:deckId
 * @desc Obtém as sessões de estudo de um deck
 * @access Private
 */
router.get('/deck/:deckId', 
  authenticate, 
  validate(studySessionValidator.getDeckStudySessions), 
  studySessionController.getDeckStudySessions
);

/**
 * @route GET /api/study-sessions/:sessionId/analysis
 * @desc Obtém análise de desempenho de uma sessão de estudo
 * @access Private
 */
router.get('/:sessionId/analysis', 
  authenticate, 
  validate(studySessionValidator.getStudySessionAnalysis), 
  studySessionController.getStudySessionAnalysis
);

/**
 * @route POST /api/study-sessions/:sessionId/interaction
 * @desc Adiciona uma interação com flashcard durante uma sessão de estudo
 * @access Private
 */
router.post('/:sessionId/interaction', 
  authenticate, 
  validate(studySessionValidator.addFlashcardInteraction), 
  studySessionController.addFlashcardInteraction
);

export default router;