import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as mentorshipService from '../../services/firebaseMentorshipService';
import * as userService from '../../services/firebaseUserService';
import { AppError } from '../../utils/errors';
import { UserRole, MentorshipStatus } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a mentorias
 *
 * Responsável por gerenciar mentorias entre mentores e alunos
 */
class MentorshipController {
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
   * Cria uma nova solicitação de mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async requestMentorship(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const studentId = this.getAuthenticatedUserId(req);
      const { mentorId, message, subjectIds } = req.body;
      
      // Verificar se o mentor existe e é um mentor
      const mentor = await userService.getUserById(mentorId);
      if (!mentor) {
        throw new AppError('Mentor não encontrado', 404);
      }
      
      if (mentor.role !== UserRole.MENTOR) {
        throw new AppError('O usuário selecionado não é um mentor', 400);
      }
      
      // Verificar se o estudante não está tentando solicitar mentoria para si mesmo
      if (studentId === mentorId) {
        throw new AppError('Você não pode solicitar mentoria para si mesmo', 400);
      }
      
      // Verificar se já existe uma mentoria ativa ou pendente entre o estudante e o mentor
      const existingMentorship = await mentorshipService.getMentorshipByStudentAndMentor(studentId, mentorId);
      if (existingMentorship && (existingMentorship.status === MentorshipStatus.ACTIVE || existingMentorship.status === MentorshipStatus.PENDING)) {
        throw new AppError('Já existe uma mentoria ativa ou pendente com este mentor', 409);
      }
      
      // Verificar se os assuntos existem
      if (subjectIds && subjectIds.length > 0) {
        const validSubjectIds = await mentorshipService.validateSubjectIds(subjectIds);
        if (validSubjectIds.length !== subjectIds.length) {
          throw new AppError('Um ou mais IDs de assuntos são inválidos', 400);
        }
      }
      
      const mentorshipData = {
        studentId,
        mentorId,
        message: message || '',
        subjectIds: subjectIds || [],
        status: MentorshipStatus.PENDING,
        createdAt: new Date()
      };
      
      const mentorship = await mentorshipService.createMentorship(mentorshipData);
      
      // Notificar o mentor sobre a nova solicitação
      await mentorshipService.notifyMentorshipRequest(mentorship);
      
      res.status(201).json({
        success: true,
        message: 'Solicitação de mentoria enviada com sucesso',
        data: mentorship
      });
    } catch (error: any) {
      console.error('Erro ao solicitar mentoria:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao solicitar mentoria'
      });
    }
  }

  /**
   * Aceita uma solicitação de mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async acceptMentorship(req: Request, res: Response): Promise<void> {
    try {
      const mentorId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor da mentoria
      if (mentorship.mentorId !== mentorId) {
        throw new AppError('Você não tem permissão para aceitar esta mentoria', 403);
      }
      
      // Verificar se a mentoria está pendente
      if (mentorship.status !== MentorshipStatus.PENDING) {
        throw new AppError('Esta mentoria não está pendente', 400);
      }
      
      const updatedMentorship = await mentorshipService.updateMentorshipStatus(mentorshipId, MentorshipStatus.ACTIVE);
      
      // Notificar o estudante que a mentoria foi aceita
      await mentorshipService.notifyMentorshipAccepted(updatedMentorship);
      
      res.status(200).json({
        success: true,
        message: 'Mentoria aceita com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao aceitar mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao aceitar mentoria'
      });
    }
  }

  /**
   * Rejeita uma solicitação de mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async rejectMentorship(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const mentorId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      const { reason } = req.body;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor da mentoria
      if (mentorship.mentorId !== mentorId) {
        throw new AppError('Você não tem permissão para rejeitar esta mentoria', 403);
      }
      
      // Verificar se a mentoria está pendente
      if (mentorship.status !== MentorshipStatus.PENDING) {
        throw new AppError('Esta mentoria não está pendente', 400);
      }
      
      const updatedMentorship = await mentorshipService.rejectMentorship(mentorshipId, reason);
      
      // Notificar o estudante que a mentoria foi rejeitada
      await mentorshipService.notifyMentorshipRejected(updatedMentorship);
      
      res.status(200).json({
        success: true,
        message: 'Mentoria rejeitada com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao rejeitar mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao rejeitar mentoria'
      });
    }
  }

  /**
   * Cancela uma mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async cancelMentorship(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      const { reason } = req.body;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da mentoria
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId) {
        throw new AppError('Você não tem permissão para cancelar esta mentoria', 403);
      }
      
      // Verificar se a mentoria está ativa ou pendente
      if (mentorship.status !== MentorshipStatus.ACTIVE && mentorship.status !== MentorshipStatus.PENDING) {
        throw new AppError('Esta mentoria não pode ser cancelada', 400);
      }
      
      const isMentor = mentorship.mentorId === userId;
      const updatedMentorship = await mentorshipService.cancelMentorship(mentorshipId, reason, isMentor);
      
      // Notificar a outra parte que a mentoria foi cancelada
      await mentorshipService.notifyMentorshipCancelled(updatedMentorship, isMentor);
      
      res.status(200).json({
        success: true,
        message: 'Mentoria cancelada com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao cancelar mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao cancelar mentoria'
      });
    }
  }

  /**
   * Conclui uma mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async completeMentorship(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      const { feedback, rating } = req.body;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da mentoria
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId) {
        throw new AppError('Você não tem permissão para concluir esta mentoria', 403);
      }
      
      // Verificar se a mentoria está ativa
      if (mentorship.status !== MentorshipStatus.ACTIVE) {
        throw new AppError('Esta mentoria não está ativa', 400);
      }
      
      const isMentor = mentorship.mentorId === userId;
      const updatedMentorship = await mentorshipService.completeMentorship(mentorshipId, feedback, rating, isMentor);
      
      // Notificar a outra parte que a mentoria foi concluída
      await mentorshipService.notifyMentorshipCompleted(updatedMentorship, isMentor);
      
      res.status(200).json({
        success: true,
        message: 'Mentoria concluída com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao concluir mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao concluir mentoria'
      });
    }
  }

  /**
   * Obtém uma mentoria pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMentorshipById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor, o estudante ou um administrador
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta mentoria', 403);
      }
      
      res.status(200).json({
        success: true,
        data: mentorship
      });
    } catch (error: any) {
      console.error(`Erro ao obter mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter mentoria'
      });
    }
  }

  /**
   * Obtém as mentorias do usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserMentorships(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const status = req.query.status as MentorshipStatus | undefined;
      const role = req.query.role as 'mentor' | 'student' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const mentorships = await mentorshipService.getUserMentorships(userId, status, role, page, limit);
      
      res.status(200).json({
        success: true,
        data: mentorships
      });
    } catch (error: any) {
      console.error(`Erro ao obter mentorias do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter mentorias'
      });
    }
  }

  /**
   * Obtém todas as mentorias (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllMentorships(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const status = req.query.status as MentorshipStatus | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const mentorships = await mentorshipService.getAllMentorships(status, page, limit);
      
      res.status(200).json({
        success: true,
        data: mentorships
      });
    } catch (error: any) {
      console.error('Erro ao obter todas as mentorias:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter todas as mentorias'
      });
    }
  }

  /**
   * Obtém os assuntos disponíveis para mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMentorshipSubjects(req: Request, res: Response): Promise<void> {
    try {
      const subjects = await mentorshipService.getMentorshipSubjects();
      
      res.status(200).json({
        success: true,
        data: subjects
      });
    } catch (error: any) {
      console.error('Erro ao obter assuntos para mentoria:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter assuntos para mentoria'
      });
    }
  }

  /**
   * Obtém os mentores disponíveis
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAvailableMentors(req: Request, res: Response): Promise<void> {
    try {
      const subjectId = req.query.subjectId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const mentors = await mentorshipService.getAvailableMentors(subjectId, page, limit);
      
      res.status(200).json({
        success: true,
        data: mentors
      });
    } catch (error: any) {
      console.error('Erro ao obter mentores disponíveis:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter mentores disponíveis'
      });
    }
  }

  /**
   * Adiciona um assunto a uma mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async addSubjectToMentorship(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      const { subjectId } = req.body;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da mentoria
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId) {
        throw new AppError('Você não tem permissão para modificar esta mentoria', 403);
      }
      
      // Verificar se a mentoria está ativa
      if (mentorship.status !== MentorshipStatus.ACTIVE) {
        throw new AppError('Esta mentoria não está ativa', 400);
      }
      
      // Verificar se o assunto existe
      const subjectExists = await mentorshipService.validateSubjectIds([subjectId]);
      if (subjectExists.length === 0) {
        throw new AppError('Assunto não encontrado', 404);
      }
      
      // Verificar se o assunto já está na mentoria
      if (mentorship.subjectIds.includes(subjectId)) {
        throw new AppError('Este assunto já está associado a esta mentoria', 409);
      }
      
      const updatedMentorship = await mentorshipService.addSubjectToMentorship(mentorshipId, subjectId);
      
      res.status(200).json({
        success: true,
        message: 'Assunto adicionado à mentoria com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao adicionar assunto à mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao adicionar assunto à mentoria'
      });
    }
  }

  /**
   * Remove um assunto de uma mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async removeSubjectFromMentorship(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId, subjectId } = req.params;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da mentoria
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId) {
        throw new AppError('Você não tem permissão para modificar esta mentoria', 403);
      }
      
      // Verificar se a mentoria está ativa
      if (mentorship.status !== MentorshipStatus.ACTIVE) {
        throw new AppError('Esta mentoria não está ativa', 400);
      }
      
      // Verificar se o assunto está na mentoria
      if (!mentorship.subjectIds.includes(subjectId)) {
        throw new AppError('Este assunto não está associado a esta mentoria', 404);
      }
      
      // Verificar se é o último assunto
      if (mentorship.subjectIds.length === 1) {
        throw new AppError('Não é possível remover o último assunto da mentoria', 400);
      }
      
      const updatedMentorship = await mentorshipService.removeSubjectFromMentorship(mentorshipId, subjectId);
      
      res.status(200).json({
        success: true,
        message: 'Assunto removido da mentoria com sucesso',
        data: updatedMentorship
      });
    } catch (error: any) {
      console.error(`Erro ao remover assunto da mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao remover assunto da mentoria'
      });
    }
  }
}

export default new MentorshipController();