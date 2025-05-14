import { body, param, query } from 'express-validator';

// Validation rules for creating a report
export const createReport = [
  body('resourceType')
    .notEmpty().withMessage('O tipo de recurso é obrigatório.')
    .isIn(['DECK', 'FLASHCARD', 'COMMENT', 'USER', 'ARTICLE', 'QUESTION'])
    .withMessage('Tipo de recurso inválido.'),
  body('resourceId')
    .notEmpty().withMessage('O ID do recurso é obrigatório.')
    .isString().withMessage('O ID do recurso deve ser uma string.'),
  body('reason')
    .notEmpty().withMessage('O motivo da denúncia é obrigatório.')
    .isIn(['INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'SPAM', 'OFFENSIVE_CONTENT', 'MISINFORMATION', 'OTHER'])
    .withMessage('Motivo inválido.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 1000 }).withMessage('A descrição não pode exceder 1000 caracteres.')
];

// Validation rules for getting all reports
export const getAllReports = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.'),
  query('status')
    .optional()
    .isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ALL'])
    .withMessage('Status inválido.'),
  query('resourceType')
    .optional()
    .isIn(['DECK', 'FLASHCARD', 'COMMENT', 'USER', 'ARTICLE', 'QUESTION', 'ALL'])
    .withMessage('Tipo de recurso inválido.')
];

// Validation rules for getting a report by ID
export const getReportById = [
  param('reportId')
    .isString().withMessage('ID da denúncia inválido.')
];

// Validation rules for updating report status
export const updateReportStatus = [
  param('reportId')
    .isString().withMessage('ID da denúncia inválido.'),
  body('status')
    .notEmpty().withMessage('O status é obrigatório.')
    .isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'])
    .withMessage('Status inválido.'),
  body('adminNotes')
    .optional()
    .isString().withMessage('As notas do administrador devem ser uma string.')
    .isLength({ max: 1000 }).withMessage('As notas do administrador não podem exceder 1000 caracteres.')
];

// Validation rules for getting user reports
export const getUserReports = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Validation rules for getting resource reports
export const getResourceReports = [
  param('resourceType')
    .isIn(['DECK', 'FLASHCARD', 'COMMENT', 'USER', 'ARTICLE', 'QUESTION'])
    .withMessage('Tipo de recurso inválido.'),
  param('resourceId')
    .isString().withMessage('ID do recurso inválido.')
];

// Validation rules for getting report statistics
export const getReportStatistics = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('A data de fim deve estar no formato ISO8601.')
];

// Export all validators
export default {
  createReport,
  getAllReports,
  getReportById,
  updateReportStatus,
  getUserReports,
  getResourceReports,
  getReportStatistics
};