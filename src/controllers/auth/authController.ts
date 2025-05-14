import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as userService from '../../services/firebaseUserService';
import { auth } from 'firebase-admin';
import { AppError } from '../../utils/errors';

/**
 * Controlador para operações relacionadas à autenticação
 *
 * Responsável por gerenciar login, registro, recuperação de senha,
 * verificação de email e outras operações de autenticação.
 */
class AuthController {
  /**
   * Registra um novo usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { email, password, name, role } = req.body;

      // Registrar usuário
      const userRecord = await userService.registerUserWithEmailAndPassword(
        email,
        password,
        name,
        role
      );

      res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        data: {
          id: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName
        }
      });
    } catch (error: any) {
      console.error('Erro ao registrar usuário:', error);
      
      // Tratar erros específicos do Firebase Auth
      if (error.code === 'auth/email-already-exists') {
        res.status(409).json({
          success: false,
          message: 'Email já está em uso'
        });
        return;
      }
      
      if (error.code === 'auth/invalid-email') {
        res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
        return;
      }
      
      if (error.code === 'auth/weak-password') {
        res.status(400).json({
          success: false,
          message: 'Senha muito fraca'
        });
        return;
      }
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao registrar usuário'
      });
    }
  }

  /**
   * Processa o login de um usuário verificando o token ID do Firebase
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { idToken } = req.body;

      if (!idToken) {
        res.status(400).json({
          success: false,
          message: 'Token ID não fornecido'
        });
        return;
      }

      // Verificar token e processar login
      const user = await userService.verifyIdTokenAndProcessLogin(idToken);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
        return;
      }

      // Filtrar dados sensíveis antes de retornar
      const safeUserData = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        profileImage: user.profileImage,
        lastLoginAt: user.lastLoginAt
      };

      res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso',
        data: safeUserData
      });
    } catch (error: any) {
      console.error('Erro ao processar login:', error);
      
      // Tratar erros específicos do Firebase Auth
      if (error.code === 'auth/id-token-expired') {
        res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
        return;
      }
      
      if (error.code === 'auth/invalid-id-token') {
        res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
        return;
      }
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao processar login'
      });
    }
  }

  /**
   * Envia um email de recuperação de senha
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { email } = req.body;

      // Enviar email de recuperação de senha
      await auth().generatePasswordResetLink(email);

      res.status(200).json({
        success: true,
        message: 'Email de recuperação de senha enviado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação de senha:', error);
      
      // Tratar erros específicos do Firebase Auth
      if (error.code === 'auth/user-not-found') {
        // Por segurança, não informamos ao cliente que o usuário não existe
        res.status(200).json({
          success: true,
          message: 'Se o email estiver registrado, um link de recuperação será enviado'
        });
        return;
      }
      
      if (error.code === 'auth/invalid-email') {
        res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
        return;
      }
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Erro ao enviar email de recuperação de senha'
      });
    }
  }

  /**
   * Envia um email de verificação para o usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async sendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      const userId = req.user.id;
      
      // Obter o usuário do Firebase Auth
      const userRecord = await auth().getUser(userId);
      
      // Verificar se o email já está verificado
      if (userRecord.emailVerified) {
        res.status(400).json({
          success: false,
          message: 'Email já verificado'
        });
        return;
      }
      
      // Gerar link de verificação de email
      await auth().generateEmailVerificationLink(userRecord.email || '');

      res.status(200).json({
        success: true,
        message: 'Email de verificação enviado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao enviar email de verificação:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao enviar email de verificação'
      });
    }
  }

  /**
   * Altera a senha do usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      const userId = req.user.id;
      const { newPassword } = req.body;

      // Atualizar senha
      await auth().updateUser(userId, {
        password: newPassword
      });

      res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      
      // Tratar erros específicos do Firebase Auth
      if (error.code === 'auth/weak-password') {
        res.status(400).json({
          success: false,
          message: 'Senha muito fraca'
        });
        return;
      }
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao alterar senha'
      });
    }
  }

  /**
   * Verifica o status da autenticação do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async checkAuthStatus(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        res.status(200).json({
          success: true,
          authenticated: false
        });
        return;
      }

      const userId = req.user.id;
      
      // Obter informações do usuário
      const user = await userService.getUser(userId);
      
      if (!user) {
        res.status(200).json({
          success: true,
          authenticated: false
        });
        return;
      }

      // Filtrar dados sensíveis antes de retornar
      const safeUserData = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        profileImage: user.profileImage
      };

      res.status(200).json({
        success: true,
        authenticated: true,
        data: safeUserData
      });
    } catch (error: any) {
      console.error('Erro ao verificar status de autenticação:', error);
      
      res.status(200).json({
        success: true,
        authenticated: false,
        message: 'Erro ao verificar status de autenticação'
      });
    }
  }

  /**
   * Realiza o logout do usuário (apenas no cliente)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // O logout é realizado no cliente, aqui apenas confirmamos
      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao processar logout:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao processar logout'
      });
    }
  }
}

export default new AuthController();