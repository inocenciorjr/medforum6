import { body, param, query } from 'express-validator';

// Validation rules for creating an achievement
export const createAchievement = [
  body('title')
    .trim()
    .notEmpty().withMessage('O título é obrigatório.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .trim()
    .notEmpty().withMessage('A descrição é obrigatória.')
    .isLength({ min: 10, max: 500 }).withMessage('A descrição deve ter entre 10 e 500 caracteres.'),
  body('icon')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('URL do ícone inválida.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('A categoria deve ter entre 2 e 50 caracteres.'),
  body('requiredPoints')
    .optional()
    .isInt({ min: 1 }).withMessage('Os pontos necessários devem ser um número inteiro positivo.'),
  body('isHidden')
    .optional()
    .isBoolean().withMessage('isHidden deve ser um valor booleano.'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('A ordem deve ser um número inteiro não negativo.'),
  body('criteria')
    .optional({ nullable: true })
    .isObject().withMessage('Os critérios devem ser um objeto.')
];

// Validation rules for updating an achievement
export const updateAchievement = [
  param('achievementId')
    .isString().withMessage('ID da conquista inválido.'),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('O título não pode ser vazio.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .trim()
    .notEmpty().withMessage('A descrição não pode ser vazia.')
    .isLength({ min: 10, max: 500 }).withMessage('A descrição deve ter entre 10 e 500 caracteres.'),
  body('icon')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('URL do ícone inválida.'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('A categoria deve ter entre 2 e 50 caracteres.'),
  body('requiredPoints')
    .optional()
    .isInt({ min: 1 }).withMessage('Os pontos necessários devem ser um número inteiro positivo.'),
  body('isHidden')
    .optional()
    .isBoolean().withMessage('isHidden deve ser um valor booleano.'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('A ordem deve ser um número inteiro não negativo.'),
  body('criteria')
    .optional({ nullable: true })
    .isObject().withMessage('Os critérios devem ser um objeto.')
];

// Validation rules for getting achievements
export const getAchievements = [
  query('category')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('A categoria deve ter entre 2 e 50 caracteres.'),
  query('includeHidden')
    .optional()
    .isBoolean().withMessage('includeHidden deve ser um valor booleano.')
];

// Validation rules for getting user achievements
export const getUserAchievements = [
  query('includeUnlocked')
    .optional()
    .isBoolean().withMessage('includeUnlocked deve ser um valor booleano.'),
  query('includeProgress')
    .optional()
    .isBoolean().withMessage('includeProgress deve ser um valor booleano.'),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('A categoria deve ter entre 2 e 50 caracteres.')
];

// Validation rules for assigning an achievement to a user
export const assignAchievementToUser = [
  param('userId')
    .isString().withMessage('ID do usuário inválido.'),
  param('achievementId')
    .isString().withMessage('ID da conquista inválido.')
];

// Validation rules for updating user achievement progress
export const updateUserAchievementProgress = [
  param('userId')
    .isString().withMessage('ID do usuário inválido.'),
  param('achievementId')
    .isString().withMessage('ID da conquista inválido.'),
  body('progress')
    .isInt({ min: 0 }).withMessage('O progresso deve ser um número inteiro não negativo.')
];

// Export all validators
export default {
  createAchievement,
  updateAchievement,
  getAchievements,
  getUserAchievements,
  assignAchievementToUser,
  updateUserAchievementProgress
};