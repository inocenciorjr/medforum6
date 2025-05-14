import { body, param, query } from 'express-validator';

// Validation rules for getting user statistics
export const getUserStatistics = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.')
];

// Validation rules for getting study statistics by period
export const getStudyStatisticsByPeriod = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('Data de início inválida. Use o formato ISO8601 (YYYY-MM-DD).'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Data de fim inválida. Use o formato ISO8601 (YYYY-MM-DD).'),
  query('period')
    .optional()
    .isIn(['day', 'week', 'month']).withMessage('Período inválido. Use "day", "week" ou "month".')
];

// Validation rules for getting performance statistics by category
export const getPerformanceStatisticsByCategory = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.')
];

// Validation rules for getting improvement areas
export const getImprovementAreas = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.')
];

// Validation rules for updating statistics after study session
export const updateStatisticsAfterStudySession = [
  body('studyTimeMinutes')
    .isInt({ min: 0 }).withMessage('O tempo de estudo deve ser um número inteiro não negativo.'),
  body('flashcardsStudied')
    .isInt({ min: 0 }).withMessage('O número de flashcards estudados deve ser um número inteiro não negativo.'),
  body('correctAnswers')
    .isInt({ min: 0 }).withMessage('O número de respostas corretas deve ser um número inteiro não negativo.'),
  body('incorrectAnswers')
    .isInt({ min: 0 }).withMessage('O número de respostas incorretas deve ser um número inteiro não negativo.'),
  body('filterStats')
    .optional()
    .isArray().withMessage('As estatísticas por filtro devem ser um array.'),
  body('filterStats.*.filterId')
    .optional()
    .isString().withMessage('ID do filtro inválido.'),
  body('filterStats.*.correct')
    .optional()
    .isInt({ min: 0 }).withMessage('O número de respostas corretas deve ser um número inteiro não negativo.'),
  body('filterStats.*.total')
    .optional()
    .isInt({ min: 0 }).withMessage('O número total de respostas deve ser um número inteiro não negativo.')
];

// Validation rules for getting study session history
export const getStudySessionHistory = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Validation rules for getting goal progress
export const getGoalProgress = [
  param('userId')
    .optional()
    .isString().withMessage('ID do usuário inválido.')
];

// Export all validators
export default {
  getUserStatistics,
  getStudyStatisticsByPeriod,
  getPerformanceStatisticsByCategory,
  getImprovementAreas,
  updateStatisticsAfterStudySession,
  getStudySessionHistory,
  getGoalProgress
};