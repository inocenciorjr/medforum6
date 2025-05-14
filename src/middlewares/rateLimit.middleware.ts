import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { 
  checkRateLimit, 
  logRateLimitViolation 
} from '../services/firebaseRateLimitService';

// Configuração do limitador de taxa para requisições gerais
export const generalLimiter = new RateLimiterMemory({
  points: 100, // Número de requisições permitidas
  duration: 15 * 60, // Por período (em segundos) - 15 minutos
});

// Configuração do limitador de taxa para autenticação (mais restritivo)
export const authLimiter = new RateLimiterMemory({
  points: 5, // Número de tentativas permitidas
  duration: 60, // Por período (em segundos)
  blockDuration: 300, // Tempo de bloqueio após exceder o limite (em segundos)
});

// Configuração do limitador de taxa para API (específico para endpoints sensíveis)
export const apiLimiter = new RateLimiterMemory({
  points: 30, // Número de requisições permitidas
  duration: 60, // Por período (em segundos)
});

/**
 * Middleware para limitação de taxa geral
 * Limita o número de requisições por IP
 */
export const generalRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Usar o IP como identificador, fornecer fallback se undefined
    const key = req.ip || 'unknown_ip';
    
    // Verificar limite no Firebase primeiro (para bloqueios persistentes)
    const isBlocked = await checkRateLimit({
      key,
      type: 'ip',
      endpoint: req.originalUrl
    });
    
    if (isBlocked) {
      res.status(429).json({
        success: false,
        message: 'Muitas requisições. Por favor, tente novamente mais tarde.'
      });
      return;
    }
    
    // Verificar limite em memória
    await generalLimiter.consume(key);
    next();
  } catch (error: unknown) {
    // Registrar violação no Firebase
    try {
      await logRateLimitViolation({
        key: req.ip || 'unknown_ip',
        type: 'ip',
        endpoint: req.originalUrl,
        userId: req.user?.id
      });
    } catch (logError) {
      console.error('Erro ao registrar violação de rate limit:', logError);
    }
    
    res.status(429).json({
      success: false,
      message: 'Muitas requisições. Por favor, tente novamente mais tarde.'
    });
  }
};

/**
 * Middleware para limitação de taxa em rotas de autenticação
 * Mais restritivo para prevenir ataques de força bruta
 */
export const authRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Usar o IP como identificador, fornecer fallback se undefined
    const key = req.ip || 'unknown_ip';
    
    // Verificar limite no Firebase primeiro (para bloqueios persistentes)
    const isBlocked = await checkRateLimit({
      key,
      type: 'ip',
      endpoint: 'auth'
    });
    
    if (isBlocked) {
      res.status(429).json({
        success: false,
        message: 'Muitas tentativas de autenticação. Por favor, tente novamente mais tarde.'
      });
      return;
    }
    
    // Verificar limite em memória
    await authLimiter.consume(key);
    next();
  } catch (error: unknown) {
    // Registrar violação no Firebase
    try {
      await logRateLimitViolation({
        key: req.ip || 'unknown_ip',
        type: 'ip',
        endpoint: 'auth',
        userId: req.user?.id
      });
    } catch (logError) {
      console.error('Erro ao registrar violação de rate limit em autenticação:', logError);
    }
    
    res.status(429).json({
      success: false,
      message: 'Muitas tentativas de autenticação. Por favor, tente novamente mais tarde.'
    });
  }
};

/**
 * Middleware para limitação de taxa em rotas de API
 * Específico para endpoints sensíveis
 */
export const apiRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Usar o IP ou ID do usuário como identificador
    const userId = req.user?.id;
    const key = userId || req.ip || 'unknown_key';
    
    // Verificar limite no Firebase primeiro (para bloqueios persistentes)
    const isBlocked = await checkRateLimit({
      key,
      type: userId ? 'user' : 'ip',
      endpoint: req.originalUrl
    });
    
    if (isBlocked) {
      res.status(429).json({
        success: false,
        message: 'Limite de requisições excedido. Por favor, tente novamente mais tarde.'
      });
      return;
    }
    
    // Verificar limite em memória
    await apiLimiter.consume(key);
    next();
  } catch (error: unknown) {
    // Registrar violação no Firebase
    try {
      const userId = req.user?.id;
      await logRateLimitViolation({
        key: userId || req.ip || 'unknown_key',
        type: userId ? 'user' : 'ip',
        endpoint: req.originalUrl,
        userId
      });
    } catch (logError) {
      console.error('Erro ao registrar violação de rate limit em API:', logError);
    }
    
    res.status(429).json({
      success: false,
      message: 'Limite de requisições excedido. Por favor, tente novamente mais tarde.'
    });
  }
};

/**
 * Factory para criar limitadores de taxa personalizados
 * @param name Nome do limitador para identificação
 * @param points Número de requisições permitidas
 * @param duration Período em segundos
 * @param blockDuration Tempo de bloqueio após exceder o limite (em segundos)
 */
export const rateLimit = (name: string, points: number, duration: number, blockDuration?: number) => {
  const limiter = new RateLimiterMemory({
    points,
    duration,
    blockDuration
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Usar o IP ou ID do usuário como identificador
      const userId = req.user?.id;
      const key = `${name}:${userId || req.ip || 'unknown_key'}`;
      
      // Verificar limite no Firebase primeiro (para bloqueios persistentes)
      const isBlocked = await checkRateLimit({
        key,
        type: userId ? 'user' : 'ip',
        endpoint: name
      });
      
      if (isBlocked) {
        res.status(429).json({
          success: false,
          message: 'Limite de requisições excedido. Por favor, tente novamente mais tarde.'
        });
        return;
      }
      
      // Verificar limite em memória
      await limiter.consume(key);
      next();
    } catch (error: unknown) {
      // Registrar violação no Firebase
      try {
        const userId = req.user?.id;
        await logRateLimitViolation({
          key: `${name}:${userId || req.ip || 'unknown_key'}`,
          type: userId ? 'user' : 'ip',
          endpoint: name,
          userId
        });
      } catch (logError) {
        console.error(`Erro ao registrar violação de rate limit em ${name}:`, logError);
      }
      
      res.status(429).json({
        success: false,
        message: 'Limite de requisições excedido. Por favor, tente novamente mais tarde.'
      });
    }
  };
};