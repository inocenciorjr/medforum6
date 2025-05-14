import { query } from 'express-validator';

// Validação para busca global
export const searchGlobal = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt(),
  
  query('types')
    .optional()
    .isString().withMessage('Tipos devem ser uma string separada por vírgulas')
];

// Validação para busca específica de usuários
export const searchUsers = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt()
];

// Validação para busca específica de decks
export const searchDecks = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt(),
  
  query('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic deve ser um booleano')
    .toBoolean()
];

// Validação para busca específica de artigos
export const searchArticles = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt(),
  
  query('categoryId')
    .optional()
    .isString().withMessage('ID da categoria deve ser uma string')
];

// Validação para busca específica de questões
export const searchQuestions = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt(),
  
  query('difficulty')
    .optional()
    .isString().withMessage('Dificuldade deve ser uma string'),
  
  query('filterId')
    .optional()
    .isString().withMessage('ID do filtro deve ser uma string')
];

// Validação para busca específica de mentorias
export const searchMentorships = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt(),
  
  query('status')
    .optional()
    .isString().withMessage('Status deve ser uma string válida')
];

// Validação para obter sugestões de busca
export const getSearchSuggestions = [
  query('query')
    .notEmpty().withMessage('Termo de busca é obrigatório')
    .isString().withMessage('Termo de busca deve ser uma string')
    .isLength({ min: 2 }).withMessage('Termo de busca deve ter pelo menos 2 caracteres'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Limite deve ser um número inteiro entre 1 e 20')
    .toInt()
];

// Validação para obter buscas populares
export const getPopularSearches = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limite deve ser um número inteiro entre 1 e 50')
    .toInt()
];

export default {
  searchGlobal,
  searchUsers,
  searchDecks,
  searchArticles,
  searchQuestions,
  searchMentorships,
  getSearchSuggestions,
  getPopularSearches
};