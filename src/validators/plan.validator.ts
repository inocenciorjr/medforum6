import { body, param, query } from 'express-validator';

// Validation rules for creating a plan
export const createPlan = [
  body('name')
    .notEmpty().withMessage('O nome é obrigatório.')
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('price')
    .notEmpty().withMessage('O preço é obrigatório.')
    .isNumeric().withMessage('O preço deve ser um número.')
    .custom((value) => value >= 0).withMessage('O preço não pode ser negativo.'),
  body('currency')
    .optional()
    .isString().withMessage('A moeda deve ser uma string.')
    .isLength({ min: 3, max: 3 }).withMessage('A moeda deve ter 3 caracteres (ex: BRL, USD).')
    .isUppercase().withMessage('A moeda deve estar em maiúsculas (ex: BRL, USD).'),
  body('interval')
    .notEmpty().withMessage('O intervalo é obrigatório.')
    .isIn(['day', 'week', 'month', 'year']).withMessage('Intervalo inválido. Use "day", "week", "month" ou "year".'),
  body('intervalCount')
    .optional()
    .isInt({ min: 1 }).withMessage('O contador de intervalo deve ser um número inteiro positivo.'),
  body('trialPeriodDays')
    .optional()
    .isInt({ min: 0 }).withMessage('O período de teste deve ser um número inteiro não negativo.'),
  body('features')
    .optional()
    .isArray().withMessage('As características devem ser um array.'),
  body('features.*')
    .optional()
    .isString().withMessage('Cada característica deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.'),
  body('stripePriceId')
    .optional()
    .isString().withMessage('O ID do preço no Stripe deve ser uma string.'),
  body('metadata')
    .optional()
    .isObject().withMessage('Os metadados devem ser um objeto.')
];

// Validation rules for getting all plans
export const getAllPlans = [
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.')
];

// Validation rules for getting a plan by ID
export const getPlanById = [
  param('planId')
    .isString().withMessage('ID do plano inválido.')
];

// Validation rules for updating a plan
export const updatePlan = [
  param('planId')
    .isString().withMessage('ID do plano inválido.'),
  body('name')
    .optional()
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('price')
    .optional()
    .isNumeric().withMessage('O preço deve ser um número.')
    .custom((value) => value >= 0).withMessage('O preço não pode ser negativo.'),
  body('currency')
    .optional()
    .isString().withMessage('A moeda deve ser uma string.')
    .isLength({ min: 3, max: 3 }).withMessage('A moeda deve ter 3 caracteres (ex: BRL, USD).')
    .isUppercase().withMessage('A moeda deve estar em maiúsculas (ex: BRL, USD).'),
  body('interval')
    .optional()
    .isIn(['day', 'week', 'month', 'year']).withMessage('Intervalo inválido. Use "day", "week", "month" ou "year".'),
  body('intervalCount')
    .optional()
    .isInt({ min: 1 }).withMessage('O contador de intervalo deve ser um número inteiro positivo.'),
  body('trialPeriodDays')
    .optional()
    .isInt({ min: 0 }).withMessage('O período de teste deve ser um número inteiro não negativo.'),
  body('features')
    .optional()
    .isArray().withMessage('As características devem ser um array.'),
  body('features.*')
    .optional()
    .isString().withMessage('Cada característica deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.'),
  body('stripePriceId')
    .optional()
    .isString().withMessage('O ID do preço no Stripe deve ser uma string.'),
  body('metadata')
    .optional()
    .isObject().withMessage('Os metadados devem ser um objeto.')
];

// Validation rules for deleting a plan
export const deletePlan = [
  param('planId')
    .isString().withMessage('ID do plano inválido.')
];

// Validation rules for toggling plan status
export const togglePlanStatus = [
  param('planId')
    .isString().withMessage('ID do plano inválido.'),
  body('isActive')
    .notEmpty().withMessage('O status é obrigatório.')
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Export all validators
export default {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus
};