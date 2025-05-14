import { body, param, query } from 'express-validator';

// Validation rules for creating a flashcard
export const createFlashcard = [
  body('front')
    .trim()
    .notEmpty().withMessage('O conteúdo frontal é obrigatório.')
    .isLength({ max: 2000 }).withMessage('O conteúdo frontal não pode exceder 2000 caracteres.'),
  body('back')
    .trim()
    .notEmpty().withMessage('O conteúdo traseiro é obrigatório.')
    .isLength({ max: 2000 }).withMessage('O conteúdo traseiro não pode exceder 2000 caracteres.'),
  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags devem ser um array.')
    .custom((tags: string[]) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50))
    .withMessage('Cada tag deve ser uma string não vazia com no máximo 50 caracteres.'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.'),
  body('hint')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('A dica não pode exceder 500 caracteres.'),
  body('mediaUrls')
    .optional({ nullable: true })
    .isArray().withMessage('URLs de mídia devem ser um array.')
    .custom((urls: string[]) => urls.every(url => typeof url === 'string' && url.trim().length > 0))
    .withMessage('Cada URL de mídia deve ser uma string não vazia.'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('A ordem deve ser um número inteiro não negativo.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive deve ser um valor booleano.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A categoria não pode exceder 100 caracteres.'),
  body('subCategory')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A subcategoria não pode exceder 100 caracteres.')
];

// Validation rules for updating a flashcard
export const updateFlashcard = [
  param('flashcardId')
    .isString().withMessage('ID do flashcard inválido.'),
  body('front')
    .optional()
    .trim()
    .notEmpty().withMessage('O conteúdo frontal não pode ser vazio.')
    .isLength({ max: 2000 }).withMessage('O conteúdo frontal não pode exceder 2000 caracteres.'),
  body('back')
    .optional()
    .trim()
    .notEmpty().withMessage('O conteúdo traseiro não pode ser vazio.')
    .isLength({ max: 2000 }).withMessage('O conteúdo traseiro não pode exceder 2000 caracteres.'),
  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags devem ser um array.')
    .custom((tags: string[]) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50))
    .withMessage('Cada tag deve ser uma string não vazia com no máximo 50 caracteres.'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.'),
  body('hint')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('A dica não pode exceder 500 caracteres.'),
  body('mediaUrls')
    .optional({ nullable: true })
    .isArray().withMessage('URLs de mídia devem ser um array.')
    .custom((urls: string[]) => urls.every(url => typeof url === 'string' && url.trim().length > 0))
    .withMessage('Cada URL de mídia deve ser uma string não vazia.'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('A ordem deve ser um número inteiro não negativo.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive deve ser um valor booleano.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A categoria não pode exceder 100 caracteres.'),
  body('subCategory')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A subcategoria não pode exceder 100 caracteres.')
];

// Validation rules for recording a flashcard interaction
export const recordFlashcardInteraction = [
  param('flashcardId')
    .isString().withMessage('ID do flashcard inválido.'),
  body('difficulty')
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.'),
  body('timeSpentMs')
    .isInt({ min: 0 }).withMessage('O tempo gasto deve ser um número inteiro não negativo.'),
  body('isCorrect')
    .isBoolean().withMessage('isCorrect deve ser um valor booleano.')
];

// Validation rules for getting flashcards for review
export const getFlashcardsForReview = [
  param('deckId')
    .isString().withMessage('ID do deck inválido.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Export all validators
export default {
  createFlashcard,
  updateFlashcard,
  recordFlashcardInteraction,
  getFlashcardsForReview
};