import { body, param, query } from 'express-validator';

// Validation rules for getting all tags
export const getAllTags = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.'),
  query('scope')
    .optional()
    .isIn(['GLOBAL', 'USER', 'ALL']).withMessage('Escopo inválido. Use "GLOBAL", "USER" ou "ALL".')
];

// Validation rules for getting a tag by ID
export const getTagById = [
  param('tagId')
    .isString().withMessage('ID da tag inválido.')
];

// Validation rules for creating a tag
export const createTag = [
  body('name')
    .trim()
    .notEmpty().withMessage('O nome é obrigatório.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('scope')
    .optional()
    .isIn(['GLOBAL', 'USER']).withMessage('Escopo inválido. Use "GLOBAL" ou "USER".'),
  body('color')
    .optional()
    .isHexColor().withMessage('A cor deve ser um código hexadecimal válido.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string válida.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.')
];

// Validation rules for updating a tag
export const updateTag = [
  param('tagId')
    .isString().withMessage('ID da tag inválido.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('scope')
    .optional()
    .isIn(['GLOBAL', 'USER']).withMessage('Escopo inválido. Use "GLOBAL" ou "USER".'),
  body('color')
    .optional()
    .isHexColor().withMessage('A cor deve ser um código hexadecimal válido.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string válida.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for deleting a tag
export const deleteTag = [
  param('tagId')
    .isString().withMessage('ID da tag inválido.')
];

// Validation rules for getting popular tags
export const getPopularTags = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Validation rules for getting related tags
export const getRelatedTags = [
  param('tagId')
    .isString().withMessage('ID da tag inválido.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Validation rules for searching tags
export const searchTags = [
  query('query')
    .notEmpty().withMessage('O termo de pesquisa é obrigatório.')
    .isString().withMessage('O termo de pesquisa deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O termo de pesquisa deve ter entre 2 e 50 caracteres.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
];

// Export all validators
export default {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getPopularTags,
  getRelatedTags,
  searchTags
};