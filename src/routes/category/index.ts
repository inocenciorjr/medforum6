import { Router } from 'express';
import categoryController from '../../controllers/category/categoryController';
import { validate } from '../../middlewares/validation.middleware';
import categoryValidator from '../../validators/category.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/categories
 * @desc Cria uma nova categoria (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin,
  validate(categoryValidator.createCategory), 
  categoryController.createCategory
);

/**
 * @route GET /api/categories
 * @desc Obtém todas as categorias
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/', 
  optionalAuthenticate,
  validate(categoryValidator.getAllCategories), 
  categoryController.getAllCategories
);

/**
 * @route GET /api/categories/:categoryId
 * @desc Obtém uma categoria pelo ID
 * @access Public/Private (depende se a categoria está ativa)
 */
router.get('/:categoryId', 
  optionalAuthenticate,
  validate(categoryValidator.getCategoryById), 
  categoryController.getCategoryById
);

/**
 * @route PUT /api/categories/:categoryId
 * @desc Atualiza uma categoria (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/:categoryId', 
  authenticate, 
  isAdmin,
  validate(categoryValidator.updateCategory), 
  categoryController.updateCategory
);

/**
 * @route DELETE /api/categories/:categoryId
 * @desc Exclui uma categoria (apenas para administradores)
 * @access Private (Admin)
 */
router.delete('/:categoryId', 
  authenticate, 
  isAdmin,
  validate(categoryValidator.deleteCategory), 
  categoryController.deleteCategory
);

/**
 * @route GET /api/categories/:categoryId/subcategories
 * @desc Obtém as subcategorias de uma categoria
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/:categoryId/subcategories', 
  optionalAuthenticate,
  validate(categoryValidator.getSubcategories), 
  categoryController.getSubcategories
);

/**
 * @route GET /api/categories/root
 * @desc Obtém as categorias de nível superior (sem pai)
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/root/all', 
  optionalAuthenticate,
  validate(categoryValidator.getRootCategories), 
  categoryController.getRootCategories
);

/**
 * @route GET /api/categories/:categoryId/path
 * @desc Obtém o caminho completo de uma categoria (da raiz até a categoria)
 * @access Public/Private (depende se a categoria está ativa)
 */
router.get('/:categoryId/path', 
  optionalAuthenticate,
  validate(categoryValidator.getCategoryPath), 
  categoryController.getCategoryPath
);

export default router;