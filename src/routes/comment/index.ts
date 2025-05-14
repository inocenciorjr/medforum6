import { Router } from 'express';
import commentController from '../../controllers/comment/commentController';
import { validate } from '../../middlewares/validation.middleware';
import commentValidator from '../../validators/comment.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/comments/resource/:resourceType/:resourceId
 * @desc Obtém todos os comentários de um recurso
 * @access Public
 */
router.get('/resource/:resourceType/:resourceId', 
  validate(commentValidator.getCommentsByResource), 
  commentController.getCommentsByResource
);

/**
 * @route GET /api/comments/:commentId
 * @desc Obtém um comentário específico pelo ID
 * @access Public
 */
router.get('/:commentId', 
  commentController.getCommentById
);

/**
 * @route POST /api/comments/resource/:resourceType/:resourceId
 * @desc Cria um novo comentário
 * @access Private
 */
router.post('/resource/:resourceType/:resourceId', 
  authenticate, 
  validate(commentValidator.createComment), 
  commentController.createComment
);

/**
 * @route PUT /api/comments/:commentId
 * @desc Atualiza um comentário existente
 * @access Private
 */
router.put('/:commentId', 
  authenticate, 
  validate(commentValidator.updateComment), 
  commentController.updateComment
);

/**
 * @route DELETE /api/comments/:commentId
 * @desc Exclui um comentário
 * @access Private
 */
router.delete('/:commentId', 
  authenticate, 
  commentController.deleteComment
);

/**
 * @route GET /api/comments/:commentId/replies
 * @desc Obtém as respostas de um comentário
 * @access Public
 */
router.get('/:commentId/replies', 
  validate(commentValidator.getCommentReplies), 
  commentController.getCommentReplies
);

/**
 * @route POST /api/comments/:commentId/report
 * @desc Reporta um comentário
 * @access Private
 */
router.post('/:commentId/report', 
  authenticate, 
  validate(commentValidator.reportComment), 
  commentController.reportComment
);

export default router;