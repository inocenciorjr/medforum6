import { Router } from 'express';
import reportController from '../../controllers/report/reportController';
import { validate } from '../../middlewares/validation.middleware';
import reportValidator from '../../validators/report.validator';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/reports
 * @desc Cria uma nova denúncia
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(reportValidator.createReport), 
  reportController.createReport
);

/**
 * @route GET /api/reports
 * @desc Obtém todas as denúncias (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/', 
  authenticate, 
  isAdmin,
  validate(reportValidator.getAllReports), 
  reportController.getAllReports
);

/**
 * @route GET /api/reports/:reportId
 * @desc Obtém uma denúncia pelo ID
 * @access Private (Admin ou autor da denúncia)
 */
router.get('/:reportId', 
  authenticate, 
  validate(reportValidator.getReportById), 
  reportController.getReportById
);

/**
 * @route PUT /api/reports/:reportId/status
 * @desc Atualiza o status de uma denúncia (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/:reportId/status', 
  authenticate, 
  isAdmin,
  validate(reportValidator.updateReportStatus), 
  reportController.updateReportStatus
);

/**
 * @route GET /api/reports/user/me
 * @desc Obtém as denúncias feitas pelo usuário autenticado
 * @access Private
 */
router.get('/user/me', 
  authenticate, 
  validate(reportValidator.getUserReports), 
  reportController.getUserReports
);

/**
 * @route GET /api/reports/resource/:resourceType/:resourceId
 * @desc Obtém as denúncias relacionadas a um recurso específico (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/resource/:resourceType/:resourceId', 
  authenticate, 
  isAdmin,
  validate(reportValidator.getResourceReports), 
  reportController.getResourceReports
);

/**
 * @route GET /api/reports/statistics
 * @desc Obtém estatísticas de denúncias (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/statistics', 
  authenticate, 
  isAdmin,
  validate(reportValidator.getReportStatistics), 
  reportController.getReportStatistics
);

export default router;