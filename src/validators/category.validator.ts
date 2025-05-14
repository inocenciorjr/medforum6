import { body, param, query } from 'express-validator';

// Validation rules for creating a category
export const createCategory = [
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
  body('parentId')
    .optional()
    .isString().withMessage('O ID da categoria pai deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for getting all categories
export const getAllCategories = [
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.'),
  query('hierarchical')
    .optional()
    .isBoolean().withMessage('O campo hierarchical deve ser um booleano.')
];

// Validation rules for getting a category by ID
export const getCategoryById = [
  param('categoryId')
    .isString().withMessage('ID da categoria inválido.')
];

// Validation rules for updating a category
export const updateCategory = [
  param('categoryId')
    .isString().withMessage('ID da categoria inválido.'),
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
  body('parentId')
    .optional()
    .isString().withMessage('O ID da categoria pai deve ser uma string.'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('O campo isActive deve ser um booleano.')
];

// Validation rules for deleting a category
export const deleteCategory = [
  param('categoryId')
    .isString().withMessage('ID da categoria inválido.')
];

// Validation rules for getting subcategories
export const getSubcategories = [
  param('categoryId')
    .isString().withMessage('ID da categoria inválido.'),
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.')
];

// Validation rules for getting root categories
export const getRootCategories = [
  query('includeInactive')
    .optional()
    .isBoolean().withMessage('O campo includeInactive deve ser um booleano.')
];

// Validation rules for getting category path
export const getCategoryPath = [
  param('categoryId')
    .isString().withMessage('ID da categoria inválido.')
];

// Export all validators
export default {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getSubcategories,
  getRootCategories,
  getCategoryPath
};