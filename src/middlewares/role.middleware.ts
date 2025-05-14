import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/firebaseTypes';

/**
 * Middleware para verificar se o usuário tem o papel necessário
 * @param roles Array de papéis permitidos (ex: ['ADMIN', 'MENTOR'])
 */
export const checkRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Verificar se o usuário está autenticado (req.user deve existir)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Verificar se o papel do usuário está na lista de papéis permitidos
      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado. Você não tem permissão para acessar este recurso.'
        });
        return;
      }

      next();
    } catch (error) {
      // Logar o erro
      console.error("Erro ao verificar permissões em checkRole", { 
        error, 
        userId: req.user?.id, 
        roles 
      });
      
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
};

/**
 * Middleware para verificar se o usuário é administrador
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
      return;
    }
    
    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas administradores podem acessar este recurso.' 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error("Erro ao verificar permissões em isAdmin", { 
      error, 
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar permissões' 
    });
  }
};

/**
 * Middleware para verificar se o usuário é mentor
 */
export const isMentor = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
      return;
    }
    
    if (req.user.role !== UserRole.MENTOR) {
      res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas mentores podem acessar este recurso.' 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error("Erro ao verificar permissões em isMentor", { 
      error, 
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar permissões' 
    });
  }
};

/**
 * Middleware para verificar se o usuário é estudante
 */
export const isStudent = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
      return;
    }
    
    if (req.user.role !== UserRole.STUDENT) {
      res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas estudantes podem acessar este recurso.' 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error("Erro ao verificar permissões em isStudent", { 
      error, 
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar permissões' 
    });
  }
};

/**
 * Middleware para verificar se o usuário é administrador ou mentor
 */
export const isAdminOrMentor = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
      return;
    }
    
    if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.MENTOR) {
      res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas administradores e mentores podem acessar este recurso.' 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error("Erro ao verificar permissões em isAdminOrMentor", { 
      error, 
      userId: req.user?.id 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar permissões' 
    });
  }
};

/**
 * Middleware para verificar se o usuário é o proprietário do recurso
 * @param getResourceOwnerId Função assíncrona que recebe a requisição e retorna o ID do proprietário do recurso
 */
export const isResourceOwner = (getResourceOwnerId: (req: Request) => Promise<string | undefined>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ 
          success: false, 
          message: 'Usuário não autenticado' 
        });
        return;
      }

      // Obter o ID do proprietário do recurso usando a função fornecida
      const resourceOwnerId = await getResourceOwnerId(req);

      // Verificar se o ID do proprietário foi obtido
      if (resourceOwnerId === undefined) {
         res.status(404).json({ 
           success: false, 
           message: 'Recurso ou proprietário não encontrado para verificação.' 
         });
         return;
      }

      // Verificar se o usuário é o proprietário do recurso
      if (req.user.id !== resourceOwnerId) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado. Você não tem permissão para acessar este recurso.'
        });
        return;
      }

      next();
    } catch (error) {
      // Logar o erro
      console.error("Erro ao verificar propriedade do recurso em isResourceOwner", { 
        error, 
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar propriedade do recurso'
      });
    }
  };
};

/**
 * Middleware para verificar se o usuário é o proprietário do recurso ou um administrador
 * @param getResourceOwnerId Função assíncrona que recebe a requisição e retorna o ID do proprietário do recurso
 */
export const isResourceOwnerOrAdmin = (getResourceOwnerId: (req: Request) => Promise<string | undefined>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ 
          success: false, 
          message: 'Usuário não autenticado' 
        });
        return;
      }

      // Se o usuário é administrador, permitir acesso
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      // Obter o ID do proprietário do recurso usando a função fornecida
      const resourceOwnerId = await getResourceOwnerId(req);

      // Verificar se o ID do proprietário foi obtido
      if (resourceOwnerId === undefined) {
         res.status(404).json({ 
           success: false, 
           message: 'Recurso ou proprietário não encontrado para verificação.' 
         });
         return;
      }

      // Verificar se o usuário é o proprietário do recurso
      if (req.user.id !== resourceOwnerId) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado. Você não tem permissão para acessar este recurso.'
        });
        return;
      }

      next();
    } catch (error) {
      // Logar o erro
      console.error("Erro ao verificar propriedade do recurso em isResourceOwnerOrAdmin", { 
        error, 
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar propriedade do recurso'
      });
    }
  };
};

export default {
  checkRole,
  isAdmin,
  isMentor,
  isStudent,
  isAdminOrMentor,
  isResourceOwner,
  isResourceOwnerOrAdmin
};