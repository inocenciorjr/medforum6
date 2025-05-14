import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as couponService from '../../services/firebaseCouponService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a cupons de desconto
 *
 * Responsável por gerenciar cupons de desconto para planos de assinatura
 */
class CouponController {
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
   * Cria um novo cupom (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createCoupon(req: Request, res: Response): Promise<void> {
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
        code, 
        discountType, 
        discountValue, 
        maxUses, 
        expiresAt, 
        planIds,
        isActive,
        description,
        stripeCouponId
      } = req.body;
      
      // Verificar se já existe um cupom com o mesmo código
      const existingCoupon = await couponService.getCouponByCode(code);
      if (existingCoupon) {
        throw new AppError('Já existe um cupom com este código', 409);
      }
      
      // Verificar se os planos existem
      if (planIds && planIds.length > 0) {
        const validPlanIds = await couponService.validatePlanIds(planIds);
        if (validPlanIds.length !== planIds.length) {
          throw new AppError('Um ou mais IDs de planos são inválidos', 400);
        }
      }
      
      const couponData = {
        code,
        discountType,
        discountValue,
        maxUses: maxUses || null,
        usageCount: 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        planIds: planIds || [],
        isActive: isActive !== false,
        description: description || '',
        stripeCouponId: stripeCouponId || null,
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const coupon = await couponService.createCoupon(couponData);
      
      res.status(201).json({
        success: true,
        message: 'Cupom criado com sucesso',
        data: coupon
      });
    } catch (error: any) {
      console.error('Erro ao criar cupom:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar cupom'
      });
    }
  }

  /**
   * Obtém todos os cupons (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllCoupons(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const includeInactive = req.query.includeInactive === 'true';
      const includeExpired = req.query.includeExpired === 'true';
      
      const coupons = await couponService.getAllCoupons(includeInactive, includeExpired);
      
      res.status(200).json({
        success: true,
        data: coupons
      });
    } catch (error: any) {
      console.error('Erro ao obter cupons:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter cupons'
      });
    }
  }

  /**
   * Obtém um cupom pelo ID (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCouponById(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { couponId } = req.params;
      
      const coupon = await couponService.getCouponById(couponId);
      
      if (!coupon) {
        throw new AppError('Cupom não encontrado', 404);
      }
      
      res.status(200).json({
        success: true,
        data: coupon
      });
    } catch (error: any) {
      console.error(`Erro ao obter cupom ID ${req.params.couponId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter cupom'
      });
    }
  }

  /**
   * Valida um cupom pelo código
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async validateCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { code, planId } = req.body;
      
      const validationResult = await couponService.validateCoupon(code, planId);
      
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          message: validationResult.message
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Cupom válido',
        data: {
          coupon: validationResult.coupon,
          discountAmount: validationResult.discountAmount
        }
      });
    } catch (error: any) {
      console.error(`Erro ao validar cupom ${req.body.code}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao validar cupom'
      });
    }
  }

  /**
   * Atualiza um cupom (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateCoupon(req: Request, res: Response): Promise<void> {
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
      
      const { couponId } = req.params;
      const { 
        code, 
        discountType, 
        discountValue, 
        maxUses, 
        expiresAt, 
        planIds,
        isActive,
        description,
        stripeCouponId
      } = req.body;
      
      // Verificar se o cupom existe
      const existingCoupon = await couponService.getCouponById(couponId);
      if (!existingCoupon) {
        throw new AppError('Cupom não encontrado', 404);
      }
      
      // Verificar se já existe outro cupom com o mesmo código
      if (code && code !== existingCoupon.code) {
        const couponWithSameCode = await couponService.getCouponByCode(code);
        if (couponWithSameCode && couponWithSameCode.id !== couponId) {
          throw new AppError('Já existe um cupom com este código', 409);
        }
      }
      
      // Verificar se os planos existem
      if (planIds && planIds.length > 0) {
        const validPlanIds = await couponService.validatePlanIds(planIds);
        if (validPlanIds.length !== planIds.length) {
          throw new AppError('Um ou mais IDs de planos são inválidos', 400);
        }
      }
      
      const couponData = {
        code,
        discountType,
        discountValue,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        planIds,
        isActive,
        description,
        stripeCouponId,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };
      
      const updatedCoupon = await couponService.updateCoupon(couponId, couponData);
      
      res.status(200).json({
        success: true,
        message: 'Cupom atualizado com sucesso',
        data: updatedCoupon
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar cupom ID ${req.params.couponId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar cupom'
      });
    }
  }

  /**
   * Exclui um cupom (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteCoupon(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { couponId } = req.params;
      
      // Verificar se o cupom existe
      const existingCoupon = await couponService.getCouponById(couponId);
      if (!existingCoupon) {
        throw new AppError('Cupom não encontrado', 404);
      }
      
      // Verificar se o cupom já foi usado
      if (existingCoupon.usageCount > 0) {
        throw new AppError('Não é possível excluir um cupom que já foi usado', 400);
      }
      
      await couponService.deleteCoupon(couponId);
      
      res.status(200).json({
        success: true,
        message: 'Cupom excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir cupom ID ${req.params.couponId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir cupom'
      });
    }
  }

  /**
   * Ativa ou desativa um cupom (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async toggleCouponStatus(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { couponId } = req.params;
      const { isActive } = req.body;
      
      // Verificar se o cupom existe
      const existingCoupon = await couponService.getCouponById(couponId);
      if (!existingCoupon) {
        throw new AppError('Cupom não encontrado', 404);
      }
      
      const updatedCoupon = await couponService.updateCoupon(couponId, {
        isActive,
        updatedAt: new Date(),
        updatedBy: req.user.id
      });
      
      res.status(200).json({
        success: true,
        message: `Cupom ${isActive ? 'ativado' : 'desativado'} com sucesso`,
        data: updatedCoupon
      });
    } catch (error: any) {
      console.error(`Erro ao alterar status do cupom ID ${req.params.couponId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao alterar status do cupom'
      });
    }
  }

  /**
   * Obtém estatísticas de uso de cupons (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCouponStatistics(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const statistics = await couponService.getCouponStatistics(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Erro ao obter estatísticas de cupons:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de cupons'
      });
    }
  }

  /**
   * Sincroniza cupons com o Stripe (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async syncCouponsWithStripe(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const result = await couponService.syncCouponsWithStripe(req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Cupons sincronizados com o Stripe com sucesso',
        data: result
      });
    } catch (error: any) {
      console.error('Erro ao sincronizar cupons com o Stripe:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao sincronizar cupons com o Stripe'
      });
    }
  }
}

export default new CouponController();