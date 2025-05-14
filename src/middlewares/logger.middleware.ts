import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import { firebaseLogService } from '../services/firebaseLogService';

// Configuração do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Usar caminhos absolutos para logs
    new winston.transports.File({ 
      filename: path.resolve(__dirname, '..', '..', 'logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.resolve(__dirname, '..', '..', 'logs/combined.log') 
    })
  ]
});

/**
 * Middleware para logging de requisições
 * Registra informações sobre cada requisição recebida
 */
export const requestLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const start = Date.now();
  
  // Registrar início da requisição
  logger.info(`Requisição recebida: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  });

  // Também registrar no Firebase se o usuário estiver autenticado
  if (req.user?.id) {
    try {
      await firebaseLogService.createLog({
        type: 'REQUEST',
        userId: req.user.id,
        action: `${req.method} ${req.originalUrl}`,
        details: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        },
        timestamp: new Date()
      });
    } catch (error) {
      // Não bloquear a requisição se o log falhar
      console.error('Erro ao registrar log no Firebase:', error);
    }
  }

  // Capturar quando a resposta for enviada
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    // Registrar resposta no Winston
    logger[level](`Resposta enviada: ${res.statusCode} ${req.method} ${req.originalUrl} (${duration}ms)`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id
    });

    // Registrar resposta no Firebase se for um erro e o usuário estiver autenticado
    if (res.statusCode >= 400 && req.user?.id) {
      try {
        await firebaseLogService.createLog({
          type: 'ERROR_RESPONSE',
          userId: req.user.id,
          action: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
          details: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            ip: req.ip
          },
          timestamp: new Date()
        });
      } catch (error) {
        // Não bloquear a resposta se o log falhar
        console.error('Erro ao registrar log de erro no Firebase:', error);
      }
    }
  });

  next();
};

// Exporta a instância do logger para ser usada em outras partes da aplicação
export { logger };