import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as notificationService from '../../services/firebaseNotificationService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a notificações
 *
 * Responsável por gerenciar notificações para usuários
 */
class NotificationController {
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
   * Cria uma nova notificação
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createNotification(req: Request, res: Response): Promise<void> {
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
      
      const { userId, title, message, type, data, isGlobal } = req.body;
      
      // Se não for global, verificar se o usuário existe
      if (!isGlobal && userId) {
        const userExists = await notificationService.checkUserExists(userId);
        if (!userExists) {
          throw new AppError('Usuário não encontrado', 404);
        }
      }
      
      const notificationData = {
        userId: isGlobal ? null : userId,
        title,
        message,
        type,
        data: data || {},
        isGlobal: isGlobal || false,
        isRead: false,
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const notification = await notificationService.createNotification(notificationData);
      
      res.status(201).json({
        success: true,
        message: 'Notificação criada com sucesso',
        data: notification
      });
    } catch (error: any) {
      console.error('Erro ao criar notificação:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar notificação'
      });
    }
  }

  /**
   * Obtém todas as notificações do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';
      
      const notifications = await notificationService.getUserNotifications(userId, page, limit, unreadOnly);
      
      res.status(200).json({
        success: true,
        data: notifications
      });
    } catch (error: any) {
      console.error(`Erro ao obter notificações do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter notificações'
      });
    }
  }

  /**
   * Obtém uma notificação pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getNotificationById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { notificationId } = req.params;
      
      const notification = await notificationService.getNotificationById(notificationId);
      
      if (!notification) {
        throw new AppError('Notificação não encontrada', 404);
      }
      
      // Verificar permissão: apenas o destinatário ou admin pode ver
      if (notification.userId !== userId && !notification.isGlobal && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta notificação', 403);
      }
      
      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error: any) {
      console.error(`Erro ao obter notificação ID ${req.params.notificationId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter notificação'
      });
    }
  }

  /**
   * Marca uma notificação como lida
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { notificationId } = req.params;
      
      const notification = await notificationService.getNotificationById(notificationId);
      
      if (!notification) {
        throw new AppError('Notificação não encontrada', 404);
      }
      
      // Verificar permissão: apenas o destinatário pode marcar como lida
      if (notification.userId !== userId && !notification.isGlobal) {
        throw new AppError('Você não tem permissão para marcar esta notificação como lida', 403);
      }
      
      // Se já estiver lida, retornar sucesso
      if (notification.isRead) {
        res.status(200).json({
          success: true,
          message: 'Notificação já está marcada como lida',
          data: notification
        });
        return;
      }
      
      const updatedNotification = await notificationService.markAsRead(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notificação marcada como lida',
        data: updatedNotification
      });
    } catch (error: any) {
      console.error(`Erro ao marcar notificação ID ${req.params.notificationId} como lida:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao marcar notificação como lida'
      });
    }
  }

  /**
   * Marca todas as notificações do usuário como lidas
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      await notificationService.markAllAsRead(userId);
      
      res.status(200).json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas'
      });
    } catch (error: any) {
      console.error(`Erro ao marcar todas as notificações do usuário ID ${req.user?.id} como lidas:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao marcar todas as notificações como lidas'
      });
    }
  }

  /**
   * Exclui uma notificação
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { notificationId } = req.params;
      
      const notification = await notificationService.getNotificationById(notificationId);
      
      if (!notification) {
        throw new AppError('Notificação não encontrada', 404);
      }
      
      // Verificar permissão: apenas o destinatário ou admin pode excluir
      if (notification.userId !== userId && !notification.isGlobal && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir esta notificação', 403);
      }
      
      await notificationService.deleteNotification(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notificação excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir notificação ID ${req.params.notificationId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir notificação'
      });
    }
  }

  /**
   * Obtém o contador de notificações não lidas
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const count = await notificationService.getUnreadCount(userId);
      
      res.status(200).json({
        success: true,
        data: { count }
      });
    } catch (error: any) {
      console.error(`Erro ao obter contador de notificações não lidas do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter contador de notificações não lidas'
      });
    }
  }

  /**
   * Envia uma notificação para vários usuários
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async sendBulkNotifications(req: Request, res: Response): Promise<void> {
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
      
      const { userIds, title, message, type, data } = req.body;
      
      // Verificar se a lista de usuários não está vazia
      if (!userIds || userIds.length === 0) {
        throw new AppError('A lista de usuários não pode estar vazia', 400);
      }
      
      const result = await notificationService.sendBulkNotifications(userIds, {
        title,
        message,
        type,
        data: data || {},
        createdBy: req.user.id
      });
      
      res.status(200).json({
        success: true,
        message: 'Notificações enviadas com sucesso',
        data: result
      });
    } catch (error: any) {
      console.error('Erro ao enviar notificações em massa:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao enviar notificações em massa'
      });
    }
  }
}

export default new NotificationController();