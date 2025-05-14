import { Router } from 'express';
import filterController from '../../controllers/filter/filterController';
import { validate } from '../../middlewares/validation.middleware';
import filterValidator from '../../validators/filter.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/filters
 * @desc Cria um novo filtro (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin,
  validate(filterValidator.createFilter), 
  filterController.createFilter
);

/**
 * @route GET /api/filters
 * @desc Obtém todos os filtros
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/', 
  optionalAuthenticate,
  validate(filterValidator.getAllFilters), 
  filterController.getAllFilters
);

/**
 * @route GET /api/filters/:filterId
 * @desc Obtém um filtro pelo ID
 * @access Public/Private (depende se o filtro está ativo)
 */
router.get('/:filterId', 
  optionalAuthenticate,
  validate(filterValidator.getFilterById), 
  filterController.getFilterById
);

/**
 * @route PUT /api/filters/:filterId
 * @desc Atualiza um filtro (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/:filterId', 
  authenticate, 
  isAdmin,
  validate(filterValidator.updateFilter), 
  filterController.updateFilter
);

/**
 * @route DELETE /api/filters/:filterId
 * @desc Exclui um filtro (apenas para administradores)
 * @access Private (Admin)
 */
router.delete('/:filterId', 
  authenticate, 
  isAdmin,
  validate(filterValidator.deleteFilter), 
  filterController.deleteFilter
);

/**
 * @route POST /api/filters/:filterId/subfilters
 * @desc Cria um novo subfiltro (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/:filterId/subfilters', 
  authenticate, 
  isAdmin,
  validate(filterValidator.createSubFilter), 
  filterController.createSubFilter
);

/**
 * @route GET /api/filters/:filterId/subfilters
 * @desc Obtém todos os subfiltros de um filtro
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/:filterId/subfilters', 
  optionalAuthenticate,
  validate(filterValidator.getSubFiltersByFilterId), 
  filterController.getSubFiltersByFilterId
);

/**
 * @route GET /api/filters/subfilters/:subFilterId
 * @desc Obtém um subfiltro pelo ID
 * @access Public/Private (depende se o subfiltro está ativo)
 */
router.get('/subfilters/:subFilterId', 
  optionalAuthenticate,
  validate(filterValidator.getSubFilterById), 
  filterController.getSubFilterById
);

/**
 * @route PUT /api/filters/subfilters/:subFilterId
 * @desc Atualiza um subfiltro (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/subfilters/:subFilterId', 
  authenticate, 
  isAdmin,
  validate(filterValidator.updateSubFilter), 
  filterController.updateSubFilter
);

/**
 * @route DELETE /api/filters/subfilters/:subFilterId
 * @desc Exclui um subfiltro (apenas para administradores)
 * @access Private (Admin)
 */
router.delete('/subfilters/:subFilterId', 
  authenticate, 
  isAdmin,
  validate(filterValidator.deleteSubFilter), 
  filterController.deleteSubFilter
);

export default router;