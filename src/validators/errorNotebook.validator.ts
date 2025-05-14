import { body, param, query } from 'express-validator';

// Validation rules for adding an error entry
export const addErrorEntry = [
  body('questionId')
    .notEmpty().withMessage('O ID da questão é obrigatório.')
    .isString().withMessage('O ID da questão deve ser uma string.'),
  body('userAnswer')
    .optional()
    .isString().withMessage('A resposta do usuário deve ser uma string.'),
  body('notes')
    .optional()
    .isString().withMessage('As anotações devem ser uma string.'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Dificuldade inválida. Use "easy", "medium" ou "hard".'),
  body('source')
    .optional()
    .isString().withMessage('A fonte deve ser uma string.'),
  body('sourceType')
    .optional()
    .isIn(['simulatedExam', 'studySession', 'manual', 'other']).withMessage('Tipo de fonte inválido.'),
  body('tags')
    .optional()
    .isArray().withMessage('As tags devem ser um array.'),
  body('tags.*')
    .optional()
    .isString().withMessage('Cada tag deve ser uma string.')
];

// Validation rules for getting an error entry by ID
export const getErrorEntryById = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.')
];

// Validation rules for updating an error entry
export const updateErrorEntry = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.'),
  body('notes')
    .optional()
    .isString().withMessage('As anotações devem ser uma string.'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Dificuldade inválida. Use "easy", "medium" ou "hard".'),
  body('tags')
    .optional()
    .isArray().withMessage('As tags devem ser um array.'),
  body('tags.*')
    .optional()
    .isString().withMessage('Cada tag deve ser uma string.'),
  body('isArchived')
    .optional()
    .isBoolean().withMessage('O campo isArchived deve ser um booleano.'),
  body('isMastered')
    .optional()
    .isBoolean().withMessage('O campo isMastered deve ser um booleano.')
];

// Validation rules for deleting an error entry
export const deleteErrorEntry = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.')
];

// Validation rules for getting user error entries
export const getUserErrorEntries = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('subject')
    .optional()
    .isString().withMessage('O assunto deve ser uma string.'),
  query('topic')
    .optional()
    .isString().withMessage('O tópico deve ser uma string.'),
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Dificuldade inválida. Use "easy", "medium" ou "hard".'),
  query('tag')
    .optional()
    .isString().withMessage('A tag deve ser uma string.'),
  query('isArchived')
    .optional()
    .isBoolean().withMessage('O campo isArchived deve ser um booleano.'),
  query('isMastered')
    .optional()
    .isBoolean().withMessage('O campo isMastered deve ser um booleano.'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'lastReviewedAt', 'nextReviewAt', 'reviewCount', 'difficulty'])
    .withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem de classificação inválida. Use "asc" ou "desc".'),
  query('search')
    .optional()
    .isString().withMessage('A consulta de pesquisa deve ser uma string.')
];

// Validation rules for reviewing an error entry
export const reviewErrorEntry = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.'),
  body('result')
    .notEmpty().withMessage('O resultado da revisão é obrigatório.')
    .isIn(['correct', 'incorrect']).withMessage('Resultado inválido. Use "correct" ou "incorrect".'),
  body('notes')
    .optional()
    .isString().withMessage('As anotações devem ser uma string.'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Dificuldade inválida. Use "easy", "medium" ou "hard".')
];

// Validation rules for getting error entry review history
export const getErrorEntryReviewHistory = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.')
];

// Validation rules for toggling archive status
export const toggleArchiveErrorEntry = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.'),
  body('isArchived')
    .notEmpty().withMessage('O status de arquivamento é obrigatório.')
    .isBoolean().withMessage('O campo isArchived deve ser um booleano.')
];

// Validation rules for toggling mastered status
export const toggleMasteredErrorEntry = [
  param('entryId')
    .isString().withMessage('ID da entrada inválido.'),
  body('isMastered')
    .notEmpty().withMessage('O status de domínio é obrigatório.')
    .isBoolean().withMessage('O campo isMastered deve ser um booleano.')
];

// Validation rules for getting due reviews
export const getDueReviews = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('subject')
    .optional()
    .isString().withMessage('O assunto deve ser uma string.'),
  query('topic')
    .optional()
    .isString().withMessage('O tópico deve ser uma string.')
];

// Validation rules for importing from simulated exam
export const importFromSimulatedExam = [
  body('examId')
    .notEmpty().withMessage('O ID do simulado é obrigatório.')
    .isString().withMessage('O ID do simulado deve ser uma string.'),
  body('questionIds')
    .notEmpty().withMessage('Os IDs das questões são obrigatórios.')
    .isArray().withMessage('Os IDs das questões devem ser um array.'),
  body('questionIds.*')
    .isString().withMessage('Cada ID de questão deve ser uma string.')
];

// Validation rules for exporting to PDF
export const exportToPdf = [
  query('subject')
    .optional()
    .isString().withMessage('O assunto deve ser uma string.'),
  query('topic')
    .optional()
    .isString().withMessage('O tópico deve ser uma string.'),
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Dificuldade inválida. Use "easy", "medium" ou "hard".'),
  query('tag')
    .optional()
    .isString().withMessage('A tag deve ser uma string.'),
  query('isArchived')
    .optional()
    .isBoolean().withMessage('O campo isArchived deve ser um booleano.'),
  query('isMastered')
    .optional()
    .isBoolean().withMessage('O campo isMastered deve ser um booleano.')
];

// Export all validators
export default {
  addErrorEntry,
  getErrorEntryById,
  updateErrorEntry,
  deleteErrorEntry,
  getUserErrorEntries,
  reviewErrorEntry,
  getErrorEntryReviewHistory,
  toggleArchiveErrorEntry,
  toggleMasteredErrorEntry,
  getDueReviews,
  importFromSimulatedExam,
  exportToPdf
};