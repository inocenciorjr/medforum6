import { body } from 'express-validator';
import { UserRole } from '../types/firebaseTypes';

// Validation rules for user registration
export const register = [
  body('email')
    .trim()
    .notEmpty().withMessage('O email é obrigatório.')
    .isEmail().withMessage('Formato de email inválido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('A senha é obrigatória.')
    .isLength({ min: 8 }).withMessage('A senha deve ter pelo menos 8 caracteres.'),
  body('name')
    .trim()
    .notEmpty().withMessage('O nome é obrigatório.')
    .isLength({ min: 3, max: 255 }).withMessage('O nome deve ter entre 3 e 255 caracteres.'),
  body('role')
    .optional()
    .isIn(Object.values(UserRole)).withMessage('Papel de usuário inválido.')
];

// Validation rules for login
export const login = [
  body('idToken')
    .notEmpty().withMessage('O token ID é obrigatório.')
];

// Validation rules for forgot password
export const forgotPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('O email é obrigatório.')
    .isEmail().withMessage('Formato de email inválido.')
    .normalizeEmail()
];

// Validation rules for change password
export const changePassword = [
  body('newPassword')
    .notEmpty().withMessage('A nova senha é obrigatória.')
    .isLength({ min: 8 }).withMessage('A nova senha deve ter pelo menos 8 caracteres.')
];

// Export all validators
export default {
  register,
  login,
  forgotPassword,
  changePassword
};