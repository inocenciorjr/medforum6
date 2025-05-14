import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as studySessionService from '../../services/firebaseStudySessionService';
import * as userStatisticsService from '../../services/firebaseUserStatisticsService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a sessões de estudo
 *
 * Responsável por gerenciar sessões de estudo, incluindo início, finalização e análise
 */
class StudySessionController {
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
   * Inicia uma nova sessão de estudo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async startStudySession(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.body;
      
      const studySession = await studySessionService.startStudySession(userId, deckId);
      
      res.status(201).json({
        success: true,
        message: 'Sessão de estudo iniciada com sucesso',
        data: studySession
      });
    } catch (error: any) {
      console.error('Erro ao iniciar sessão de estudo:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao iniciar sessão de estudo'
      });
    }
  }

  /**
   * Finaliza uma sessão de estudo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async endStudySession(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { sessionId, results } = req.body;
      
      // Verificar se a sessão existe e pertence ao usuário
      const session = await studySessionService.getStudySessionById(sessionId);
      if (!session) {
        throw new AppError('Sessão de estudo não encontrada', 404);
      }
      
      if (session.userId !== userId) {
        throw new AppError('Você não tem permissão para finalizar esta sessão de estudo', 403);
      }
      
      // Finalizar a sessão
      const endedSession = await studySessionService.endStudySession(sessionId, results);
      
      // Atualizar estatísticas do usuário
      await userStatisticsService.updateStatisticsAfterStudySession(
        userId,
        Math.round(endedSession.totalTimeMs / 60000), // Converter ms para minutos
        endedSession.flashcardsStudied || 0,
        endedSession.correctAnswers || 0,
        endedSession.incorrectAnswers || 0,
        results.filterStats
      );
      
      res.status(200).json({
        success: true,
        message: 'Sessão de estudo finalizada com sucesso',
        data: endedSession
      });
    } catch (error: any) {
      console.error(`Erro ao finalizar sessão de estudo ID ${req.body.sessionId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao finalizar sessão de estudo'
      });
    }
  }

  /**
   * Obtém uma sessão de estudo pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getStudySessionById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { sessionId } = req.params;
      
      const session = await studySessionService.getStudySessionById(sessionId);
      
      if (!session) {
        throw new AppError('Sessão de estudo não encontrada', 404);
      }
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver a sessão
      if (session.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta sessão de estudo', 403);
      }
      
      res.status(200).json({
        success: true,
        data: session
      });
    } catch (error: any) {
      console.error(`Erro ao obter sessão de estudo ID ${req.params.sessionId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter sessão de estudo'
      });
    }
  }

  /**
   * Obtém todas as sessões de estudo de um usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserStudySessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver as sessões
      if (userId !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar estas sessões de estudo', 403);
      }
      
      const sessions = await studySessionService.getUserStudySessions(userId, page, limit);
      
      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error: any) {
      console.error(`Erro ao obter sessões de estudo do usuário ID ${req.params.userId || req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter sessões de estudo'
      });
    }
  }

  /**
   * Obtém as sessões de estudo de um deck
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDeckStudySessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const sessions = await studySessionService.getDeckStudySessions(userId, deckId, page, limit);
      
      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error: any) {
      console.error(`Erro ao obter sessões de estudo do deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter sessões de estudo do deck'
      });
    }
  }

  /**
   * Obtém análise de desempenho de uma sessão de estudo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getStudySessionAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { sessionId } = req.params;
      
      // Verificar se a sessão existe
      const session = await studySessionService.getStudySessionById(sessionId);
      if (!session) {
        throw new AppError('Sessão de estudo não encontrada', 404);
      }
      
      // Verificar permissão: apenas o próprio usuário ou administradores podem ver a análise
      if (session.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta análise', 403);
      }
      
      const analysis = await studySessionService.getStudySessionAnalysis(sessionId);
      
      res.status(200).json({
        success: true,
        data: analysis
      });
    } catch (error: any) {
      console.error(`Erro ao obter análise da sessão de estudo ID ${req.params.sessionId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter análise da sessão de estudo'
      });
    }
  }

  /**
   * Adiciona uma interação com flashcard durante uma sessão de estudo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async addFlashcardInteraction(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { sessionId } = req.params;
      const { flashcardId, isCorrect, difficulty, timeSpentMs } = req.body;
      
      // Verificar se a sessão existe e pertence ao usuário
      const session = await studySessionService.getStudySessionById(sessionId);
      if (!session) {
        throw new AppError('Sessão de estudo não encontrada', 404);
      }
      
      if (session.userId !== userId) {
        throw new AppError('Você não tem permissão para adicionar interações a esta sessão', 403);
      }
      
      const interaction = await studySessionService.addFlashcardInteraction(
        sessionId,
        userId,
        flashcardId,
        isCorrect,
        difficulty,
        timeSpentMs
      );
      
      res.status(201).json({
        success: true,
        message: 'Interação com flashcard registrada com sucesso',
        data: interaction
      });
    } catch (error: any) {
      console.error(`Erro ao adicionar interação com flashcard na sessão ID ${req.params.sessionId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao adicionar interação com flashcard'
      });
    }
  }
}

export default new StudySessionController();