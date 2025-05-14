import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as deckService from '../../services/firebaseDeckService';
import * as flashcardService from '../../services/firebaseFlashcardService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a decks de flashcards
 *
 * Responsável por gerenciar decks, categorias, tags e permissões.
 */
class DeckController {
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
   * Obtém todos os decks públicos ou do usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllDecks(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string | undefined;
      const tag = req.query.tag as string | undefined;
      const searchTerm = req.query.search as string | undefined;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
      const includePrivate = req.query.includePrivate === 'true' && userId ? true : false;
      
      const decks = await deckService.getAllDecks(page, limit, {
        userId,
        category,
        tag,
        searchTerm,
        sortBy,
        sortOrder,
        includePrivate
      });
      
      res.status(200).json({
        success: true,
        data: decks
      });
    } catch (error: any) {
      console.error('Erro ao obter decks:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter decks'
      });
    }
  }

  /**
   * Obtém um deck específico pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDeckById(req: Request, res: Response): Promise<void> {
    try {
      const { deckId } = req.params;
      const userId = req.user?.id;
      
      const deck = await deckService.getDeckById(deckId);
      
      if (!deck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o deck é privado e o usuário tem acesso
      if (deck.isPrivate) {
        if (!userId || (deck.createdBy !== userId && req.user?.role !== UserRole.ADMIN)) {
          throw new AppError('Acesso negado a este deck', 403);
        }
      }
      
      // Obter contagem de flashcards
      const flashcardCount = await flashcardService.getFlashcardCountByDeck(deckId);
      
      // Adicionar contagem de flashcards ao objeto do deck
      const deckWithCount = {
        ...deck,
        flashcardCount
      };
      
      res.status(200).json({
        success: true,
        data: deckWithCount
      });
    } catch (error: any) {
      console.error(`Erro ao obter deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter deck'
      });
    }
  }

  /**
   * Cria um novo deck
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createDeck(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const deckData = req.body;
      
      // Adicionar createdBy ao deckData
      const newDeckData = {
        ...deckData,
        createdBy: userId
      };
      
      const newDeck = await deckService.createDeck(newDeckData);
      
      res.status(201).json({
        success: true,
        message: 'Deck criado com sucesso',
        data: newDeck
      });
    } catch (error: any) {
      console.error('Erro ao criar deck:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar deck'
      });
    }
  }

  /**
   * Atualiza um deck existente
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateDeck(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      const deckData = req.body;
      
      // Verificar se o deck existe
      const existingDeck = await deckService.getDeckById(deckId);
      if (!existingDeck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para atualizar o deck
      if (existingDeck.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar este deck', 403);
      }
      
      const updatedDeck = await deckService.updateDeck(deckId, deckData);
      
      res.status(200).json({
        success: true,
        message: 'Deck atualizado com sucesso',
        data: updatedDeck
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar deck'
      });
    }
  }

  /**
   * Exclui um deck
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteDeck(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      
      // Verificar se o deck existe
      const existingDeck = await deckService.getDeckById(deckId);
      if (!existingDeck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para excluir o deck
      if (existingDeck.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir este deck', 403);
      }
      
      // Excluir todos os flashcards do deck
      await flashcardService.deleteFlashcardsByDeck(deckId);
      
      // Excluir o deck
      await deckService.deleteDeck(deckId);
      
      res.status(200).json({
        success: true,
        message: 'Deck e todos os flashcards associados excluídos com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir deck'
      });
    }
  }

  /**
   * Obtém todos os decks criados pelo usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMyDecks(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string | undefined;
      const tag = req.query.tag as string | undefined;
      const searchTerm = req.query.search as string | undefined;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
      
      const decks = await deckService.getDecksByUser(userId, page, limit, {
        category,
        tag,
        searchTerm,
        sortBy,
        sortOrder
      });
      
      res.status(200).json({
        success: true,
        data: decks
      });
    } catch (error: any) {
      console.error('Erro ao obter decks do usuário:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter decks do usuário'
      });
    }
  }

  /**
   * Obtém todas as categorias de decks disponíveis
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDeckCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await deckService.getDeckCategories();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      console.error('Erro ao obter categorias de decks:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter categorias de decks'
      });
    }
  }

  /**
   * Obtém todas as tags de decks disponíveis
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDeckTags(req: Request, res: Response): Promise<void> {
    try {
      const tags = await deckService.getDeckTags();
      
      res.status(200).json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      console.error('Erro ao obter tags de decks:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tags de decks'
      });
    }
  }

  /**
   * Duplica um deck existente para o usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async duplicateDeck(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { deckId } = req.params;
      const { title, description, isPrivate } = req.body;
      
      // Verificar se o deck existe
      const existingDeck = await deckService.getDeckById(deckId);
      if (!existingDeck) {
        throw new AppError('Deck não encontrado', 404);
      }
      
      // Verificar se o deck é privado e o usuário tem acesso
      if (existingDeck.isPrivate) {
        if (existingDeck.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
          throw new AppError('Acesso negado a este deck', 403);
        }
      }
      
      // Duplicar o deck e seus flashcards
      const duplicatedDeck = await deckService.duplicateDeck(deckId, userId, {
        title,
        description,
        isPrivate
      });
      
      res.status(201).json({
        success: true,
        message: 'Deck duplicado com sucesso',
        data: duplicatedDeck
      });
    } catch (error: any) {
      console.error(`Erro ao duplicar deck ID ${req.params.deckId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao duplicar deck'
      });
    }
  }
}

export default new DeckController();