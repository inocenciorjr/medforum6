import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

// Chave secreta para assinatura de tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'medforum-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Gera um token JWT para o usuário
 * @param userId ID do usuário
 * @param role Papel do usuário (USER, ADMIN, etc.)
 * @returns Token JWT assinado
 */
export const generateAuthToken = (userId: string, role: string): string => {
  return jwt.sign(
    { 
      id: userId, 
      role 
    },
    JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Verifica e decodifica um token JWT
 * @param token Token JWT a ser verificado
 * @returns Payload decodificado ou null se inválido
 */
export const verifyAuthToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET as string);
  } catch (error) {
    return null;
  }
};

/**
 * Extrai o token de autorização do cabeçalho da requisição
 * @param req Objeto de requisição Express
 * @returns Token extraído ou null se não encontrado
 */
export const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.split(' ')[1];
};

/**
 * Middleware para verificar se o usuário está autenticado
 * @param req Objeto de requisição Express
 * @param res Objeto de resposta Express
 * @param next Função next do Express
 */
export const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      throw AppError.unauthorized('Token de autenticação não fornecido');
    }
    
    const decoded = verifyAuthToken(token);
    
    if (!decoded) {
      throw AppError.unauthorized('Token de autenticação inválido ou expirado');
    }
    
    // Adiciona o usuário decodificado à requisição
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Falha na autenticação'
      });
    }
  }
};

/**
 * Middleware para verificar se o usuário tem um papel específico
 * @param role Papel requerido
 * @returns Middleware Express
 */
export const authorizeRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Usuário não autenticado');
      }
      
      if (req.user.role !== role) {
        throw AppError.forbidden('Acesso negado. Você não tem permissão para acessar este recurso.');
      }
      
      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }
    }
  };
};