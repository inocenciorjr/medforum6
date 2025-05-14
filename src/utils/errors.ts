import { Request, Response, NextFunction } from 'express';

/**
 * Classe para erros padronizados da aplicação
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, errorCode?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Erros operacionais são esperados e podem ser tratados
    this.errorCode = errorCode;
    this.details = details;
    
    // Capturar stack trace
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Criar um erro de validação (400 Bad Request)
   */
  static badRequest(message: string, details?: any): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  /**
   * Criar um erro de autenticação (401 Unauthorized)
   */
  static unauthorized(message: string = 'Não autorizado'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Criar um erro de permissão (403 Forbidden)
   */
  static forbidden(message: string = 'Acesso negado'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  /**
   * Criar um erro de recurso não encontrado (404 Not Found)
   */
  static notFound(message: string = 'Recurso não encontrado'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  /**
   * Criar um erro de conflito (409 Conflict)
   */
  static conflict(message: string, details?: any): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  /**
   * Criar um erro de limite excedido (429 Too Many Requests)
   */
  static tooManyRequests(message: string = 'Limite de requisições excedido'): AppError {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  /**
   * Criar um erro interno do servidor (500 Internal Server Error)
   */
  static internal(message: string = 'Erro interno do servidor'): AppError {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

/**
 * Utilitário para envolver rotas assíncronas e capturar erros.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};


/**
 * Utilitários para tratamento de erros (mantido para compatibilidade se usado em outro lugar)
 */
export const errorUtils = {
  /**
   * Logar um erro
   */
  logError: (error: Error, req: Request): void => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user && typeof req.user === 'object' ? (req.user as any).id : undefined,
      timestamp: new Date().toISOString()
    };

    // Verificar se é um erro operacional (esperado)
    const isOperational = error instanceof AppError && error.isOperational;

    if (isOperational) {
      // Erros operacionais são esperados e podem ser tratados
      console.warn('Erro operacional:', errorInfo);
    } else {
      // Erros não operacionais são bugs e devem ser corrigidos
      console.error('Erro não operacional:', errorInfo);
    }
  },

  /**
   * Formatar resposta de erro
   */
  formatErrorResponse: (error: Error): any => {
    // Verificar se é um erro da aplicação
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.errorCode,
          details: error.details
        }
      };
    }

    // Erro genérico
    return {
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production' 
          ? 'Ocorreu um erro interno. Por favor, tente novamente mais tarde.' 
          : error.message,
        code: 'INTERNAL_ERROR'
      }
    };
  }
};
