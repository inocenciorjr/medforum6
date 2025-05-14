import { Router } from 'express';
import programmedReviewController from '../../controllers/programmedReview/programmedReviewController';
import { validate } from '../../middlewares/validation.middleware';
import programmedReviewValidator from '../../validators/programmedReview.validator';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /api/programmed-reviews
 * @desc Cria uma nova revisão programada
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(programmedReviewValidator.createProgrammedReview), 
  programmedReviewController.createProgrammedReview
);

/**
 * @route POST /api/programmed-reviews/batch
 * @desc Cria revisões programadas em lote para um deck
 * @access Private
 */
router.post('/batch', 
  authenticate, 
  validate(programmedReviewValidator.createBatchProgrammedReviews), 
  programmedReviewController.createBatchProgrammedReviews
);

/**
 * @route GET /api/programmed-reviews
 * @desc Obtém todas as revisões programadas do usuário
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(programmedReviewValidator.getUserProgrammedReviews), 
  programmedReviewController.getUserProgrammedReviews
);

/**
 * @route GET /api/programmed-reviews/today
 * @desc Obtém as revisões programadas para hoje
 * @access Private
 */
router.get('/today', 
  authenticate, 
  programmedReviewController.getTodayReviews
);

/**
 * @route GET /api/programmed-reviews/upcoming
 * @desc Obtém as próximas revisões programadas
 * @access Private
 */
router.get('/upcoming', 
  authenticate, 
  validate(programmedReviewValidator.getUpcomingReviews), 
  programmedReviewController.getUpcomingReviews
);

/**
 * @route GET /api/programmed-reviews/statistics
 * @desc Obtém estatísticas das revisões programadas
 * @access Private
 */
router.get('/statistics', 
  authenticate, 
  validate(programmedReviewValidator.getProgrammedReviewStatistics), 
  programmedReviewController.getProgrammedReviewStatistics
);

/**
 * @route GET /api/programmed-reviews/:reviewId
 * @desc Obtém uma revisão programada pelo ID
 * @access Private
 */
router.get('/:reviewId', 
  authenticate, 
  validate(programmedReviewValidator.getProgrammedReviewById), 
  programmedReviewController.getProgrammedReviewById
);

/**
 * @route PUT /api/programmed-reviews/:reviewId
 * @desc Atualiza uma revisão programada
 * @access Private
 */
router.put('/:reviewId', 
  authenticate, 
  validate(programmedReviewValidator.updateProgrammedReview), 
  programmedReviewController.updateProgrammedReview
);

/**
 * @route DELETE /api/programmed-reviews/:reviewId
 * @desc Exclui uma revisão programada
 * @access Private
 */
router.delete('/:reviewId', 
  authenticate, 
  validate(programmedReviewValidator.deleteProgrammedReview), 
  programmedReviewController.deleteProgrammedReview
);

/**
 * @route PATCH /api/programmed-reviews/:reviewId/complete
 * @desc Marca uma revisão programada como concluída
 * @access Private
 */
router.patch('/:reviewId/complete', 
  authenticate, 
  validate(programmedReviewValidator.completeProgrammedReview), 
  programmedReviewController.completeProgrammedReview
);

/**
 * @route PATCH /api/programmed-reviews/:reviewId/skip
 * @desc Pula uma revisão programada
 * @access Private
 */
router.patch('/:reviewId/skip', 
  authenticate, 
  validate(programmedReviewValidator.skipProgrammedReview), 
  programmedReviewController.skipProgrammedReview
);

/**
 * @route PATCH /api/programmed-reviews/:reviewId/reschedule
 * @desc Reagenda uma revisão programada
 * @access Private
 */
router.patch('/:reviewId/reschedule', 
  authenticate, 
  validate(programmedReviewValidator.rescheduleProgrammedReview), 
  programmedReviewController.rescheduleProgrammedReview
);

export default router;