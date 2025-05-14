import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as tagService from '../../services/firebaseTagService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a tags
 *
 * Responsável por gerenciar tags para categorização de conteúdo
 */
class TagController {
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
   * Obtém todas as tags
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllTags(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const scope = req.query.scope as string;
      
      const tags = await tagService.getAllTags(page, limit, scope);
      
      res.status(200).json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      console.error('Erro ao obter tags:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tags'
      });
    }
  }

  /**
   * Obtém uma tag pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getTagById(req: Request, res: Response): Promise<void> {
    try {
      const { tagId } = req.params;
      
      const tag = await tagService.getTagById(tagId);
      
      if (!tag) {
        throw new AppError('Tag não encontrada', 404);
      }
      
      res.status(200).json({
        success: true,
        data: tag
      });
    } catch (error: any) {
      console.error(`Erro ao obter tag ID ${req.params.tagId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tag'
      });
    }
  }

  /**
   * Cria uma nova tag
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createTag(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { name, description, scope, color, icon } = req.body;
      
      // Verificar se o usuário tem permissão para criar tags globais
      if (scope === 'GLOBAL' && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem criar tags globais', 403);
      }
      
      // Verificar se já existe uma tag com o mesmo nome
      const existingTag = await tagService.getTagByName(name);
      if (existingTag) {
        throw new AppError('Já existe uma tag com este nome', 409);
      }
      
      const tagData = {
        name,
        description,
        scope: scope || 'USER',
        color,
        icon,
        createdBy: userId
      };
      
      const newTag = await tagService.createTag(tagData);
      
      res.status(201).json({
        success: true,
        message: 'Tag criada com sucesso',
        data: newTag
      });
    } catch (error: any) {
      console.error('Erro ao criar tag:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar tag'
      });
    }
  }

  /**
   * Atualiza uma tag existente
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateTag(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { tagId } = req.params;
      const { name, description, scope, color, icon, isActive } = req.body;
      
      // Verificar se a tag existe
      const existingTag = await tagService.getTagById(tagId);
      if (!existingTag) {
        throw new AppError('Tag não encontrada', 404);
      }
      
      // Verificar permissão: apenas o criador ou administradores podem atualizar a tag
      if (existingTag.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar esta tag', 403);
      }
      
      // Verificar se o usuário tem permissão para alterar o escopo para global
      if (scope === 'GLOBAL' && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem definir tags como globais', 403);
      }
      
      // Verificar se já existe outra tag com o mesmo nome
      if (name && name !== existingTag.name) {
        const tagWithSameName = await tagService.getTagByName(name);
        if (tagWithSameName && tagWithSameName.id !== tagId) {
          throw new AppError('Já existe uma tag com este nome', 409);
        }
      }
      
      const tagData = {
        name,
        description,
        scope,
        color,
        icon,
        isActive
      };
      
      const updatedTag = await tagService.updateTag(tagId, tagData);
      
      res.status(200).json({
        success: true,
        message: 'Tag atualizada com sucesso',
        data: updatedTag
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar tag ID ${req.params.tagId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar tag'
      });
    }
  }

  /**
   * Exclui uma tag
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteTag(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { tagId } = req.params;
      
      // Verificar se a tag existe
      const existingTag = await tagService.getTagById(tagId);
      if (!existingTag) {
        throw new AppError('Tag não encontrada', 404);
      }
      
      // Verificar permissão: apenas o criador ou administradores podem excluir a tag
      if (existingTag.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir esta tag', 403);
      }
      
      await tagService.deleteTag(tagId);
      
      res.status(200).json({
        success: true,
        message: 'Tag excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir tag ID ${req.params.tagId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir tag'
      });
    }
  }

  /**
   * Obtém tags populares
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getPopularTags(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const tags = await tagService.getPopularTags(limit);
      
      res.status(200).json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      console.error('Erro ao obter tags populares:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tags populares'
      });
    }
  }

  /**
   * Obtém tags relacionadas a uma tag específica
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getRelatedTags(req: Request, res: Response): Promise<void> {
    try {
      const { tagId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verificar se a tag existe
      const existingTag = await tagService.getTagById(tagId);
      if (!existingTag) {
        throw new AppError('Tag não encontrada', 404);
      }
      
      const relatedTags = await tagService.getRelatedTags(tagId, limit);
      
      res.status(200).json({
        success: true,
        data: relatedTags
      });
    } catch (error: any) {
      console.error(`Erro ao obter tags relacionadas à tag ID ${req.params.tagId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tags relacionadas'
      });
    }
  }

  /**
   * Pesquisa tags por nome
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async searchTags(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query || typeof query !== 'string') {
        throw new AppError('Termo de pesquisa inválido', 400);
      }
      
      const tags = await tagService.searchTags(query, limit);
      
      res.status(200).json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      console.error(`Erro ao pesquisar tags com o termo "${req.query.query}":`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao pesquisar tags'
      });
    }
  }
}

export default new TagController();