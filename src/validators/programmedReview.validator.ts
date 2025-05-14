import { body, param, query } from 'express-validator';
import { ReviewStatus } from '../types/firebaseTypes';

// Validation rules for creating a programmed review
export const createProgrammedReview = [
  body('deckId')
    .notEmpty().withMessage('O ID do deck é obrigatório.')
    .isString().withMessage('O ID do deck deve ser uma string.'),
  body('scheduledDate')
    .notEmpty().withMessage('A data programada é obrigatória.')
    .isISO8601().withMessage('A data programada deve estar no formato ISO8601.'),
  body('title')
    .optional()
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.'),
  body('reminderEnabled')
    .optional()
    .isBoolean().withMessage('O campo reminderEnabled deve ser um booleano.'),
  body('reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('O horário do lembrete deve estar no formato HH:MM.')
];

// Validation rules for getting a programmed review by ID
export const getProgrammedReviewById = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.')
];

// Validation rules for updating a programmed review
export const updateProgrammedReview = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.'),
  body('scheduledDate')
    .optional()
    .isISO8601().withMessage('A data programada deve estar no formato ISO8601.'),
  body('title')
    .optional()
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.'),
  body('reminderEnabled')
    .optional()
    .isBoolean().withMessage('O campo reminderEnabled deve ser um booleano.'),
  body('reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('O horário do lembrete deve estar no formato HH:MM.')
];

// Validation rules for deleting a programmed review
export const deleteProgrammedReview = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.')
];

// Validation rules for getting user programmed reviews
export const getUserProgrammedReviews = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('status')
    .optional()
    .isIn(Object.values(ReviewStatus))
    .withMessage('Status inválido.'),
  query('deckId')
    .optional()
    .isString().withMessage('O ID do deck deve ser uma string.'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('A data de fim deve estar no formato ISO8601.'),
  query('sortBy')
    .optional()
    .isIn(['scheduledDate', 'createdAt', 'updatedAt', 'completedAt', 'skippedAt'])
    .withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem de classificação inválida. Use "asc" ou "desc".')
];

// Validation rules for completing a programmed review
export const completeProgrammedReview = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.'),
  body('score')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('A pontuação deve ser um número entre 0 e 100.'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 }).withMessage('O tempo gasto deve ser um número inteiro positivo.'),
  body('cardsReviewed')
    .optional()
    .isInt({ min: 0 }).withMessage('O número de cartões revisados deve ser um número inteiro positivo.')
];

// Validation rules for skipping a programmed review
export const skipProgrammedReview = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.')
];

// Validation rules for rescheduling a programmed review
export const rescheduleProgrammedReview = [
  param('reviewId')
    .isString().withMessage('ID da revisão programada inválido.'),
  body('scheduledDate')
    .notEmpty().withMessage('A nova data programada é obrigatória.')
    .isISO8601().withMessage('A nova data programada deve estar no formato ISO8601.')
];

// Validation rules for getting upcoming reviews
export const getUpcomingReviews = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 30 }).withMessage('O número de dias deve ser um número inteiro entre 1 e 30.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.')
];

// Validation rules for getting programmed review statistics
export const getProgrammedReviewStatistics = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('A data de fim deve estar no formato ISO8601.')
];

// Validation rules for creating batch programmed reviews
export const createBatchProgrammedReviews = [
  body('deckId')
    .notEmpty().withMessage('O ID do deck é obrigatório.')
    .isString().withMessage('O ID do deck deve ser uma string.'),
  body('startDate')
    .notEmpty().withMessage('A data de início é obrigatória.')
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  body('endDate')
    .notEmpty().withMessage('A data de término é obrigatória.')
    .isISO8601().withMessage('A data de término deve estar no formato ISO8601.'),
  body('frequency')
    .notEmpty().withMessage('A frequência é obrigatória.')
    .isIn(['daily', 'weekly', 'biweekly', 'monthly']).withMessage('Frequência inválida. Use "daily", "weekly", "biweekly" ou "monthly".'),
  body('daysOfWeek')
    .optional()
    .isArray().withMessage('Os dias da semana devem ser um array.'),
  body('daysOfWeek.*')
    .optional()
    .isInt({ min: 0, max: 6 }).withMessage('Cada dia da semana deve ser um número inteiro entre 0 (domingo) e 6 (sábado).'),
  body('title')
    .optional()
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.'),
  body('reminderEnabled')
    .optional()
    .isBoolean().withMessage('O campo reminderEnabled deve ser um booleano.'),
  body('reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('O horário do lembrete deve estar no formato HH:MM.')
];

// Export all validators
export default {
  createProgrammedReview,
  getProgrammedReviewById,
  updateProgrammedReview,
  deleteProgrammedReview,
  getUserProgrammedReviews,
  completeProgrammedReview,
  skipProgrammedReview,
  rescheduleProgrammedReview,
  getUpcomingReviews,
  getProgrammedReviewStatistics,
  createBatchProgrammedReviews
};