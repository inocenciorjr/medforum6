import { Router } from 'express';
import couponController from '../../controllers/coupon/couponController';
import { validate } from '../../middlewares/validation.middleware';
import couponValidator from '../../validators/coupon.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/coupons
 * @desc Cria um novo cupom (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin,
  validate(couponValidator.createCoupon), 
  couponController.createCoupon
);

/**
 * @route GET /api/coupons
 * @desc Obtém todos os cupons (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/', 
  authenticate, 
  isAdmin,
  validate(couponValidator.getAllCoupons), 
  couponController.getAllCoupons
);

/**
 * @route GET /api/coupons/:couponId
 * @desc Obtém um cupom pelo ID (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/:couponId', 
  authenticate, 
  isAdmin,
  validate(couponValidator.getCouponById), 
  couponController.getCouponById
);

/**
 * @route POST /api/coupons/validate
 * @desc Valida um cupom pelo código
 * @access Public
 */
router.post('/validate', 
  validate(couponValidator.validateCoupon), 
  couponController.validateCoupon
);

/**
 * @route PUT /api/coupons/:couponId
 * @desc Atualiza um cupom (apenas para administradores)
 * @access Private (Admin)
 */
router.put('/:couponId', 
  authenticate, 
  isAdmin,
  validate(couponValidator.updateCoupon), 
  couponController.updateCoupon
);

/**
 * @route DELETE /api/coupons/:couponId
 * @desc Exclui um cupom (apenas para administradores)
 * @access Private (Admin)
 */
router.delete('/:couponId', 
  authenticate, 
  isAdmin,
  validate(couponValidator.deleteCoupon), 
  couponController.deleteCoupon
);

/**
 * @route PATCH /api/coupons/:couponId/status
 * @desc Ativa ou desativa um cupom (apenas para administradores)
 * @access Private (Admin)
 */
router.patch('/:couponId/status', 
  authenticate, 
  isAdmin,
  validate(couponValidator.toggleCouponStatus), 
  couponController.toggleCouponStatus
);

/**
 * @route GET /api/coupons/stats/usage
 * @desc Obtém estatísticas de uso de cupons (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/stats/usage', 
  authenticate, 
  isAdmin,
  validate(couponValidator.getCouponStatistics), 
  couponController.getCouponStatistics
);

/**
 * @route POST /api/coupons/sync-stripe
 * @desc Sincroniza cupons com o Stripe (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/sync-stripe', 
  authenticate, 
  isAdmin,
  couponController.syncCouponsWithStripe
);

export default router;