import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as userStatisticsService from '../../services/firebaseUserStatisticsService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a estatísticas de usuário
 *
 * Responsável por gerenciar estatísticas de estudo, desempenho e progresso dos usuários
 */
class UserStatisticsController {
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
   * Obtém as estatísticas de um usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar estas estatísticas', 403);
      }
      
      const statistics = await userStatisticsService.getUserStatistics(userId);
      
      if (!statistics) {
        // Se não existir, criar estatísticas iniciais
        const initialStatistics = await userStatisticsService.initializeUserStatistics(userId);
        
        res.status(200).json({
          success: true,
          data: initialStatistics
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas do usuário'
      });
    }
  }

  /**
   * Obtém as estatísticas de estudo por período
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getStudyStatisticsByPeriod(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      const { startDate, endDate, period } = req.query as { startDate: string, endDate: string, period: 'day' | 'week' | 'month' };
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar estas estatísticas', 403);
      }
      
      const statistics = await userStatisticsService.getStudyStatisticsByPeriod(userId, startDate, endDate, period);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas de estudo por período do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de estudo por período'
      });
    }
  }

  /**
   * Obtém as estatísticas de desempenho por categoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getPerformanceStatisticsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar estas estatísticas', 403);
      }
      
      const statistics = await userStatisticsService.getPerformanceStatisticsByCategory(userId);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas de desempenho por categoria do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de desempenho por categoria'
      });
    }
  }

  /**
   * Obtém as áreas de melhoria recomendadas para o usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getImprovementAreas(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar estas estatísticas', 403);
      }
      
      const improvementAreas = await userStatisticsService.getImprovementAreas(userId);
      
      res.status(200).json({
        success: true,
        data: improvementAreas
      });
    } catch (error: any) {
      console.error(`Erro ao obter áreas de melhoria do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter áreas de melhoria'
      });
    }
  }

  /**
   * Atualiza as estatísticas de um usuário após uma sessão de estudo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateStatisticsAfterStudySession(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        studyTimeMinutes, 
        flashcardsStudied, 
        correctAnswers, 
        incorrectAnswers,
        filterStats
      } = req.body;
      
      const updatedStatistics = await userStatisticsService.updateStatisticsAfterStudySession(
        userId,
        studyTimeMinutes,
        flashcardsStudied,
        correctAnswers,
        incorrectAnswers,
        filterStats
      );
      
      res.status(200).json({
        success: true,
        message: 'Estatísticas atualizadas com sucesso',
        data: updatedStatistics
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar estatísticas após sessão de estudo do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar estatísticas após sessão de estudo'
      });
    }
  }

  /**
   * Obtém o histórico de sessões de estudo de um usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getStudySessionHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este histórico', 403);
      }
      
      const history = await userStatisticsService.getStudySessionHistory(userId, page, limit);
      
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error: any) {
      console.error(`Erro ao obter histórico de sessões de estudo do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter histórico de sessões de estudo'
      });
    }
  }

  /**
   * Obtém o progresso do usuário em relação às metas
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getGoalProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver estatísticas
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este progresso', 403);
      }
      
      const goalProgress = await userStatisticsService.getGoalProgress(userId);
      
      res.status(200).json({
        success: true,
        data: goalProgress
      });
    } catch (error: any) {
      console.error(`Erro ao obter progresso de metas do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter progresso de metas'
      });
    }
  }
}

export default new UserStatisticsController();