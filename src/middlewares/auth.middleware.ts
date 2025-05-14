import { Request, Response, NextFunction } from 'express';
import { auth } from 'firebase-admin';
import { getUser } from '../services/firebaseUserService';
import { UserRole } from '../types/firebaseTypes';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Middleware para verificar se o usuário está autenticado
 * Verifica o token Firebase no header Authorization
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido'
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
      return;
    }

    const token = parts[1];

    // Verificar o token com o Firebase Auth
    const decodedToken = await auth().verifyIdToken(token);
    
    // Buscar o usuário no Firestore para verificar se está ativo
    const user = await getUser(decodedToken.uid);
    
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
      return;
    }

    // Anexar o objeto de usuário simplificado à requisição
    req.user = {
      id: user.id,
      role: user.role
    };

    next();
  } catch (error: unknown) {
    console.error('Erro na autenticação:', error);
    
    if (error instanceof Error) {
      // Verificar tipos específicos de erros do Firebase Auth
      if (error.message.includes('auth/id-token-expired')) {
        res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
        return;
      }
      
      if (error.message.includes('auth/invalid-id-token')) {
        res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno ao autenticar usuário'
    });
  }
};

/**
 * Middleware para verificar se o usuário está autenticado, mas não bloqueia se não estiver
 * Útil para rotas que podem ser acessadas por usuários autenticados e não autenticados
 */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      next();
      return;
    }

    const token = parts[1];

    // Verificar o token com o Firebase Auth
    const decodedToken = await auth().verifyIdToken(token);
    
    // Buscar o usuário no Firestore para verificar se está ativo
    const user = await getUser(decodedToken.uid);
    
    if (user && user.isActive) {
      // Anexar o objeto de usuário simplificado à requisição
      req.user = {
        id: user.id,
        role: user.role
      };
    }

    next();
  } catch (error: unknown) {
    // Logar o erro, mas não bloquear a requisição
    console.warn('Erro na autenticação opcional:', error);
    next();
  }
};