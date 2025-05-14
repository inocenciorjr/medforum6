import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as achievementService from '../../services/firebaseAchievementService';
import * as userAchievementService from '../../services/firebaseUserAchievementService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a conquistas
 *
 * Responsável por gerenciar conquistas, progresso de conquistas
 * e atribuição de conquistas aos usuários.
 */
class AchievementController {
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
   * Obtém todas as conquistas disponíveis
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllAchievements(req: Request, res: Response): Promise<void> {
    try {
      const category = req.query.category as string | undefined;
      const includeHidden = req.user?.role === UserRole.ADMIN && req.query.includeHidden === 'true';
      
      const achievements = await achievementService.getAllAchievements(category, includeHidden);
      
      res.status(200).json({
        success: true,
        data: achievements
      });
    } catch (error: any) {
      console.error('Erro ao obter conquistas:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter conquistas'
      });
    }
  }

  /**
   * Obtém uma conquista específica pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAchievementById(req: Request, res: Response): Promise<void> {
    try {
      const { achievementId } = req.params;
      
      const achievement = await achievementService.getAchievementById(achievementId);
      
      if (!achievement) {
        throw new AppError('Conquista não encontrada', 404);
      }
      
      // Verificar se a conquista está oculta e o usuário não é admin
      if (achievement.isHidden && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Conquista não encontrada', 404);
      }
      
      res.status(200).json({
        success: true,
        data: achievement
      });
    } catch (error: any) {
      console.error(`Erro ao obter conquista ID ${req.params.achievementId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter conquista'
      });
    }
  }

  /**
   * Cria uma nova conquista (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createAchievement(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const achievementData = req.body;
      
      const newAchievement = await achievementService.createAchievement(achievementData);
      
      res.status(201).json({
        success: true,
        message: 'Conquista criada com sucesso',
        data: newAchievement
      });
    } catch (error: any) {
      console.error('Erro ao criar conquista:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar conquista'
      });
    }
  }

  /**
   * Atualiza uma conquista existente (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateAchievement(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const { achievementId } = req.params;
      const achievementData = req.body;
      
      const updatedAchievement = await achievementService.updateAchievement(achievementId, achievementData);
      
      if (!updatedAchievement) {
        throw new AppError('Conquista não encontrada', 404);
      }
      
      res.status(200).json({
        success: true,
        message: 'Conquista atualizada com sucesso',
        data: updatedAchievement
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar conquista ID ${req.params.achievementId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar conquista'
      });
    }
  }

  /**
   * Exclui uma conquista (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteAchievement(req: Request, res: Response): Promise<void> {
    try {
      const { achievementId } = req.params;
      
      await achievementService.deleteAchievement(achievementId);
      
      res.status(200).json({
        success: true,
        message: 'Conquista excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir conquista ID ${req.params.achievementId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir conquista'
      });
    }
  }

  /**
   * Obtém as conquistas do usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserAchievements(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const includeUnlocked = req.query.includeUnlocked !== 'false'; // Default: true
      const includeProgress = req.query.includeProgress === 'true';
      const category = req.query.category as string | undefined;
      
      const achievements = await userAchievementService.getUserAchievements(userId, {
        includeUnlocked,
        includeProgress,
        category
      });
      
      res.status(200).json({
        success: true,
        data: achievements
      });
    } catch (error: any) {
      console.error('Erro ao obter conquistas do usuário:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter conquistas do usuário'
      });
    }
  }

  /**
   * Atribui uma conquista a um usuário (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async assignAchievementToUser(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const { userId, achievementId } = req.params;
      
      await userAchievementService.assignAchievementToUser(userId, achievementId);
      
      res.status(200).json({
        success: true,
        message: 'Conquista atribuída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao atribuir conquista ID ${req.params.achievementId} ao usuário ID ${req.params.userId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atribuir conquista'
      });
    }
  }

  /**
   * Remove uma conquista de um usuário (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async removeAchievementFromUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId, achievementId } = req.params;
      
      await userAchievementService.removeAchievementFromUser(userId, achievementId);
      
      res.status(200).json({
        success: true,
        message: 'Conquista removida com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao remover conquista ID ${req.params.achievementId} do usuário ID ${req.params.userId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao remover conquista'
      });
    }
  }

  /**
   * Atualiza o progresso de uma conquista para um usuário (apenas admin)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateUserAchievementProgress(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const { userId, achievementId } = req.params;
      const { progress } = req.body;
      
      await userAchievementService.updateUserAchievementProgress(userId, achievementId, progress);
      
      res.status(200).json({
        success: true,
        message: 'Progresso da conquista atualizado com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar progresso da conquista ID ${req.params.achievementId} para o usuário ID ${req.params.userId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar progresso da conquista'
      });
    }
  }
}

export default new AchievementController();