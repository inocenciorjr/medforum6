import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as flashcardService from '../../services/firebaseFlashcardService';
import * as userFlashcardInteractionService from '../../services/firebaseUserFlashcardInteractionService';
import * as deckService from '../../services/firebaseDeckService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a flashcards
 *
 * Responsável por gerenciar flashcards, interações do usuário com flashcards,
 * e estatísticas de estudo.
 */
class FlashcardController {
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
   * Obtém todos os flashcards de um deck
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFlashcardsByDeck(req: Request, res: Response): Promise<void> {
    try {
      const { deckId } = req.params;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o deck é privado e o usuário tem acesso
      if (deck.isPrivate) {
        const userId = req.user?.id;
        if (!userId || (deck.createdBy !== userId && req.user?.role !== UserRole.ADMIN)) {
          throw new AppError('Acesso negado a este deck', 403);
        }
      }
      
      const flashcards = await flashcardService.getFlashcardsByDeck(deckId);
      
      res.status(200).json({
        success: true,
        data: flashcards
      });
    } catch (error: any) {
      console.error(`Erro ao obter flashcards do deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter flashcards'
      });
    }
  }

  /**
   * Obtém um flashcard específico pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFlashcardById(req: Request, res: Response): Promise<void> {
    try {
      const { flashcardId } = req.params;
      
      const flashcard = await flashcardService.getFlashcardById(flashcardId);
      
      if (!flashcard) {
        throw new AppError('Flashcard não encontrado', 404);
      }
      
      // Verificar se o usuário tem acesso ao flashcard (se o deck for privado)
      const deck = await deckService.getDeckById(flashcard.deckId);
      if (deck?.isPrivate) {
        const userId = req.user?.id;
        if (!userId || (deck.createdBy !== userId && req.user?.role !== UserRole.ADMIN)) {
          throw new AppError('Acesso negado a este flashcard', 403);
        }
      }
      
      res.status(200).json({
        success: true,
        data: flashcard
      });
    } catch (error: any) {
      console.error(`Erro ao obter flashcard ID ${req.params.flashcardId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter flashcard'
      });
    }
  }

  /**
   * Cria um novo flashcard
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createFlashcard(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      const flashcardData = req.body;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para adicionar flashcards ao deck
      if (deck.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para adicionar flashcards a este deck', 403);
      }
      
      // Adicionar deckId ao flashcardData
      const newFlashcardData = {
        ...flashcardData,
        deckId,
        createdBy: userId
      };
      
      const newFlashcard = await flashcardService.createFlashcard(newFlashcardData);
      
      res.status(201).json({
        success: true,
        message: 'Flashcard criado com sucesso',
        data: newFlashcard
      });
    } catch (error: any) {
      console.error('Erro ao criar flashcard:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar flashcard'
      });
    }
  }

  /**
   * Atualiza um flashcard existente
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateFlashcard(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { flashcardId } = req.params;
      const flashcardData = req.body;
      
      // Verificar se o flashcard existe
      const existingFlashcard = await flashcardService.getFlashcardById(flashcardId);
      if (!existingFlashcard) {
        throw new AppError('Flashcard não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para atualizar o flashcard
      if (existingFlashcard.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar este flashcard', 403);
      }
      
      const updatedFlashcard = await flashcardService.updateFlashcard(flashcardId, flashcardData);
      
      res.status(200).json({
        success: true,
        message: 'Flashcard atualizado com sucesso',
        data: updatedFlashcard
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar flashcard ID ${req.params.flashcardId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar flashcard'
      });
    }
  }

  /**
   * Exclui um flashcard
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteFlashcard(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { flashcardId } = req.params;
      
      // Verificar se o flashcard existe
      const existingFlashcard = await flashcardService.getFlashcardById(flashcardId);
      if (!existingFlashcard) {
        throw new AppError('Flashcard não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para excluir o flashcard
      if (existingFlashcard.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir este flashcard', 403);
      }
      
      await flashcardService.deleteFlashcard(flashcardId);
      
      res.status(200).json({
        success: true,
        message: 'Flashcard excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir flashcard ID ${req.params.flashcardId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir flashcard'
      });
    }
  }

  /**
   * Registra uma interação do usuário com um flashcard
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async recordFlashcardInteraction(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { flashcardId } = req.params;
      const { difficulty, timeSpentMs, isCorrect } = req.body;
      
      // Verificar se o flashcard existe
      const flashcard = await flashcardService.getFlashcardById(flashcardId);
      if (!flashcard) {
        throw new AppError('Flashcard não encontrado', 404);
      }
      
      await userFlashcardInteractionService.recordInteraction(userId, flashcardId, {
        difficulty,
        timeSpentMs,
        isCorrect
      });
      
      res.status(200).json({
        success: true,
        message: 'Interação registrada com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao registrar interação com flashcard ID ${req.params.flashcardId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao registrar interação'
      });
    }
  }

  /**
   * Obtém o histórico de interações do usuário com um flashcard
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFlashcardInteractionHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { flashcardId } = req.params;
      
      // Verificar se o flashcard existe
      const flashcard = await flashcardService.getFlashcardById(flashcardId);
      if (!flashcard) {
        throw new AppError('Flashcard não encontrado', 404);
      }
      
      const interactions = await userFlashcardInteractionService.getInteractionHistory(userId, flashcardId);
      
      res.status(200).json({
        success: true,
        data: interactions
      });
    } catch (error: any) {
      console.error(`Erro ao obter histórico de interações com flashcard ID ${req.params.flashcardId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter histórico de interações'
      });
    }
  }

  /**
   * Obtém flashcards para revisão com base no algoritmo de repetição espaçada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFlashcardsForReview(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o deck é privado e o usuário tem acesso
      if (deck.isPrivate) {
        if (deck.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
          throw new AppError('Acesso negado a este deck', 403);
        }
      }
      
      const flashcardsForReview = await flashcardService.getFlashcardsForReview(userId, deckId, limit);
      
      res.status(200).json({
        success: true,
        data: flashcardsForReview
      });
    } catch (error: any) {
      console.error(`Erro ao obter flashcards para revisão do deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter flashcards para revisão'
      });
    }
  }

  /**
   * Obtém estatísticas de estudo do usuário para um deck específico
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDeckStudyStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      
      // Verificar se o deck existe
      const deck = await deckService.getDeckById(deckId);
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      const statistics = await userFlashcardInteractionService.getDeckStudyStatistics(userId, deckId);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas de estudo do deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de estudo'
      });
    }
  }
}

export default new FlashcardController();