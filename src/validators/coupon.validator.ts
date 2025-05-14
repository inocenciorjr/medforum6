import { body, param, query } from 'express-validator';

// Validation rules for creating a coupon
export const createCoupon = [
  body('code')
    .notEmpty().withMessage('O código é obrigatório.')
    .isString().withMessage('O código deve ser uma string.')
    .isLength({ min: 3, max: 20 }).withMessage('O código deve ter entre 3 e 20 caracteres.')
    .matches(/^[A-Z0-9_-]+$/).withMessage('O código deve conter apenas letras maiúsculas, números, hífens e sublinhados.'),
  body('discountType')
    .notEmpty().withMessage('O tipo de desconto é obrigatório.')
    .isIn(['percentage', 'fixed']).withMessage('Tipo de desconto inválido. Use "percentage" ou "fixed".'),
  body('discountValue')
    .notEmpty().withMessage('O valor do desconto é obrigatório.')
    .isNumeric().withMessage('O valor do desconto deve ser um número.')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percentage' && (value <= 0 || value > 100)) {
        throw new Error('Para descontos percentuais, o valor deve estar entre 0 e 100.');
      } else if (req.body.discountType === 'fixed' && value <= 0) {
        throw new Error('Para descontos fixos, o valor deve ser maior que 0.');
      }
      return true;
    }),
  body('maxUses')
    .optional()
    .isInt({ min: 1 }).withMessage('O número máximo de usos deve ser um número inteiro positivo.'),
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('A data de expiração deve estar no formato ISO8601.')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('A data de expiração deve ser no futuro.');
      }
      return true;
    }),
  body('planIds')
    .optional()
    .isArray().withMessage('Os IDs de planos devem ser um array.'),
  body('planIds.*')
    .optional()
    .isString().withMessage('Cada ID de plano deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('stripeCouponId')
    .optional()
    .isString().withMessage('O ID do cupom no Stripe deve ser uma string.')
];

// Validation rules for getting all coupons
export const getAllCoupons = [
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.'),
  query('includeExpired')
    .optional()
    .isBoolean().withMessage('O campo includeExpired deve ser um booleano.')
];

// Validation rules for getting a coupon by ID
export const getCouponById = [
  param('couponId')
    .isString().withMessage('ID do cupom inválido.')
];

// Validation rules for validating a coupon
export const validateCoupon = [
  body('code')
    .notEmpty().withMessage('O código é obrigatório.')
    .isString().withMessage('O código deve ser uma string.'),
  body('planId')
    .optional()
    .isString().withMessage('O ID do plano deve ser uma string.')
];

// Validation rules for updating a coupon
export const updateCoupon = [
  param('couponId')
    .isString().withMessage('ID do cupom inválido.'),
  body('code')
    .optional()
    .isString().withMessage('O código deve ser uma string.')
    .isLength({ min: 3, max: 20 }).withMessage('O código deve ter entre 3 e 20 caracteres.')
    .matches(/^[A-Z0-9_-]+$/).withMessage('O código deve conter apenas letras maiúsculas, números, hífens e sublinhados.'),
  body('discountType')
    .optional()
    .isIn(['percentage', 'fixed']).withMessage('Tipo de desconto inválido. Use "percentage" ou "fixed".'),
  body('discountValue')
    .optional()
    .isNumeric().withMessage('O valor do desconto deve ser um número.')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percentage' && (value <= 0 || value > 100)) {
        throw new Error('Para descontos percentuais, o valor deve estar entre 0 e 100.');
      } else if (req.body.discountType === 'fixed' && value <= 0) {
        throw new Error('Para descontos fixos, o valor deve ser maior que 0.');
      }
      return true;
    }),
  body('maxUses')
    .optional()
    .isInt({ min: 1 }).withMessage('O número máximo de usos deve ser um número inteiro positivo.'),
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('A data de expiração deve estar no formato ISO8601.')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('A data de expiração deve ser no futuro.');
      }
      return true;
    }),
  body('planIds')
    .optional()
    .isArray().withMessage('Os IDs de planos devem ser um array.'),
  body('planIds.*')
    .optional()
    .isString().withMessage('Cada ID de plano deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('stripeCouponId')
    .optional()
    .isString().withMessage('O ID do cupom no Stripe deve ser uma string.')
];

// Validation rules for deleting a coupon
export const deleteCoupon = [
  param('couponId')
    .isString().withMessage('ID do cupom inválido.')
];

// Validation rules for toggling coupon status
export const toggleCouponStatus = [
  param('couponId')
    .isString().withMessage('ID do cupom inválido.'),
  body('isActive')
    .notEmpty().withMessage('O status é obrigatório.')
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for getting coupon statistics
export const getCouponStatistics = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('A data de fim deve estar no formato ISO8601.')
];

// Export all validators
export default {
  createCoupon,
  getAllCoupons,
  getCouponById,
  validateCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponStatistics
};