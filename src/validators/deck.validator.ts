import { body, param, query } from 'express-validator';

// Validation rules for creating a deck
export const createDeck = [
  body('title')
    .trim()
    .notEmpty().withMessage('O título é obrigatório.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A categoria não pode exceder 100 caracteres.'),
  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags devem ser um array.')
    .custom((tags: string[]) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50))
    .withMessage('Cada tag deve ser uma string não vazia com no máximo 50 caracteres.'),
  body('isPrivate')
    .optional()
    .isBoolean().withMessage('isPrivate deve ser um valor booleano.'),
  body('coverImage')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('URL da imagem de capa inválida.'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.')
];

// Validation rules for updating a deck
export const updateDeck = [
  param('deckId')
    .isString().withMessage('ID do deck inválido.'),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('O título não pode ser vazio.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('A categoria não pode exceder 100 caracteres.'),
  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags devem ser um array.')
    .custom((tags: string[]) => tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 50))
    .withMessage('Cada tag deve ser uma string não vazia com no máximo 50 caracteres.'),
  body('isPrivate')
    .optional()
    .isBoolean().withMessage('isPrivate deve ser um valor booleano.'),
  body('coverImage')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('URL da imagem de capa inválida.'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('A dificuldade deve ser um número inteiro entre 1 e 5.')
];

// Validation rules for getting decks
export const getDecks = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.'),
  query('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('A categoria não pode exceder 100 caracteres.'),
  query('tag')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('A tag não pode exceder 50 caracteres.'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('O termo de busca não pode exceder 100 caracteres.'),
  query('sortBy')
    .optional()
    .isIn(['title', 'createdAt', 'updatedAt', 'difficulty']).withMessage('Campo de ordenação inválido.'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Ordem de classificação inválida.'),
  query('includePrivate')
    .optional()
    .isBoolean().withMessage('includePrivate deve ser um valor booleano.')
];

// Validation rules for duplicating a deck
export const duplicateDeck = [
  param('deckId')
    .isString().withMessage('ID do deck inválido.'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('isPrivate')
    .optional()
    .isBoolean().withMessage('isPrivate deve ser um valor booleano.')
];

// Export all validators
export default {
  createDeck,
  updateDeck,
  getDecks,
  duplicateDeck
};