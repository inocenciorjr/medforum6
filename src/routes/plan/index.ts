import { Router } from 'express';
import planController from '../../controllers/plan/planController';
import { validate } from '../../middlewares/validation.middleware';
import planValidator from '../../validators/plan.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/plans
 * @desc Cria um novo plano (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin,
  validate(planValidator.createPlan), 
  planController.createPlan
);

/**
 * @route GET /api/plans
 * @desc Obtém todos os planos
 * @access Public/Private (depende se inclui inativos)
 */
router.get('/', 
  optionalAuthenticate,
  validate(planValidator.getAllPlans), 
  planController.getAllPlans
);

/**
 * @route GET /api/plans/:planId
 * @desc Obtém um plano pelo ID
 * @access Public/Private (depende se o plano está ativo)
 */
router.get('/:planId', 
  optionalAuthenticate,
  validate(planValidator.getPlanById), 
  planController.getPlanById
);

/**
 * @route PUT /api/plans/:planId
 * @desc Atualiza um plano (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/:planId', 
  authenticate, 
  isAdmin,
  validate(planValidator.updatePlan), 
  planController.updatePlan
);

/**
 * @route DELETE /api/plans/:planId
 * @desc Exclui um plano (apenas para administradores)
 * @access Private (Admin)
 */
router.delete('/:planId', 
  authenticate, 
  isAdmin,
  validate(planValidator.deletePlan), 
  planController.deletePlan
);

/**
 * @route PATCH /api/plans/:planId/status
 * @desc Ativa ou desativa um plano (apenas para administradores)
 * @access Private (Admin)
 */
router.patch('/:planId/status', 
  authenticate, 
  isAdmin,
  validate(planValidator.togglePlanStatus), 
  planController.togglePlanStatus
);

/**
 * @route GET /api/plans/stats/user-count
 * @desc Obtém o número de usuários por plano (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/stats/user-count', 
  authenticate, 
  isAdmin,
  planController.getUserCountByPlan
);

/**
 * @route POST /api/plans/sync-stripe
 * @desc Sincroniza planos com o Stripe (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/sync-stripe', 
  authenticate, 
  isAdmin,
  planController.syncPlansWithStripe
);

export default router;