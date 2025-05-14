import { Router } from 'express';
import articleController from '../../controllers/article/articleController';
import { validate } from '../../middlewares/validation.middleware';
import articleValidator from '../../validators/article.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin, isAuthorOrAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/articles
 * @desc Cria um novo artigo
 * @access Private (Author, Admin)
 */
router.post('/', 
  authenticate, 
  isAuthorOrAdmin,
  validate(articleValidator.createArticle), 
  articleController.createArticle
);

/**
 * @route GET /api/articles
 * @desc Obtém todos os artigos
 * @access Public/Private (depende dos filtros)
 */
router.get('/', 
  optionalAuthenticate,
  validate(articleValidator.getAllArticles), 
  articleController.getAllArticles
);

/**
 * @route GET /api/articles/me
 * @desc Obtém os artigos do usuário autenticado
 * @access Private
 */
router.get('/me', 
  authenticate, 
  validate(articleValidator.getUserArticles), 
  articleController.getUserArticles
);

/**
 * @route GET /api/articles/statistics
 * @desc Obtém estatísticas de artigos
 * @access Private (Admin)
 */
router.get('/statistics', 
  authenticate, 
  isAdmin,
  validate(articleValidator.getArticleStatistics), 
  articleController.getArticleStatistics
);

/**
 * @route GET /api/articles/:articleId
 * @desc Obtém um artigo pelo ID
 * @access Public/Private (depende do status do artigo)
 */
router.get('/:articleId', 
  optionalAuthenticate,
  validate(articleValidator.getArticleById), 
  articleController.getArticleById
);

/**
 * @route PUT /api/articles/:articleId
 * @desc Atualiza um artigo
 * @access Private (Author, Admin)
 */
router.put('/:articleId', 
  authenticate, 
  validate(articleValidator.updateArticle), 
  articleController.updateArticle
);

/**
 * @route DELETE /api/articles/:articleId
 * @desc Exclui um artigo
 * @access Private (Author, Admin)
 */
router.delete('/:articleId', 
  authenticate, 
  validate(articleValidator.deleteArticle), 
  articleController.deleteArticle
);

/**
 * @route PATCH /api/articles/:articleId/approve
 * @desc Aprova um artigo
 * @access Private (Admin)
 */
router.patch('/:articleId/approve', 
  authenticate, 
  isAdmin,
  validate(articleValidator.approveArticle), 
  articleController.approveArticle
);

/**
 * @route PATCH /api/articles/:articleId/reject
 * @desc Rejeita um artigo
 * @access Private (Admin)
 */
router.patch('/:articleId/reject', 
  authenticate, 
  isAdmin,
  validate(articleValidator.rejectArticle), 
  articleController.rejectArticle
);

/**
 * @route PATCH /api/articles/:articleId/highlight
 * @desc Destaca ou remove destaque de um artigo
 * @access Private (Admin)
 */
router.patch('/:articleId/highlight', 
  authenticate, 
  isAdmin,
  validate(articleValidator.toggleArticleHighlight), 
  articleController.toggleArticleHighlight
);

/**
 * @route PATCH /api/articles/:articleId/like
 * @desc Curtir ou descurtir um artigo
 * @access Private
 */
router.patch('/:articleId/like', 
  authenticate, 
  validate(articleValidator.toggleArticleLike), 
  articleController.toggleArticleLike
);

export default router;