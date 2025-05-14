import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as commentService from '../../services/firebaseCommentService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a comentários
 *
 * Responsável por gerenciar comentários em recursos como decks, flashcards, etc.
 */
class CommentController {
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
   * Obtém todos os comentários de um recurso
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCommentsByResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceId, resourceType } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const comments = await commentService.getCommentsByPostId(resourceId, resourceType as any, page, limit);
      
      res.status(200).json({
        success: true,
        data: comments
      });
    } catch (error: any) {
      console.error(`Erro ao obter comentários do recurso ID ${req.params.resourceId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter comentários'
      });
    }
  }

  /**
   * Obtém um comentário específico pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCommentById(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      
      const comment = await commentService.getCommentById(commentId);
      
      if (!comment) {
        throw new AppError('Comentário não encontrado', 404);
      }
      
      res.status(200).json({
        success: true,
        data: comment
      });
    } catch (error: any) {
      console.error(`Erro ao obter comentário ID ${req.params.commentId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter comentário'
      });
    }
  }

  /**
   * Cria um novo comentário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createComment(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { resourceId, resourceType } = req.params;
      const { content, parentId } = req.body;
      
      const commentData = {
        userId,
        resourceId,
        resourceType,
        content,
        parentId
      };
      
      const newComment = await commentService.createComment(commentData);
      
      res.status(201).json({
        success: true,
        message: 'Comentário criado com sucesso',
        data: newComment
      });
    } catch (error: any) {
      console.error('Erro ao criar comentário:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar comentário'
      });
    }
  }

  /**
   * Atualiza um comentário existente
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateComment(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { commentId } = req.params;
      const { content } = req.body;
      
      // Verificar se o comentário existe
      const existingComment = await commentService.getCommentById(commentId);
      if (!existingComment) {
        throw new AppError('Comentário não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para atualizar o comentário
      if (existingComment.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar este comentário', 403);
      }
      
      const updatedComment = await commentService.updateComment(commentId, { content });
      
      res.status(200).json({
        success: true,
        message: 'Comentário atualizado com sucesso',
        data: updatedComment
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar comentário ID ${req.params.commentId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar comentário'
      });
    }
  }

  /**
   * Exclui um comentário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { commentId } = req.params;
      
      // Verificar se o comentário existe
      const existingComment = await commentService.getCommentById(commentId);
      if (!existingComment) {
        throw new AppError('Comentário não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para excluir o comentário
      if (existingComment.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir este comentário', 403);
      }
      
      await commentService.deleteComment(commentId);
      
      res.status(200).json({
        success: true,
        message: 'Comentário excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir comentário ID ${req.params.commentId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir comentário'
      });
    }
  }

  /**
   * Obtém as respostas de um comentário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCommentReplies(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verificar se o comentário existe
      const existingComment = await commentService.getCommentById(commentId);
      if (!existingComment) {
        throw new AppError('Comentário não encontrado', 404);
      }
      
      const replies = await commentService.getCommentReplies(commentId, page, limit);
      
      res.status(200).json({
        success: true,
        data: replies
      });
    } catch (error: any) {
      console.error(`Erro ao obter respostas do comentário ID ${req.params.commentId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter respostas do comentário'
      });
    }
  }

  /**
   * Reporta um comentário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async reportComment(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { commentId } = req.params;
      const { reason, description } = req.body;
      
      // Verificar se o comentário existe
      const existingComment = await commentService.getCommentById(commentId);
      if (!existingComment) {
        throw new AppError('Comentário não encontrado', 404);
      }
      
      await commentService.reportComment(commentId, userId, reason, description);
      
      res.status(200).json({
        success: true,
        message: 'Comentário reportado com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao reportar comentário ID ${req.params.commentId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao reportar comentário'
      });
    }
  }
}

export default new CommentController();