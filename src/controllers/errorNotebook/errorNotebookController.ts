import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as errorNotebookService from '../../services/firebaseErrorNotebookService';
import * as questionService from '../../services/firebaseQuestionService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas ao caderno de erros
 *
 * Responsável por gerenciar o registro e revisão de questões erradas pelos usuários
 */
class ErrorNotebookController {
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
   * Adiciona uma questão ao caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async addErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        questionId, 
        userAnswer, 
        notes, 
        difficulty, 
        source,
        sourceType,
        tags
      } = req.body;
      
      // Verificar se a questão existe
      const question = await questionService.getQuestionById(questionId);
      if (!question) {
        throw new AppError('Questão não encontrada', 404);
      }
      
      // Verificar se a questão já está no caderno de erros do usuário
      const existingEntry = await errorNotebookService.getErrorEntryByQuestionId(userId, questionId);
      if (existingEntry) {
        throw new AppError('Esta questão já está no seu caderno de erros', 409);
      }
      
      const errorEntryData = {
        userId,
        questionId,
        question: {
          id: question.id,
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty
        },
        userAnswer: userAnswer || null,
        notes: notes || '',
        difficulty: difficulty || question.difficulty,
        source: source || 'manual',
        sourceType: sourceType || 'other',
        tags: tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewCount: 0,
        lastReviewedAt: null,
        nextReviewAt: null,
        isArchived: false,
        isMastered: false
      };
      
      const errorEntry = await errorNotebookService.createErrorEntry(errorEntryData);
      
      res.status(201).json({
        success: true,
        message: 'Questão adicionada ao caderno de erros com sucesso',
        data: errorEntry
      });
    } catch (error: any) {
      console.error('Erro ao adicionar questão ao caderno de erros:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao adicionar questão ao caderno de erros'
      });
    }
  }

  /**
   * Obtém uma entrada do caderno de erros pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getErrorEntryById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada ou um administrador
      if (errorEntry.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta entrada', 403);
      }
      
      res.status(200).json({
        success: true,
        data: errorEntry
      });
    } catch (error: any) {
      console.error(`Erro ao obter entrada ID ${req.params.entryId} do caderno de erros:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter entrada do caderno de erros'
      });
    }
  }

  /**
   * Atualiza uma entrada do caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      const { 
        notes, 
        difficulty, 
        tags,
        isArchived,
        isMastered
      } = req.body;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para atualizar esta entrada', 403);
      }
      
      const errorEntryData = {
        notes,
        difficulty,
        tags,
        isArchived,
        isMastered,
        updatedAt: new Date()
      };
      
      const updatedErrorEntry = await errorNotebookService.updateErrorEntry(entryId, errorEntryData);
      
      res.status(200).json({
        success: true,
        message: 'Entrada do caderno de erros atualizada com sucesso',
        data: updatedErrorEntry
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar entrada ID ${req.params.entryId} do caderno de erros:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar entrada do caderno de erros'
      });
    }
  }

  /**
   * Remove uma entrada do caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para remover esta entrada', 403);
      }
      
      await errorNotebookService.deleteErrorEntry(entryId);
      
      res.status(200).json({
        success: true,
        message: 'Entrada removida do caderno de erros com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao remover entrada ID ${req.params.entryId} do caderno de erros:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao remover entrada do caderno de erros'
      });
    }
  }

  /**
   * Obtém todas as entradas do caderno de erros do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserErrorEntries(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const subject = req.query.subject as string;
      const topic = req.query.topic as string;
      const difficulty = req.query.difficulty as string;
      const tag = req.query.tag as string;
      const isArchived = req.query.isArchived === 'true';
      const isMastered = req.query.isMastered === 'true';
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const searchQuery = req.query.search as string;
      
      const filterOptions = {
        page,
        limit,
        subject,
        topic,
        difficulty,
        tag,
        isArchived,
        isMastered,
        sortBy,
        sortOrder,
        searchQuery
      };
      
      const errorEntries = await errorNotebookService.getUserErrorEntries(userId, filterOptions);
      
      res.status(200).json({
        success: true,
        data: errorEntries
      });
    } catch (error: any) {
      console.error(`Erro ao obter entradas do caderno de erros do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter entradas do caderno de erros'
      });
    }
  }

  /**
   * Registra uma revisão de uma entrada do caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async reviewErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      const { 
        result, 
        notes, 
        difficulty 
      } = req.body;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para revisar esta entrada', 403);
      }
      
      // Calcular a próxima data de revisão com base no resultado
      const now = new Date();
      let nextReviewAt = null;
      let isMastered = errorEntry.isMastered;
      
      if (result === 'correct') {
        // Se acertou, aumenta o intervalo de revisão
        const reviewCount = (errorEntry.reviewCount || 0) + 1;
        const daysToAdd = Math.min(Math.pow(2, reviewCount), 60); // Máximo de 60 dias
        
        nextReviewAt = new Date();
        nextReviewAt.setDate(nextReviewAt.getDate() + daysToAdd);
        
        // Se acertou 3 vezes consecutivas, marcar como dominado
        if (reviewCount >= 3) {
          isMastered = true;
        }
      } else {
        // Se errou, reinicia o intervalo de revisão para 1 dia
        nextReviewAt = new Date();
        nextReviewAt.setDate(nextReviewAt.getDate() + 1);
        isMastered = false;
      }
      
      const reviewData = {
        entryId,
        userId,
        result,
        notes: notes || '',
        reviewedAt: now
      };
      
      // Registrar a revisão
      await errorNotebookService.createReviewRecord(reviewData);
      
      // Atualizar a entrada
      const errorEntryData = {
        notes: notes !== undefined ? notes : errorEntry.notes,
        difficulty: difficulty !== undefined ? difficulty : errorEntry.difficulty,
        reviewCount: (errorEntry.reviewCount || 0) + 1,
        lastReviewedAt: now,
        nextReviewAt,
        isMastered,
        updatedAt: now
      };
      
      const updatedErrorEntry = await errorNotebookService.updateErrorEntry(entryId, errorEntryData);
      
      res.status(200).json({
        success: true,
        message: 'Revisão registrada com sucesso',
        data: updatedErrorEntry
      });
    } catch (error: any) {
      console.error(`Erro ao revisar entrada ID ${req.params.entryId} do caderno de erros:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao revisar entrada do caderno de erros'
      });
    }
  }

  /**
   * Obtém o histórico de revisões de uma entrada do caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getErrorEntryReviewHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para acessar o histórico desta entrada', 403);
      }
      
      const reviewHistory = await errorNotebookService.getErrorEntryReviewHistory(entryId);
      
      res.status(200).json({
        success: true,
        data: reviewHistory
      });
    } catch (error: any) {
      console.error(`Erro ao obter histórico de revisões da entrada ID ${req.params.entryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter histórico de revisões'
      });
    }
  }

  /**
   * Arquiva ou desarquiva uma entrada do caderno de erros
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async toggleArchiveErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      const { isArchived } = req.body;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para arquivar/desarquivar esta entrada', 403);
      }
      
      const errorEntryData = {
        isArchived,
        updatedAt: new Date()
      };
      
      const updatedErrorEntry = await errorNotebookService.updateErrorEntry(entryId, errorEntryData);
      
      res.status(200).json({
        success: true,
        message: isArchived ? 'Entrada arquivada com sucesso' : 'Entrada desarquivada com sucesso',
        data: updatedErrorEntry
      });
    } catch (error: any) {
      console.error(`Erro ao arquivar/desarquivar entrada ID ${req.params.entryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao arquivar/desarquivar entrada'
      });
    }
  }

  /**
   * Marca ou desmarca uma entrada do caderno de erros como dominada
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async toggleMasteredErrorEntry(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { entryId } = req.params;
      const { isMastered } = req.body;
      
      // Verificar se a entrada existe
      const errorEntry = await errorNotebookService.getErrorEntryById(entryId);
      if (!errorEntry) {
        throw new AppError('Entrada não encontrada no caderno de erros', 404);
      }
      
      // Verificar se o usuário é o dono da entrada
      if (errorEntry.userId !== userId) {
        throw new AppError('Você não tem permissão para marcar/desmarcar esta entrada como dominada', 403);
      }
      
      const errorEntryData = {
        isMastered,
        updatedAt: new Date()
      };
      
      const updatedErrorEntry = await errorNotebookService.updateErrorEntry(entryId, errorEntryData);
      
      res.status(200).json({
        success: true,
        message: isMastered ? 'Entrada marcada como dominada com sucesso' : 'Entrada desmarcada como dominada com sucesso',
        data: updatedErrorEntry
      });
    } catch (error: any) {
      console.error(`Erro ao marcar/desmarcar entrada ID ${req.params.entryId} como dominada:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao marcar/desmarcar entrada como dominada'
      });
    }
  }

  /**
   * Obtém as entradas do caderno de erros que precisam ser revisadas hoje
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getDueReviews(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const limit = parseInt(req.query.limit as string) || 10;
      const subject = req.query.subject as string;
      const topic = req.query.topic as string;
      
      const filterOptions = {
        limit,
        subject,
        topic
      };
      
      const dueEntries = await errorNotebookService.getDueReviews(userId, filterOptions);
      
      res.status(200).json({
        success: true,
        data: dueEntries
      });
    } catch (error: any) {
      console.error(`Erro ao obter revisões pendentes do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter revisões pendentes'
      });
    }
  }

  /**
   * Obtém estatísticas do caderno de erros do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getErrorNotebookStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const statistics = await errorNotebookService.getErrorNotebookStatistics(userId);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas do caderno de erros do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas do caderno de erros'
      });
    }
  }

  /**
   * Importa questões para o caderno de erros a partir de um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async importFromSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { examId, questionIds } = req.body;
      
      if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        throw new AppError('É necessário fornecer pelo menos um ID de questão', 400);
      }
      
      const importedEntries = await errorNotebookService.importFromSimulatedExam(userId, examId, questionIds);
      
      res.status(200).json({
        success: true,
        message: `${importedEntries.length} questões importadas com sucesso para o caderno de erros`,
        data: importedEntries
      });
    } catch (error: any) {
      console.error(`Erro ao importar questões do simulado ID ${req.body.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao importar questões para o caderno de erros'
      });
    }
  }

  /**
   * Exporta o caderno de erros para PDF
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async exportToPdf(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const subject = req.query.subject as string;
      const topic = req.query.topic as string;
      const difficulty = req.query.difficulty as string;
      const tag = req.query.tag as string;
      const isArchived = req.query.isArchived === 'true';
      const isMastered = req.query.isMastered === 'true';
      
      const filterOptions = {
        subject,
        topic,
        difficulty,
        tag,
        isArchived,
        isMastered
      };
      
      const pdfBuffer = await errorNotebookService.exportToPdf(userId, filterOptions);
      
      // Configurar cabeçalhos para download do PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=caderno-de-erros.pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.status(200).send(pdfBuffer);
    } catch (error: any) {
      console.error(`Erro ao exportar caderno de erros do usuário ID ${req.user?.id} para PDF:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao exportar caderno de erros para PDF'
      });
    }
  }
}

export default new ErrorNotebookController();