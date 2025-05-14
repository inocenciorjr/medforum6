import { Request, Response, NextFunction } from 'express';
import { AppError, errorUtils } from '../utils/errors';

/**
 * Middleware para tratamento de erros
 * Captura erros não tratados, loga e retorna uma resposta padronizada
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // Logar o erro usando o utilitário centralizado
  errorUtils.logError(err, req);

  // Verificar se a resposta já foi enviada
  if (res.headersSent) {
    return next(err);
  }

  // Formatar a resposta de erro usando o utilitário centralizado
  const formattedError = errorUtils.formatErrorResponse(err);

  // Determinar o código de status
  const statusCode = (err as AppError).statusCode || 500;

  // Enviar resposta de erro formatada
  res.status(statusCode).json(formattedError);
};

/**
 * Middleware para lidar com rotas não encontradas
 * Cria um erro AppError.notFound e passa para o errorHandler
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  // Cria um erro 404 padronizado
  const err = AppError.notFound(`Rota não encontrada: ${req.originalUrl}`);
  // Passa o erro para o próximo middleware (errorHandler)
  next(err);
};