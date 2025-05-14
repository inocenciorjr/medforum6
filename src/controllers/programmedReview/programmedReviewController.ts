import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as programmedReviewService from '../../services/firebaseProgrammedReviewService';
import * as deckService from '../../services/firebaseDeckService';
import { AppError } from '../../utils/errors';
import { UserRole, ReviewStatus } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a revisões programadas
 *
 * Responsável por gerenciar revisões programadas de decks de flashcards
 */
class ProgrammedReviewController {
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
   * Cria uma nova revisão programada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        deckId, 
        scheduledDate, 
        title, 
        description, 
        reminderEnabled,
        reminderTime
      } = req.body;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o usuário tem acesso ao deck
      if (deck.userId !== userId && !deck.isPublic) {
        throw new AppError('Você não tem permissão para acessar este deck', 403);
      }
      
      // Verificar se já existe uma revisão programada para o mesmo deck e data
      const existingReview = await programmedReviewService.findExistingReview(userId, deckId, new Date(scheduledDate));
      if (existingReview) {
        throw new AppError('Já existe uma revisão programada para este deck nesta data', 409);
      }
      
      const programmedReviewData = {
        userId,
        deckId,
        deck: {
          id: deck.id,
          title: deck.title,
          description: deck.description,
          cardCount: deck.cardCount || 0,
          coverImageUrl: deck.coverImageUrl
        },
        scheduledDate: new Date(scheduledDate),
        title: title || `Revisão de ${deck.title}`,
        description: description || '',
        status: ReviewStatus.PENDING,
        reminderEnabled: reminderEnabled !== false,
        reminderTime: reminderTime || '09:00',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        skippedAt: null,
        score: null,
        timeSpent: null,
        cardsReviewed: null
      };
      
      const programmedReview = await programmedReviewService.createProgrammedReview(programmedReviewData);
      
      res.status(201).json({
        success: true,
        message: 'Revisão programada criada com sucesso',
        data: programmedReview
      });
    } catch (error: any) {
      console.error('Erro ao criar revisão programada:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar revisão programada'
      });
    }
  }

  /**
   * Obtém uma revisão programada pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getProgrammedReviewById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão ou um administrador
      if (programmedReview.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta revisão programada', 403);
      }
      
      res.status(200).json({
        success: true,
        data: programmedReview
      });
    } catch (error: any) {
      console.error(`Erro ao obter revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter revisão programada'
      });
    }
  }

  /**
   * Atualiza uma revisão programada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      const { 
        scheduledDate, 
        title, 
        description, 
        reminderEnabled,
        reminderTime
      } = req.body;
      
      // Verificar se a revisão programada existe
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão
      if (programmedReview.userId !== userId) {
        throw new AppError('Você não tem permissão para atualizar esta revisão programada', 403);
      }
      
      // Verificar se a revisão já foi concluída ou pulada
      if (programmedReview.status !== ReviewStatus.PENDING) {
        throw new AppError('Não é possível atualizar uma revisão que já foi concluída ou pulada', 400);
      }
      
      // Se a data foi alterada, verificar se já existe uma revisão para o mesmo deck e nova data
      if (scheduledDate && new Date(scheduledDate).toDateString() !== programmedReview.scheduledDate.toDateString()) {
        const existingReview = await programmedReviewService.findExistingReview(
          userId, 
          programmedReview.deckId, 
          new Date(scheduledDate),
          reviewId
        );
        
        if (existingReview) {
          throw new AppError('Já existe uma revisão programada para este deck nesta data', 409);
        }
      }
      
      const programmedReviewData = {
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        title,
        description,
        reminderEnabled,
        reminderTime,
        updatedAt: new Date()
      };
      
      const updatedProgrammedReview = await programmedReviewService.updateProgrammedReview(reviewId, programmedReviewData);
      
      res.status(200).json({
        success: true,
        message: 'Revisão programada atualizada com sucesso',
        data: updatedProgrammedReview
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar revisão programada'
      });
    }
  }

  /**
   * Exclui uma revisão programada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      
      // Verificar se a revisão programada existe
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão
      if (programmedReview.userId !== userId) {
        throw new AppError('Você não tem permissão para excluir esta revisão programada', 403);
      }
      
      await programmedReviewService.deleteProgrammedReview(reviewId);
      
      res.status(200).json({
        success: true,
        message: 'Revisão programada excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir revisão programada'
      });
    }
  }

  /**
   * Obtém todas as revisões programadas do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserProgrammedReviews(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as ReviewStatus;
      const deckId = req.query.deckId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      
      const filterOptions = {
        page,
        limit,
        status,
        deckId,
        startDate,
        endDate,
        sortBy,
        sortOrder
      };
      
      const programmedReviews = await programmedReviewService.getUserProgrammedReviews(userId, filterOptions);
      
      res.status(200).json({
        success: true,
        data: programmedReviews
      });
    } catch (error: any) {
      console.error(`Erro ao obter revisões programadas do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter revisões programadas'
      });
    }
  }

  /**
   * Marca uma revisão programada como concluída
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async completeProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      const { score, timeSpent, cardsReviewed } = req.body;
      
      // Verificar se a revisão programada existe
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão
      if (programmedReview.userId !== userId) {
        throw new AppError('Você não tem permissão para concluir esta revisão programada', 403);
      }
      
      // Verificar se a revisão já foi concluída ou pulada
      if (programmedReview.status !== ReviewStatus.PENDING) {
        throw new AppError('Esta revisão já foi concluída ou pulada', 400);
      }
      
      const now = new Date();
      
      const programmedReviewData = {
        status: ReviewStatus.COMPLETED,
        completedAt: now,
        score: score || null,
        timeSpent: timeSpent || null,
        cardsReviewed: cardsReviewed || null,
        updatedAt: now
      };
      
      const updatedProgrammedReview = await programmedReviewService.updateProgrammedReview(reviewId, programmedReviewData);
      
      res.status(200).json({
        success: true,
        message: 'Revisão programada concluída com sucesso',
        data: updatedProgrammedReview
      });
    } catch (error: any) {
      console.error(`Erro ao concluir revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao concluir revisão programada'
      });
    }
  }

  /**
   * Pula uma revisão programada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async skipProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      
      // Verificar se a revisão programada existe
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão
      if (programmedReview.userId !== userId) {
        throw new AppError('Você não tem permissão para pular esta revisão programada', 403);
      }
      
      // Verificar se a revisão já foi concluída ou pulada
      if (programmedReview.status !== ReviewStatus.PENDING) {
        throw new AppError('Esta revisão já foi concluída ou pulada', 400);
      }
      
      const now = new Date();
      
      const programmedReviewData = {
        status: ReviewStatus.SKIPPED,
        skippedAt: now,
        updatedAt: now
      };
      
      const updatedProgrammedReview = await programmedReviewService.updateProgrammedReview(reviewId, programmedReviewData);
      
      res.status(200).json({
        success: true,
        message: 'Revisão programada pulada com sucesso',
        data: updatedProgrammedReview
      });
    } catch (error: any) {
      console.error(`Erro ao pular revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao pular revisão programada'
      });
    }
  }

  /**
   * Reagenda uma revisão programada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async rescheduleProgrammedReview(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { reviewId } = req.params;
      const { scheduledDate } = req.body;
      
      // Verificar se a revisão programada existe
      const programmedReview = await programmedReviewService.getProgrammedReviewById(reviewId);
      if (!programmedReview) {
        throw new AppError('Revisão programada não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da revisão
      if (programmedReview.userId !== userId) {
        throw new AppError('Você não tem permissão para reagendar esta revisão programada', 403);
      }
      
      // Verificar se a data é futura
      const newDate = new Date(scheduledDate);
      const now = new Date();
      if (newDate <= now) {
        throw new AppError('A data de reagendamento deve ser no futuro', 400);
      }
      
      // Verificar se já existe uma revisão para o mesmo deck e nova data
      const existingReview = await programmedReviewService.findExistingReview(
        userId, 
        programmedReview.deckId, 
        newDate,
        reviewId
      );
      
      if (existingReview) {
        throw new AppError('Já existe uma revisão programada para este deck nesta data', 409);
      }
      
      // Se a revisão foi concluída ou pulada, criar uma nova revisão
      if (programmedReview.status !== ReviewStatus.PENDING) {
        const newProgrammedReviewData = {
          userId,
          deckId: programmedReview.deckId,
          deck: programmedReview.deck,
          scheduledDate: newDate,
          title: programmedReview.title,
          description: programmedReview.description,
          status: ReviewStatus.PENDING,
          reminderEnabled: programmedReview.reminderEnabled,
          reminderTime: programmedReview.reminderTime,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          skippedAt: null,
          score: null,
          timeSpent: null,
          cardsReviewed: null
        };
        
        const newProgrammedReview = await programmedReviewService.createProgrammedReview(newProgrammedReviewData);
        
        res.status(201).json({
          success: true,
          message: 'Nova revisão programada criada com sucesso',
          data: newProgrammedReview
        });
      } else {
        // Se a revisão ainda está pendente, apenas atualizar a data
        const programmedReviewData = {
          scheduledDate: newDate,
          updatedAt: now
        };
        
        const updatedProgrammedReview = await programmedReviewService.updateProgrammedReview(reviewId, programmedReviewData);
        
        res.status(200).json({
          success: true,
          message: 'Revisão programada reagendada com sucesso',
          data: updatedProgrammedReview
        });
      }
    } catch (error: any) {
      console.error(`Erro ao reagendar revisão programada ID ${req.params.reviewId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao reagendar revisão programada'
      });
    }
  }

  /**
   * Obtém as revisões programadas para hoje
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getTodayReviews(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const programmedReviews = await programmedReviewService.getTodayReviews(userId);
      
      res.status(200).json({
        success: true,
        data: programmedReviews
      });
    } catch (error: any) {
      console.error(`Erro ao obter revisões programadas para hoje do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter revisões programadas para hoje'
      });
    }
  }

  /**
   * Obtém as próximas revisões programadas
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUpcomingReviews(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const programmedReviews = await programmedReviewService.getUpcomingReviews(userId, days, limit);
      
      res.status(200).json({
        success: true,
        data: programmedReviews
      });
    } catch (error: any) {
      console.error(`Erro ao obter próximas revisões programadas do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter próximas revisões programadas'
      });
    }
  }

  /**
   * Obtém estatísticas das revisões programadas
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getProgrammedReviewStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const statistics = await programmedReviewService.getProgrammedReviewStatistics(userId, startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas de revisões programadas do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de revisões programadas'
      });
    }
  }

  /**
   * Cria revisões programadas em lote para um deck
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createBatchProgrammedReviews(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        deckId, 
        startDate, 
        endDate, 
        frequency, 
        daysOfWeek,
        title, 
        description, 
        reminderEnabled,
        reminderTime
      } = req.body;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o usuário tem acesso ao deck
      if (deck.userId !== userId && !deck.isPublic) {
        throw new AppError('Você não tem permissão para acessar este deck', 403);
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Verificar se as datas são válidas
      const now = new Date();
      if (start < now) {
        throw new AppError('A data de início deve ser no futuro', 400);
      }
      
      if (end <= start) {
        throw new AppError('A data de término deve ser posterior à data de início', 400);
      }
      
      // Verificar a frequência
      if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
        throw new AppError('Para frequência semanal, é necessário especificar os dias da semana', 400);
      }
      
      const programmedReviews = await programmedReviewService.createBatchProgrammedReviews(
        userId,
        deck,
        start,
        end,
        frequency,
        daysOfWeek,
        title,
        description,
        reminderEnabled,
        reminderTime
      );
      
      res.status(201).json({
        success: true,
        message: `${programmedReviews.length} revisões programadas criadas com sucesso`,
        data: programmedReviews
      });
    } catch (error: any) {
      console.error('Erro ao criar revisões programadas em lote:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar revisões programadas em lote'
      });
    }
  }
}

export default new ProgrammedReviewController();