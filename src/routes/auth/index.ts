import { Router } from 'express';
import authController from '../../controllers/auth/authController';
import { validate } from '../../middlewares/validation.middleware';
import authValidator from '../../validators/auth.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Registra um novo usuário
 * @access Public
 */
router.post('/register', validate(authValidator.register), authController.register);

/**
 * @route POST /api/auth/login
 * @desc Processa o login de um usuário verificando o token ID do Firebase
 * @access Public
 */
router.post('/login', validate(authValidator.login), authController.login);

/**
 * @route POST /api/auth/forgot-password
 * @desc Envia um email de recuperação de senha
 * @access Public
 */
router.post('/forgot-password', validate(authValidator.forgotPassword), authController.forgotPassword);

/**
 * @route POST /api/auth/verify-email
 * @desc Envia um email de verificação para o usuário
 * @access Private
 */
router.post('/verify-email', authenticate, authController.sendEmailVerification);

/**
 * @route POST /api/auth/change-password
 * @desc Altera a senha do usuário autenticado
 * @access Private
 */
router.post('/change-password', authenticate, validate(authValidator.changePassword), authController.changePassword);

/**
 * @route GET /api/auth/status
 * @desc Verifica o status da autenticação do usuário
 * @access Public (com autenticação opcional)
 */
router.get('/status', optionalAuthenticate, authController.checkAuthStatus);

/**
 * @route POST /api/auth/logout
 * @desc Realiza o logout do usuário (apenas no cliente)
 * @access Public
 */
router.post('/logout', authController.logout);

export default router;