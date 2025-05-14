import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as simulatedExamService from '../../services/firebaseSimulatedExamService';
import * as questionService from '../../services/firebaseQuestionService';
import * as errorNotebookService from '../../services/firebaseErrorNotebookService';
import * as userService from '../../services/firebaseUserService';
import { AppError } from '../../utils/errors';
import { UserRole, SimulatedExamStatus } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a simulados
 *
 * Responsável por gerenciar simulados, incluindo criação, atualização, exclusão e consulta
 */
class SimulatedExamController {
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
   * Cria um novo simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        title, 
        description, 
        duration, 
        questionCount, 
        categories,
        difficulty,
        isPublic,
        tags
      } = req.body;
      
      // Verificar se o usuário existe
      const user = await userService.getUserById(userId);
      if (!user) {
        throw new AppError('Usuário não encontrado', 404);
      }
      
      // Verificar se há questões suficientes nas categorias selecionadas
      const availableQuestions = await questionService.countQuestionsByCategories(categories);
      if (availableQuestions < questionCount) {
        throw new AppError(`Não há questões suficientes nas categorias selecionadas. Disponíveis: ${availableQuestions}, Solicitadas: ${questionCount}`, 400);
      }
      
      const simulatedExamData = {
        userId,
        title,
        description: description || '',
        duration: duration || 120, // Duração padrão de 2 horas em minutos
        questionCount,
        categories: categories || [],
        difficulty: difficulty || 'medium',
        isPublic: isPublic !== false,
        tags: tags || [],
        status: SimulatedExamStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
        questions: [],
        attempts: 0,
        averageScore: 0,
        completionRate: 0,
        ratings: [],
        averageRating: 0
      };
      
      const simulatedExam = await simulatedExamService.createSimulatedExam(simulatedExamData);
      
      // Selecionar questões aleatórias das categorias selecionadas
      const questions = await questionService.getRandomQuestionsByCategories(
        categories, 
        questionCount, 
        difficulty
      );
      
      // Adicionar questões ao simulado
      await simulatedExamService.addQuestionsToSimulatedExam(simulatedExam.id, questions);
      
      // Obter o simulado atualizado com as questões
      const updatedSimulatedExam = await simulatedExamService.getSimulatedExamById(simulatedExam.id);
      
      res.status(201).json({
        success: true,
        message: 'Simulado criado com sucesso',
        data: updatedSimulatedExam
      });
    } catch (error: any) {
      console.error('Erro ao criar simulado:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar simulado'
      });
    }
  }

  /**
   * Obtém um simulado pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getSimulatedExamById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para acessar o simulado
      if (simulatedExam.userId !== userId && !simulatedExam.isPublic && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este simulado', 403);
      }
      
      res.status(200).json({
        success: true,
        data: simulatedExam
      });
    } catch (error: any) {
      console.error(`Erro ao obter simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter simulado'
      });
    }
  }

  /**
   * Atualiza um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      const { 
        title, 
        description, 
        duration, 
        isPublic,
        tags,
        status
      } = req.body;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário é o dono do simulado ou um administrador
      if (simulatedExam.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar este simulado', 403);
      }
      
      // Verificar se o simulado já foi publicado
      if (simulatedExam.status === SimulatedExamStatus.PUBLISHED && status !== SimulatedExamStatus.PUBLISHED) {
        throw new AppError('Não é possível alterar o status de um simulado já publicado', 400);
      }
      
      const simulatedExamData: any = {
        updatedAt: new Date()
      };
      
      if (title !== undefined) simulatedExamData.title = title;
      if (description !== undefined) simulatedExamData.description = description;
      if (duration !== undefined) simulatedExamData.duration = duration;
      if (isPublic !== undefined) simulatedExamData.isPublic = isPublic;
      if (tags !== undefined) simulatedExamData.tags = tags;
      
      // Se o status estiver sendo alterado para PUBLISHED, definir publishedAt
      if (status === SimulatedExamStatus.PUBLISHED && simulatedExam.status !== SimulatedExamStatus.PUBLISHED) {
        simulatedExamData.status = SimulatedExamStatus.PUBLISHED;
        simulatedExamData.publishedAt = new Date();
      } else if (status !== undefined) {
        simulatedExamData.status = status;
      }
      
      const updatedSimulatedExam = await simulatedExamService.updateSimulatedExam(examId, simulatedExamData);
      
      res.status(200).json({
        success: true,
        message: 'Simulado atualizado com sucesso',
        data: updatedSimulatedExam
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar simulado'
      });
    }
  }

  /**
   * Exclui um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário é o dono do simulado ou um administrador
      if (simulatedExam.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir este simulado', 403);
      }
      
      await simulatedExamService.deleteSimulatedExam(examId);
      
      res.status(200).json({
        success: true,
        message: 'Simulado excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir simulado'
      });
    }
  }

  /**
   * Obtém todos os simulados do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserSimulatedExams(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as SimulatedExamStatus;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      
      const filterOptions = {
        page,
        limit,
        status,
        sortBy,
        sortOrder
      };
      
      const simulatedExams = await simulatedExamService.getUserSimulatedExams(userId, filterOptions);
      
      res.status(200).json({
        success: true,
        data: simulatedExams
      });
    } catch (error: any) {
      console.error(`Erro ao obter simulados do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter simulados'
      });
    }
  }

  /**
   * Obtém simulados públicos
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getPublicSimulatedExams(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string;
      const difficulty = req.query.difficulty as string;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const searchTerm = req.query.search as string;
      
      const filterOptions = {
        page,
        limit,
        category,
        difficulty,
        sortBy,
        sortOrder,
        searchTerm
      };
      
      const simulatedExams = await simulatedExamService.getPublicSimulatedExams(filterOptions);
      
      res.status(200).json({
        success: true,
        data: simulatedExams
      });
    } catch (error: any) {
      console.error('Erro ao obter simulados públicos:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter simulados públicos'
      });
    }
  }

  /**
   * Inicia um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async startSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para acessar o simulado
      if (simulatedExam.userId !== userId && !simulatedExam.isPublic) {
        throw new AppError('Você não tem permissão para acessar este simulado', 403);
      }
      
      // Verificar se o simulado está publicado
      if (simulatedExam.status !== SimulatedExamStatus.PUBLISHED) {
        throw new AppError('Este simulado não está disponível para realização', 400);
      }
      
      // Criar uma tentativa de simulado
      const attemptData = {
        userId,
        simulatedExamId: examId,
        startTime: new Date(),
        endTime: null,
        answers: [],
        score: 0,
        completed: false,
        timeSpent: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const attempt = await simulatedExamService.createSimulatedExamAttempt(attemptData);
      
      // Incrementar o contador de tentativas do simulado
      await simulatedExamService.incrementSimulatedExamAttempts(examId);
      
      res.status(200).json({
        success: true,
        message: 'Simulado iniciado com sucesso',
        data: {
          attemptId: attempt.id,
          simulatedExam: {
            id: simulatedExam.id,
            title: simulatedExam.title,
            description: simulatedExam.description,
            duration: simulatedExam.duration,
            questionCount: simulatedExam.questionCount,
            questions: simulatedExam.questions.map(q => ({
              id: q.id,
              text: q.text,
              options: q.options,
              category: q.category,
              difficulty: q.difficulty
            }))
          }
        }
      });
    } catch (error: any) {
      console.error(`Erro ao iniciar simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao iniciar simulado'
      });
    }
  }

  /**
   * Submete respostas para um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async submitSimulatedExamAnswers(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { attemptId } = req.params;
      const { answers, addToErrorNotebook } = req.body;
      
      // Verificar se a tentativa existe
      const attempt = await simulatedExamService.getSimulatedExamAttemptById(attemptId);
      if (!attempt) {
        throw new AppError('Tentativa de simulado não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da tentativa
      if (attempt.userId !== userId) {
        throw new AppError('Você não tem permissão para submeter respostas para esta tentativa', 403);
      }
      
      // Verificar se a tentativa já foi concluída
      if (attempt.completed) {
        throw new AppError('Esta tentativa já foi concluída', 400);
      }
      
      // Obter o simulado
      const simulatedExam = await simulatedExamService.getSimulatedExamById(attempt.simulatedExamId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Calcular o tempo gasto
      const startTime = new Date(attempt.startTime);
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60); // em minutos
      
      // Verificar se as respostas estão corretas e calcular a pontuação
      const results = await simulatedExamService.evaluateSimulatedExamAnswers(
        simulatedExam.questions, 
        answers
      );
      
      // Atualizar a tentativa
      const attemptData = {
        endTime,
        answers,
        score: results.score,
        completed: true,
        timeSpent,
        updatedAt: new Date()
      };
      
      const updatedAttempt = await simulatedExamService.updateSimulatedExamAttempt(attemptId, attemptData);
      
      // Atualizar estatísticas do simulado
      await simulatedExamService.updateSimulatedExamStatistics(attempt.simulatedExamId);
      
      // Adicionar questões erradas ao caderno de erros, se solicitado
      if (addToErrorNotebook) {
        const wrongAnswers = results.questionResults.filter(result => !result.isCorrect);
        
        for (const wrongAnswer of wrongAnswers) {
          const question = simulatedExam.questions.find(q => q.id === wrongAnswer.questionId);
          if (question) {
            await errorNotebookService.addErrorEntry({
              userId,
              questionId: question.id,
              questionText: question.text,
              questionOptions: question.options,
              correctAnswer: question.correctAnswer,
              userAnswer: wrongAnswer.userAnswer,
              category: question.category,
              difficulty: question.difficulty,
              source: `Simulado: ${simulatedExam.title}`,
              notes: '',
              createdAt: new Date(),
              updatedAt: new Date(),
              lastReviewedAt: null,
              nextReviewDate: null,
              reviewCount: 0,
              mastered: false,
              archived: false
            });
          }
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Respostas submetidas com sucesso',
        data: {
          attempt: updatedAttempt,
          results: {
            score: results.score,
            totalQuestions: simulatedExam.questionCount,
            correctAnswers: results.correctCount,
            wrongAnswers: results.wrongCount,
            timeSpent,
            questionResults: results.questionResults
          }
        }
      });
    } catch (error: any) {
      console.error(`Erro ao submeter respostas para tentativa ID ${req.params.attemptId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao submeter respostas'
      });
    }
  }

  /**
   * Obtém o resultado de uma tentativa de simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getSimulatedExamAttemptResult(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { attemptId } = req.params;
      
      // Verificar se a tentativa existe
      const attempt = await simulatedExamService.getSimulatedExamAttemptById(attemptId);
      if (!attempt) {
        throw new AppError('Tentativa de simulado não encontrada', 404);
      }
      
      // Verificar se o usuário é o dono da tentativa ou um administrador
      if (attempt.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta tentativa', 403);
      }
      
      // Verificar se a tentativa foi concluída
      if (!attempt.completed) {
        throw new AppError('Esta tentativa ainda não foi concluída', 400);
      }
      
      // Obter o simulado
      const simulatedExam = await simulatedExamService.getSimulatedExamById(attempt.simulatedExamId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Obter os resultados detalhados
      const results = await simulatedExamService.getSimulatedExamAttemptResults(attemptId);
      
      res.status(200).json({
        success: true,
        data: {
          attempt,
          simulatedExam: {
            id: simulatedExam.id,
            title: simulatedExam.title,
            description: simulatedExam.description,
            questionCount: simulatedExam.questionCount,
            duration: simulatedExam.duration,
            categories: simulatedExam.categories,
            difficulty: simulatedExam.difficulty
          },
          results
        }
      });
    } catch (error: any) {
      console.error(`Erro ao obter resultado da tentativa ID ${req.params.attemptId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter resultado da tentativa'
      });
    }
  }

  /**
   * Obtém todas as tentativas de simulado do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserSimulatedExamAttempts(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const simulatedExamId = req.query.simulatedExamId as string;
      const completed = req.query.completed === 'true';
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      
      const filterOptions = {
        page,
        limit,
        simulatedExamId,
        completed,
        sortBy,
        sortOrder
      };
      
      const attempts = await simulatedExamService.getUserSimulatedExamAttempts(userId, filterOptions);
      
      res.status(200).json({
        success: true,
        data: attempts
      });
    } catch (error: any) {
      console.error(`Erro ao obter tentativas de simulado do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter tentativas de simulado'
      });
    }
  }

  /**
   * Avalia um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async rateSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      const { rating, comment } = req.body;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário já avaliou este simulado
      const existingRating = simulatedExam.ratings?.find(r => r.userId === userId);
      if (existingRating) {
        throw new AppError('Você já avaliou este simulado', 400);
      }
      
      // Adicionar avaliação
      const ratingData = {
        userId,
        rating,
        comment: comment || '',
        createdAt: new Date()
      };
      
      await simulatedExamService.addSimulatedExamRating(examId, ratingData);
      
      // Atualizar média de avaliações
      await simulatedExamService.updateSimulatedExamAverageRating(examId);
      
      res.status(200).json({
        success: true,
        message: 'Simulado avaliado com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao avaliar simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao avaliar simulado'
      });
    }
  }

  /**
   * Obtém estatísticas de simulados do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserSimulatedExamStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const statistics = await simulatedExamService.getUserSimulatedExamStatistics(userId, startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error(`Erro ao obter estatísticas de simulados do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de simulados'
      });
    }
  }

  /**
   * Exporta um simulado para PDF
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async exportSimulatedExamToPdf(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para acessar o simulado
      if (simulatedExam.userId !== userId && !simulatedExam.isPublic && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este simulado', 403);
      }
      
      // Gerar PDF
      const pdfBuffer = await simulatedExamService.generateSimulatedExamPdf(simulatedExam);
      
      // Configurar cabeçalhos para download do PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=simulado-${examId}.pdf`);
      
      // Enviar o PDF
      res.status(200).send(pdfBuffer);
    } catch (error: any) {
      console.error(`Erro ao exportar simulado ID ${req.params.examId} para PDF:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao exportar simulado para PDF'
      });
    }
  }

  /**
   * Adiciona questões a um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async addQuestionsToSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      const { questionIds } = req.body;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário é o dono do simulado ou um administrador
      if (simulatedExam.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para adicionar questões a este simulado', 403);
      }
      
      // Verificar se o simulado já foi publicado
      if (simulatedExam.status === SimulatedExamStatus.PUBLISHED) {
        throw new AppError('Não é possível adicionar questões a um simulado já publicado', 400);
      }
      
      // Obter as questões
      const questions = await Promise.all(
        questionIds.map((id: string) => questionService.getQuestionById(id))
      );
      
      // Filtrar questões não encontradas
      const validQuestions = questions.filter(q => q !== null);
      
      if (validQuestions.length === 0) {
        throw new AppError('Nenhuma questão válida encontrada', 400);
      }
      
      // Adicionar questões ao simulado
      await simulatedExamService.addQuestionsToSimulatedExam(examId, validQuestions);
      
      // Atualizar o contador de questões
      await simulatedExamService.updateSimulatedExamQuestionCount(examId);
      
      // Obter o simulado atualizado
      const updatedSimulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      
      res.status(200).json({
        success: true,
        message: 'Questões adicionadas com sucesso',
        data: updatedSimulatedExam
      });
    } catch (error: any) {
      console.error(`Erro ao adicionar questões ao simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao adicionar questões ao simulado'
      });
    }
  }

  /**
   * Remove questões de um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async removeQuestionsFromSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      const { questionIds } = req.body;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário é o dono do simulado ou um administrador
      if (simulatedExam.userId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para remover questões deste simulado', 403);
      }
      
      // Verificar se o simulado já foi publicado
      if (simulatedExam.status === SimulatedExamStatus.PUBLISHED) {
        throw new AppError('Não é possível remover questões de um simulado já publicado', 400);
      }
      
      // Remover questões do simulado
      await simulatedExamService.removeQuestionsFromSimulatedExam(examId, questionIds);
      
      // Atualizar o contador de questões
      await simulatedExamService.updateSimulatedExamQuestionCount(examId);
      
      // Obter o simulado atualizado
      const updatedSimulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      
      res.status(200).json({
        success: true,
        message: 'Questões removidas com sucesso',
        data: updatedSimulatedExam
      });
    } catch (error: any) {
      console.error(`Erro ao remover questões do simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao remover questões do simulado'
      });
    }
  }

  /**
   * Duplica um simulado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async duplicateSimulatedExam(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { examId } = req.params;
      
      // Verificar se o simulado existe
      const simulatedExam = await simulatedExamService.getSimulatedExamById(examId);
      if (!simulatedExam) {
        throw new AppError('Simulado não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para acessar o simulado
      if (simulatedExam.userId !== userId && !simulatedExam.isPublic && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para duplicar este simulado', 403);
      }
      
      // Duplicar o simulado
      const duplicatedSimulatedExam = await simulatedExamService.duplicateSimulatedExam(examId, userId);
      
      res.status(201).json({
        success: true,
        message: 'Simulado duplicado com sucesso',
        data: duplicatedSimulatedExam
      });
    } catch (error: any) {
      console.error(`Erro ao duplicar simulado ID ${req.params.examId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao duplicar simulado'
      });
    }
  }
}

export default new SimulatedExamController();