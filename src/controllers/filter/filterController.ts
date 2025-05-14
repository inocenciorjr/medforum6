import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as filterService from '../../services/firebaseFilterService';
import * as subFilterService from '../../services/firebaseSubFilterService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a filtros
 *
 * Responsável por gerenciar filtros para categorização de conteúdo
 */
class FilterController {
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
   * Cria um novo filtro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createFilter(req: Request, res: Response): Promise<void> {
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
      
      const { name, description, icon, color, isActive } = req.body;
      
      // Verificar se já existe um filtro com o mesmo nome
      const existingFilter = await filterService.getFilterByName(name);
      if (existingFilter) {
        throw new AppError('Já existe um filtro com este nome', 409);
      }
      
      const filterData = {
        name,
        description: description || '',
        icon: icon || null,
        color: color || '#000000',
        isActive: isActive !== false,
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const filter = await filterService.createFilter(filterData);
      
      res.status(201).json({
        success: true,
        message: 'Filtro criado com sucesso',
        data: filter
      });
    } catch (error: any) {
      console.error('Erro ao criar filtro:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar filtro'
      });
    }
  }

  /**
   * Obtém todos os filtros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllFilters(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      
      const filters = await filterService.getAllFilters(includeInactive);
      
      res.status(200).json({
        success: true,
        data: filters
      });
    } catch (error: any) {
      console.error('Erro ao obter filtros:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter filtros'
      });
    }
  }

  /**
   * Obtém um filtro pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFilterById(req: Request, res: Response): Promise<void> {
    try {
      const { filterId } = req.params;
      
      const filter = await filterService.getFilterById(filterId);
      
      if (!filter) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      // Se o filtro estiver inativo e o usuário não for admin, não permitir acesso
      if (!filter.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      res.status(200).json({
        success: true,
        data: filter
      });
    } catch (error: any) {
      console.error(`Erro ao obter filtro ID ${req.params.filterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter filtro'
      });
    }
  }

  /**
   * Atualiza um filtro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateFilter(req: Request, res: Response): Promise<void> {
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
      
      const { filterId } = req.params;
      const { name, description, icon, color, isActive } = req.body;
      
      // Verificar se o filtro existe
      const existingFilter = await filterService.getFilterById(filterId);
      if (!existingFilter) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      // Verificar se já existe outro filtro com o mesmo nome
      if (name && name !== existingFilter.name) {
        const filterWithSameName = await filterService.getFilterByName(name);
        if (filterWithSameName && filterWithSameName.id !== filterId) {
          throw new AppError('Já existe um filtro com este nome', 409);
        }
      }
      
      const filterData = {
        name,
        description,
        icon,
        color,
        isActive,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };
      
      const updatedFilter = await filterService.updateFilter(filterId, filterData);
      
      res.status(200).json({
        success: true,
        message: 'Filtro atualizado com sucesso',
        data: updatedFilter
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar filtro ID ${req.params.filterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar filtro'
      });
    }
  }

  /**
   * Exclui um filtro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteFilter(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { filterId } = req.params;
      
      // Verificar se o filtro existe
      const existingFilter = await filterService.getFilterById(filterId);
      if (!existingFilter) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      // Verificar se o filtro tem subfiltros
      const subfilters = await subFilterService.getSubFiltersByFilterId(filterId);
      if (subfilters.length > 0) {
        throw new AppError('Não é possível excluir um filtro que possui subfiltros', 400);
      }
      
      // Verificar se o filtro está sendo usado em algum conteúdo
      const isFilterInUse = await filterService.isFilterInUse(filterId);
      if (isFilterInUse) {
        throw new AppError('Não é possível excluir um filtro que está sendo usado', 400);
      }
      
      await filterService.deleteFilter(filterId);
      
      res.status(200).json({
        success: true,
        message: 'Filtro excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir filtro ID ${req.params.filterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir filtro'
      });
    }
  }

  /**
   * Cria um novo subfiltro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createSubFilter(req: Request, res: Response): Promise<void> {
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
      
      const { filterId } = req.params;
      const { name, description, icon, color, isActive } = req.body;
      
      // Verificar se o filtro existe
      const existingFilter = await filterService.getFilterById(filterId);
      if (!existingFilter) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      // Verificar se já existe um subfiltro com o mesmo nome para este filtro
      const existingSubFilter = await subFilterService.getSubFilterByName(filterId, name);
      if (existingSubFilter) {
        throw new AppError('Já existe um subfiltro com este nome para este filtro', 409);
      }
      
      const subFilterData = {
        filterId,
        name,
        description: description || '',
        icon: icon || null,
        color: color || '#000000',
        isActive: isActive !== false,
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const subFilter = await subFilterService.createSubFilter(subFilterData);
      
      res.status(201).json({
        success: true,
        message: 'Subfiltro criado com sucesso',
        data: subFilter
      });
    } catch (error: any) {
      console.error(`Erro ao criar subfiltro para o filtro ID ${req.params.filterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar subfiltro'
      });
    }
  }

  /**
   * Obtém todos os subfiltros de um filtro
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getSubFiltersByFilterId(req: Request, res: Response): Promise<void> {
    try {
      const { filterId } = req.params;
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      
      // Verificar se o filtro existe
      const existingFilter = await filterService.getFilterById(filterId);
      if (!existingFilter) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      // Se o filtro estiver inativo e o usuário não for admin, não permitir acesso
      if (!existingFilter.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Filtro não encontrado', 404);
      }
      
      const subFilters = await subFilterService.getSubFiltersByFilterId(filterId, includeInactive);
      
      res.status(200).json({
        success: true,
        data: subFilters
      });
    } catch (error: any) {
      console.error(`Erro ao obter subfiltros do filtro ID ${req.params.filterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter subfiltros'
      });
    }
  }

  /**
   * Obtém um subfiltro pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getSubFilterById(req: Request, res: Response): Promise<void> {
    try {
      const { subFilterId } = req.params;
      
      const subFilter = await subFilterService.getSubFilterById(subFilterId);
      
      if (!subFilter) {
        throw new AppError('Subfiltro não encontrado', 404);
      }
      
      // Se o subfiltro estiver inativo e o usuário não for admin, não permitir acesso
      if (!subFilter.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Subfiltro não encontrado', 404);
      }
      
      // Verificar se o filtro pai está ativo
      const filter = await filterService.getFilterById(subFilter.filterId);
      if (!filter?.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Subfiltro não encontrado', 404);
      }
      
      res.status(200).json({
        success: true,
        data: subFilter
      });
    } catch (error: any) {
      console.error(`Erro ao obter subfiltro ID ${req.params.subFilterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter subfiltro'
      });
    }
  }

  /**
   * Atualiza um subfiltro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateSubFilter(req: Request, res: Response): Promise<void> {
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
      
      const { subFilterId } = req.params;
      const { name, description, icon, color, isActive } = req.body;
      
      // Verificar se o subfiltro existe
      const existingSubFilter = await subFilterService.getSubFilterById(subFilterId);
      if (!existingSubFilter) {
        throw new AppError('Subfiltro não encontrado', 404);
      }
      
      // Verificar se já existe outro subfiltro com o mesmo nome para este filtro
      if (name && name !== existingSubFilter.name) {
        const subFilterWithSameName = await subFilterService.getSubFilterByName(existingSubFilter.filterId, name);
        if (subFilterWithSameName && subFilterWithSameName.id !== subFilterId) {
          throw new AppError('Já existe um subfiltro com este nome para este filtro', 409);
        }
      }
      
      const subFilterData = {
        name,
        description,
        icon,
        color,
        isActive,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };
      
      const updatedSubFilter = await subFilterService.updateSubFilter(subFilterId, subFilterData);
      
      res.status(200).json({
        success: true,
        message: 'Subfiltro atualizado com sucesso',
        data: updatedSubFilter
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar subfiltro ID ${req.params.subFilterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar subfiltro'
      });
    }
  }

  /**
   * Exclui um subfiltro (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteSubFilter(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { subFilterId } = req.params;
      
      // Verificar se o subfiltro existe
      const existingSubFilter = await subFilterService.getSubFilterById(subFilterId);
      if (!existingSubFilter) {
        throw new AppError('Subfiltro não encontrado', 404);
      }
      
      // Verificar se o subfiltro está sendo usado em algum conteúdo
      const isSubFilterInUse = await subFilterService.isSubFilterInUse(subFilterId);
      if (isSubFilterInUse) {
        throw new AppError('Não é possível excluir um subfiltro que está sendo usado', 400);
      }
      
      await subFilterService.deleteSubFilter(subFilterId);
      
      res.status(200).json({
        success: true,
        message: 'Subfiltro excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir subfiltro ID ${req.params.subFilterId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir subfiltro'
      });
    }
  }
}

export default new FilterController();