import { Router } from 'express';
import tagController from '../../controllers/tag/tagController';
import { validate } from '../../middlewares/validation.middleware';
import tagValidator from '../../validators/tag.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/tags
 * @desc Obtém todas as tags
 * @access Public
 */
router.get('/', 
  optionalAuthenticate,
  validate(tagValidator.getAllTags), 
  tagController.getAllTags
);

/**
 * @route GET /api/tags/:tagId
 * @desc Obtém uma tag pelo ID
 * @access Public
 */
router.get('/:tagId', 
  validate(tagValidator.getTagById), 
  tagController.getTagById
);

/**
 * @route POST /api/tags
 * @desc Cria uma nova tag
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(tagValidator.createTag), 
  tagController.createTag
);

/**
 * @route PUT /api/tags/:tagId
 * @desc Atualiza uma tag existente
 * @access Private
 */
router.put('/:tagId', 
  authenticate, 
  validate(tagValidator.updateTag), 
  tagController.updateTag
);

/**
 * @route DELETE /api/tags/:tagId
 * @desc Exclui uma tag
 * @access Private
 */
router.delete('/:tagId', 
  authenticate, 
  validate(tagValidator.deleteTag), 
  tagController.deleteTag
);

/**
 * @route GET /api/tags/popular
 * @desc Obtém tags populares
 * @access Public
 */
router.get('/popular', 
  validate(tagValidator.getPopularTags), 
  tagController.getPopularTags
);

/**
 * @route GET /api/tags/:tagId/related
 * @desc Obtém tags relacionadas a uma tag específica
 * @access Public
 */
router.get('/:tagId/related', 
  validate(tagValidator.getRelatedTags), 
  tagController.getRelatedTags
);

/**
 * @route GET /api/tags/search
 * @desc Pesquisa tags por nome
 * @access Public
 */
router.get('/search', 
  validate(tagValidator.searchTags), 
  tagController.searchTags
);

export default router;