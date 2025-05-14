import { body, param, query } from 'express-validator';
import { SimulatedExamStatus } from '../types/firebaseTypes';

// Validation rules for creating a simulated exam
export const createSimulatedExam = [
  body('title')
    .notEmpty().withMessage('O título é obrigatório.')
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('duration')
    .optional()
    .isInt({ min: 5, max: 300 }).withMessage('A duração deve ser um número inteiro entre 5 e 300 minutos.'),
  body('questionCount')
    .notEmpty().withMessage('O número de questões é obrigatório.')
    .isInt({ min: 1, max: 100 }).withMessage('O número de questões deve ser um número inteiro entre 1 e 100.'),
  body('categories')
    .notEmpty().withMessage('As categorias são obrigatórias.')
    .isArray().withMessage('As categorias devem ser um array.')
    .custom(value => value.length > 0).withMessage('Pelo menos uma categoria deve ser selecionada.'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('A dificuldade deve ser "easy", "medium" ou "hard".'),
  body('isPublic')
    .optional()
    .isBoolean().withMessage('O campo isPublic deve ser um booleano.'),
  body('tags')
    .optional()
    .isArray().withMessage('As tags devem ser um array.')
];

// Validation rules for getting a simulated exam by ID
export const getSimulatedExamById = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.')
];

// Validation rules for updating a simulated exam
export const updateSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.'),
  body('title')
    .optional()
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('duration')
    .optional()
    .isInt({ min: 5, max: 300 }).withMessage('A duração deve ser um número inteiro entre 5 e 300 minutos.'),
  body('isPublic')
    .optional()
    .isBoolean().withMessage('O campo isPublic deve ser um booleano.'),
  body('tags')
    .optional()
    .isArray().withMessage('As tags devem ser um array.'),
  body('status')
    .optional()
    .isIn(Object.values(SimulatedExamStatus))
    .withMessage('Status inválido.')
];

// Validation rules for deleting a simulated exam
export const deleteSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.')
];

// Validation rules for getting user simulated exams
export const getUserSimulatedExams = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('status')
    .optional()
    .isIn(Object.values(SimulatedExamStatus))
    .withMessage('Status inválido.'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'questionCount', 'attempts', 'averageScore'])
    .withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem de classificação inválida. Use "asc" ou "desc".')
];

// Validation rules for getting public simulated exams
export const getPublicSimulatedExams = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('category')
    .optional()
    .isString().withMessage('A categoria deve ser uma string.'),
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('A dificuldade deve ser "easy", "medium" ou "hard".'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'questionCount', 'attempts', 'averageScore', 'averageRating'])
    .withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem de classificação inválida. Use "asc" ou "desc".'),
  query('search')
    .optional()
    .isString().withMessage('O termo de busca deve ser uma string.')
];

// Validation rules for starting a simulated exam
export const startSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.')
];

// Validation rules for submitting simulated exam answers
export const submitSimulatedExamAnswers = [
  param('attemptId')
    .isString().withMessage('ID da tentativa inválido.'),
  body('answers')
    .isArray().withMessage('As respostas devem ser um array.')
    .notEmpty().withMessage('As respostas não podem estar vazias.'),
  body('answers.*.questionId')
    .isString().withMessage('O ID da questão deve ser uma string.'),
  body('answers.*.answer')
    .isString().withMessage('A resposta deve ser uma string.'),
  body('addToErrorNotebook')
    .optional()
    .isBoolean().withMessage('O campo addToErrorNotebook deve ser um booleano.')
];

// Validation rules for getting a simulated exam attempt result
export const getSimulatedExamAttemptResult = [
  param('attemptId')
    .isString().withMessage('ID da tentativa inválido.')
];

// Validation rules for getting user simulated exam attempts
export const getUserSimulatedExamAttempts = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.'),
  query('simulatedExamId')
    .optional()
    .isString().withMessage('O ID do simulado deve ser uma string.'),
  query('completed')
    .optional()
    .isBoolean().withMessage('O campo completed deve ser um booleano.'),
  query('sortBy')
    .optional()
    .isIn(['startTime', 'endTime', 'score', 'timeSpent'])
    .withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordem de classificação inválida. Use "asc" ou "desc".')
];

// Validation rules for rating a simulated exam
export const rateSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.'),
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('A avaliação deve ser um número inteiro entre 1 e 5.'),
  body('comment')
    .optional()
    .isString().withMessage('O comentário deve ser uma string.')
    .isLength({ max: 500 }).withMessage('O comentário não pode exceder 500 caracteres.')
];

// Validation rules for getting user simulated exam statistics
export const getUserSimulatedExamStatistics = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('A data de início deve estar no formato ISO8601.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('A data de fim deve estar no formato ISO8601.')
];

// Validation rules for exporting a simulated exam to PDF
export const exportSimulatedExamToPdf = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.')
];

// Validation rules for adding questions to a simulated exam
export const addQuestionsToSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.'),
  body('questionIds')
    .isArray().withMessage('Os IDs das questões devem ser um array.')
    .notEmpty().withMessage('Os IDs das questões não podem estar vazios.'),
  body('questionIds.*')
    .isString().withMessage('Cada ID de questão deve ser uma string.')
];

// Validation rules for removing questions from a simulated exam
export const removeQuestionsFromSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.'),
  body('questionIds')
    .isArray().withMessage('Os IDs das questões devem ser um array.')
    .notEmpty().withMessage('Os IDs das questões não podem estar vazios.'),
  body('questionIds.*')
    .isString().withMessage('Cada ID de questão deve ser uma string.')
];

// Validation rules for duplicating a simulated exam
export const duplicateSimulatedExam = [
  param('examId')
    .isString().withMessage('ID do simulado inválido.')
];

// Export all validators
export default {
  createSimulatedExam,
  getSimulatedExamById,
  updateSimulatedExam,
  deleteSimulatedExam,
  getUserSimulatedExams,
  getPublicSimulatedExams,
  startSimulatedExam,
  submitSimulatedExamAnswers,
  getSimulatedExamAttemptResult,
  getUserSimulatedExamAttempts,
  rateSimulatedExam,
  getUserSimulatedExamStatistics,
  exportSimulatedExamToPdf,
  addQuestionsToSimulatedExam,
  removeQuestionsFromSimulatedExam,
  duplicateSimulatedExam
};