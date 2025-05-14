import { body, param, query } from 'express-validator';

// Validation rules for starting a study session
export const startStudySession = [
  body('deckId')
    .isString().withMessage('ID do deck inválido.')
];

// Validation rules for ending a study session
export const endStudySession = [
  body('sessionId')
    .isString().withMessage('ID da sessão inválido.'),
  body('results')
    .isObject().withMessage('Resultados da sessão inválidos.'),
  body('results.flashcardsStudied')
    .isInt({ min: 0 }).withMessage('O número de flashcards estudados deve ser um número inteiro não negativo.'),
  body('results.correctAnswers')
    .isInt({ min: 0 }).withMessage('O número de respostas corretas deve ser um número inteiro não negativo.'),
  body('results.incorrectAnswers')
    .isInt({ min: 0 }).withMessage('O número de respostas incorretas deve ser um número inteiro não negativo.'),
  body('results.filterStats')
    .optional()
    .isArray().withMessage('As estatísticas por filtro devem ser um array.')
];

// Validation rules for getting a study session by ID
export const getStudySessionById = [
  param('sessionId')
    .isString().withMessage('ID da sessão inválido.')
];

// Validation rules for getting user study sessions
export const getUserStudySessions = [
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

// Validation rules for getting deck study sessions
export const getDeckStudySessions = [
  param('deckId')
    .isString().withMessage('ID do deck inválido.'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Validation rules for getting study session analysis
export const getStudySessionAnalysis = [
  param('sessionId')
    .isString().withMessage('ID da sessão inválido.')
];

// Validation rules for adding a flashcard interaction
export const addFlashcardInteraction = [
  param('sessionId')
    .isString().withMessage('ID da sessão inválido.'),
  body('flashcardId')
    .isString().withMessage('ID do flashcard inválido.'),
  body('isCorrect')
    .isBoolean().withMessage('O campo isCorrect deve ser um booleano.'),
  body('difficulty')
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.'),
  body('timeSpentMs')
    .isInt({ min: 0 }).withMessage('O tempo gasto deve ser um número inteiro não negativo.')
];

// Export all validators
export default {
  startStudySession,
  endStudySession,
  getStudySessionById,
  getUserStudySessions,
  getDeckStudySessions,
  getStudySessionAnalysis,
  addFlashcardInteraction
};