import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as planService from '../../services/firebasePlanService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a planos de assinatura
 *
 * Responsável por gerenciar planos de assinatura disponíveis para usuários
 */
class PlanController {
  /**
   * Verifica se o usuário está autenticado
   *
   * @private
   * @param {Request} req - Objeto de requisição
   * @returns {string} - ID do usuário autenticado
   * @throws {AppError} - Se o usuário não estiver autenticado
   */
  private getAuthenticatedUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }
    return userId;
  }

  /**
   * Cria um novo plano (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createPlan(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { 
        name, 
        description, 
        price, 
        currency, 
        interval, 
        intervalCount, 
        trialPeriodDays,
        features,
        isActive,
        stripePriceId,
        metadata
      } = req.body;
      
      // Verificar se já existe um plano com o mesmo nome
      const existingPlan = await planService.getPlanByName(name);
      if (existingPlan) {
        throw new AppError('Já existe um plano com este nome', 409);
      }
      
      const planData = {
        name,
        description: description || '',
        price,
        currency: currency || 'BRL',
        interval,
        intervalCount: intervalCount || 1,
        trialPeriodDays: trialPeriodDays || 0,
        features: features || [],
        isActive: isActive !== false,
        stripePriceId: stripePriceId || null,
        metadata: metadata || {},
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const plan = await planService.createPlan(planData);
      
      res.status(201).json({
        success: true,
        message: 'Plano criado com sucesso',
        data: plan
      });
    } catch (error: any) {
      console.error('Erro ao criar plano:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar plano'
      });
    }
  }

  /**
   * Obtém todos os planos
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllPlans(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      
      const plans = await planService.getAllPlans(includeInactive);
      
      res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error: any) {
      console.error('Erro ao obter planos:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter planos'
      });
    }
  }

  /**
   * Obtém um plano pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getPlanById(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      
      const plan = await planService.getPlanById(planId);
      
      if (!plan) {
        throw new AppError('Plano não encontrado', 404);
      }
      
      // Se o plano estiver inativo e o usuário não for admin, não permitir acesso
      if (!plan.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Plano não encontrado', 404);
      }
      
      res.status(200).json({
        success: true,
        data: plan
      });
    } catch (error: any) {
      console.error(`Erro ao obter plano ID ${req.params.planId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter plano'
      });
    }
  }

  /**
   * Atualiza um plano (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updatePlan(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { planId } = req.params;
      const { 
        name, 
        description, 
        price, 
        currency, 
        interval, 
        intervalCount, 
        trialPeriodDays,
        features,
        isActive,
        stripePriceId,
        metadata
      } = req.body;
      
      // Verificar se o plano existe
      const existingPlan = await planService.getPlanById(planId);
      if (!existingPlan) {
        throw new AppError('Plano não encontrado', 404);
      }
      
      // Verificar se já existe outro plano com o mesmo nome
      if (name && name !== existingPlan.name) {
        const planWithSameName = await planService.getPlanByName(name);
        if (planWithSameName && planWithSameName.id !== planId) {
          throw new AppError('Já existe um plano com este nome', 409);
        }
      }
      
      const planData = {
        name,
        description,
        price,
        currency,
        interval,
        intervalCount,
        trialPeriodDays,
        features,
        isActive,
        stripePriceId,
        metadata,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };
      
      const updatedPlan = await planService.updatePlan(planId, planData);
      
      res.status(200).json({
        success: true,
        message: 'Plano atualizado com sucesso',
        data: updatedPlan
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar plano ID ${req.params.planId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar plano'
      });
    }
  }

  /**
   * Exclui um plano (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deletePlan(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { planId } = req.params;
      
      // Verificar se o plano existe
      const existingPlan = await planService.getPlanById(planId);
      if (!existingPlan) {
        throw new AppError('Plano não encontrado', 404);
      }
      
      // Verificar se o plano está sendo usado por algum usuário
      const isPlanInUse = await planService.isPlanInUse(planId);
      if (isPlanInUse) {
        throw new AppError('Não é possível excluir um plano que está sendo usado por usuários', 400);
      }
      
      await planService.deletePlan(planId);
      
      res.status(200).json({
        success: true,
        message: 'Plano excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir plano ID ${req.params.planId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir plano'
      });
    }
  }

  /**
   * Ativa ou desativa um plano (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async togglePlanStatus(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { planId } = req.params;
      const { isActive } = req.body;
      
      // Verificar se o plano existe
      const existingPlan = await planService.getPlanById(planId);
      if (!existingPlan) {
        throw new AppError('Plano não encontrado', 404);
      }
      
      // Se estiver tentando desativar, verificar se o plano está sendo usado
      if (isActive === false) {
        const isPlanInUse = await planService.isPlanInUse(planId);
        if (isPlanInUse) {
          throw new AppError('Não é possível desativar um plano que está sendo usado por usuários', 400);
        }
      }
      
      const updatedPlan = await planService.updatePlan(planId, {
        isActive,
        updatedAt: new Date(),
        updatedBy: req.user.id
      });
      
      res.status(200).json({
        success: true,
        message: `Plano ${isActive ? 'ativado' : 'desativado'} com sucesso`,
        data: updatedPlan
      });
    } catch (error: any) {
      console.error(`Erro ao alterar status do plano ID ${req.params.planId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao alterar status do plano'
      });
    }
  }

  /**
   * Obtém o número de usuários por plano (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserCountByPlan(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const userCounts = await planService.getUserCountByPlan();
      
      res.status(200).json({
        success: true,
        data: userCounts
      });
    } catch (error: any) {
      console.error('Erro ao obter contagem de usuários por plano:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter contagem de usuários por plano'
      });
    }
  }

  /**
   * Sincroniza planos com o Stripe (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async syncPlansWithStripe(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const result = await planService.syncPlansWithStripe(req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Planos sincronizados com o Stripe com sucesso',
        data: result
      });
    } catch (error: any) {
      console.error('Erro ao sincronizar planos com o Stripe:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao sincronizar planos com o Stripe'
      });
    }
  }
}

export default new PlanController();