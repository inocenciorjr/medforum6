import { body, param, query } from 'express-validator';

// Validation rules for creating a filter
export const createFilter = [
  body('name')
    .notEmpty().withMessage('O nome é obrigatório.')
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.'),
  body('color')
    .optional()
    .isString().withMessage('A cor deve ser uma string.')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('A cor deve estar no formato hexadecimal (ex: #FF0000).'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for getting all filters
export const getAllFilters = [
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.')
];

// Validation rules for getting a filter by ID
export const getFilterById = [
  param('filterId')
    .isString().withMessage('ID do filtro inválido.')
];

// Validation rules for updating a filter
export const updateFilter = [
  param('filterId')
    .isString().withMessage('ID do filtro inválido.'),
  body('name')
    .optional()
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.'),
  body('color')
    .optional()
    .isString().withMessage('A cor deve ser uma string.')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('A cor deve estar no formato hexadecimal (ex: #FF0000).'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for deleting a filter
export const deleteFilter = [
  param('filterId')
    .isString().withMessage('ID do filtro inválido.')
];

// Validation rules for creating a subfilter
export const createSubFilter = [
  param('filterId')
    .isString().withMessage('ID do filtro inválido.'),
  body('name')
    .notEmpty().withMessage('O nome é obrigatório.')
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.'),
  body('color')
    .optional()
    .isString().withMessage('A cor deve ser uma string.')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('A cor deve estar no formato hexadecimal (ex: #FF0000).'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for getting subfilters by filter ID
export const getSubFiltersByFilterId = [
  param('filterId')
    .isString().withMessage('ID do filtro inválido.'),
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.')
];

// Validation rules for getting a subfilter by ID
export const getSubFilterById = [
  param('subFilterId')
    .isString().withMessage('ID do subfiltro inválido.')
];

// Validation rules for updating a subfilter
export const updateSubFilter = [
  param('subFilterId')
    .isString().withMessage('ID do subfiltro inválido.'),
  body('name')
    .optional()
    .isString().withMessage('O nome deve ser uma string.')
    .isLength({ min: 2, max: 50 }).withMessage('O nome deve ter entre 2 e 50 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.'),
  body('icon')
    .optional()
    .isString().withMessage('O ícone deve ser uma string.')
    .isLength({ max: 50 }).withMessage('O ícone não pode exceder 50 caracteres.'),
  body('color')
    .optional()
    .isString().withMessage('A cor deve ser uma string.')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('A cor deve estar no formato hexadecimal (ex: #FF0000).'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for deleting a subfilter
export const deleteSubFilter = [
  param('subFilterId')
    .isString().withMessage('ID do subfiltro inválido.')
];

// Export all validators
export default {
  createFilter,
  getAllFilters,
  getFilterById,
  updateFilter,
  deleteFilter,
  createSubFilter,
  getSubFiltersByFilterId,
  getSubFilterById,
  updateSubFilter,
  deleteSubFilter
};