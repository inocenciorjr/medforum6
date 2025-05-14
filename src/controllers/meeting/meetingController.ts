import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as meetingService from '../../services/firebaseMeetingService';
import * as mentorshipService from '../../services/firebaseMentorshipService';
import { AppError } from '../../utils/errors';
import { UserRole, MeetingStatus } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a reuniões de mentoria
 *
 * Responsável por gerenciar reuniões entre mentores e alunos
 */
class MeetingController {
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
   * Cria uma nova reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createMeeting(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { 
        mentorshipId, 
        title, 
        description, 
        startTime, 
        endTime, 
        meetingUrl, 
        meetingType,
        agenda
      } = req.body;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da mentoria
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId) {
        throw new AppError('Você não tem permissão para criar reuniões para esta mentoria', 403);
      }
      
      // Verificar se a mentoria está ativa
      if (mentorship.status !== 'active') {
        throw new AppError('Não é possível criar reuniões para uma mentoria que não está ativa', 400);
      }
      
      // Verificar se o horário de início é posterior ao horário atual
      const now = new Date();
      const start = new Date(startTime);
      if (start <= now) {
        throw new AppError('O horário de início deve ser no futuro', 400);
      }
      
      // Verificar se o horário de término é posterior ao horário de início
      const end = new Date(endTime);
      if (end <= start) {
        throw new AppError('O horário de término deve ser posterior ao horário de início', 400);
      }
      
      // Verificar se há conflito com outras reuniões do mentor ou do estudante
      const hasConflict = await meetingService.checkMeetingConflict(
        mentorship.mentorId,
        mentorship.studentId,
        start,
        end
      );
      
      if (hasConflict) {
        throw new AppError('Existe um conflito de horário com outra reunião', 409);
      }
      
      const isMentor = mentorship.mentorId === userId;
      
      const meetingData = {
        mentorshipId,
        mentorId: mentorship.mentorId,
        studentId: mentorship.studentId,
        title,
        description: description || '',
        startTime: start,
        endTime: end,
        meetingUrl: meetingUrl || null,
        meetingType: meetingType || 'video',
        agenda: agenda || [],
        status: MeetingStatus.SCHEDULED,
        createdBy: userId,
        createdAt: new Date(),
        isMentorConfirmed: isMentor,
        isStudentConfirmed: !isMentor,
        notes: '',
        recordingUrl: null,
        resources: []
      };
      
      const meeting = await meetingService.createMeeting(meetingData);
      
      // Notificar a outra parte sobre a nova reunião
      await meetingService.notifyMeetingCreated(meeting, isMentor);
      
      res.status(201).json({
        success: true,
        message: 'Reunião criada com sucesso',
        data: meeting
      });
    } catch (error: any) {
      console.error('Erro ao criar reunião:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar reunião'
      });
    }
  }

  /**
   * Obtém uma reunião pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMeetingById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      
      const meeting = await meetingService.getMeetingById(meetingId);
      
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor, o estudante ou um administrador
      if (meeting.mentorId !== userId && meeting.studentId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta reunião', 403);
      }
      
      res.status(200).json({
        success: true,
        data: meeting
      });
    } catch (error: any) {
      console.error(`Erro ao obter reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter reunião'
      });
    }
  }

  /**
   * Atualiza uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateMeeting(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      const { 
        title, 
        description, 
        startTime, 
        endTime, 
        meetingUrl, 
        meetingType,
        agenda,
        notes,
        recordingUrl,
        resources
      } = req.body;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor, o estudante ou um administrador
      if (meeting.mentorId !== userId && meeting.studentId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar esta reunião', 403);
      }
      
      // Verificar se a reunião já foi concluída ou cancelada
      if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível atualizar uma reunião que já foi concluída ou cancelada', 400);
      }
      
      let start = meeting.startTime;
      let end = meeting.endTime;
      
      // Se os horários foram alterados, fazer validações adicionais
      if (startTime || endTime) {
        if (startTime) {
          start = new Date(startTime);
          // Verificar se o horário de início é posterior ao horário atual
          const now = new Date();
          if (start <= now) {
            throw new AppError('O horário de início deve ser no futuro', 400);
          }
        }
        
        if (endTime) {
          end = new Date(endTime);
        }
        
        // Verificar se o horário de término é posterior ao horário de início
        if (end <= start) {
          throw new AppError('O horário de término deve ser posterior ao horário de início', 400);
        }
        
        // Verificar se há conflito com outras reuniões do mentor ou do estudante
        const hasConflict = await meetingService.checkMeetingConflict(
          meeting.mentorId,
          meeting.studentId,
          start,
          end,
          meetingId
        );
        
        if (hasConflict) {
          throw new AppError('Existe um conflito de horário com outra reunião', 409);
        }
        
        // Se os horários foram alterados, resetar as confirmações
        if (startTime || endTime) {
          meeting.isMentorConfirmed = meeting.mentorId === userId;
          meeting.isStudentConfirmed = meeting.studentId === userId;
        }
      }
      
      const isMentor = meeting.mentorId === userId;
      
      const meetingData = {
        title,
        description,
        startTime: start,
        endTime: end,
        meetingUrl,
        meetingType,
        agenda,
        notes,
        recordingUrl,
        resources,
        updatedBy: userId,
        updatedAt: new Date(),
        isMentorConfirmed: meeting.isMentorConfirmed,
        isStudentConfirmed: meeting.isStudentConfirmed
      };
      
      const updatedMeeting = await meetingService.updateMeeting(meetingId, meetingData);
      
      // Notificar a outra parte sobre a atualização da reunião
      if (startTime || endTime || meetingUrl) {
        await meetingService.notifyMeetingUpdated(updatedMeeting, isMentor);
      }
      
      res.status(200).json({
        success: true,
        message: 'Reunião atualizada com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar reunião'
      });
    }
  }

  /**
   * Confirma uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async confirmMeeting(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da reunião
      if (meeting.mentorId !== userId && meeting.studentId !== userId) {
        throw new AppError('Você não tem permissão para confirmar esta reunião', 403);
      }
      
      // Verificar se a reunião já foi concluída ou cancelada
      if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível confirmar uma reunião que já foi concluída ou cancelada', 400);
      }
      
      const isMentor = meeting.mentorId === userId;
      
      // Atualizar o status de confirmação
      const meetingData = {
        isMentorConfirmed: isMentor ? true : meeting.isMentorConfirmed,
        isStudentConfirmed: isMentor ? meeting.isStudentConfirmed : true,
        updatedBy: userId,
        updatedAt: new Date()
      };
      
      const updatedMeeting = await meetingService.updateMeeting(meetingId, meetingData);
      
      // Se ambos confirmaram, atualizar o status da reunião para confirmada
      if (updatedMeeting.isMentorConfirmed && updatedMeeting.isStudentConfirmed) {
        await meetingService.updateMeetingStatus(meetingId, MeetingStatus.CONFIRMED);
        
        // Notificar ambas as partes que a reunião foi confirmada
        await meetingService.notifyMeetingConfirmed(updatedMeeting);
      }
      
      res.status(200).json({
        success: true,
        message: 'Reunião confirmada com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao confirmar reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao confirmar reunião'
      });
    }
  }

  /**
   * Cancela uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async cancelMeeting(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      const { reason } = req.body;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor, o estudante ou um administrador
      if (meeting.mentorId !== userId && meeting.studentId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para cancelar esta reunião', 403);
      }
      
      // Verificar se a reunião já foi concluída ou cancelada
      if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível cancelar uma reunião que já foi concluída ou cancelada', 400);
      }
      
      const isMentor = meeting.mentorId === userId;
      const isAdmin = req.user?.role === UserRole.ADMIN;
      
      const updatedMeeting = await meetingService.cancelMeeting(meetingId, reason, userId);
      
      // Notificar as partes sobre o cancelamento da reunião
      if (isAdmin) {
        await meetingService.notifyMeetingCancelledByAdmin(updatedMeeting, reason);
      } else {
        await meetingService.notifyMeetingCancelled(updatedMeeting, isMentor, reason);
      }
      
      res.status(200).json({
        success: true,
        message: 'Reunião cancelada com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao cancelar reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao cancelar reunião'
      });
    }
  }

  /**
   * Conclui uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async completeMeeting(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      const { notes, recordingUrl, resources } = req.body;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor da reunião
      if (meeting.mentorId !== userId) {
        throw new AppError('Apenas o mentor pode concluir a reunião', 403);
      }
      
      // Verificar se a reunião já foi concluída ou cancelada
      if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível concluir uma reunião que já foi concluída ou cancelada', 400);
      }
      
      // Verificar se a reunião já começou
      const now = new Date();
      if (meeting.startTime > now) {
        throw new AppError('Não é possível concluir uma reunião que ainda não começou', 400);
      }
      
      const meetingData = {
        notes: notes || '',
        recordingUrl: recordingUrl || null,
        resources: resources || [],
        status: MeetingStatus.COMPLETED,
        completedAt: now,
        completedBy: userId,
        updatedBy: userId,
        updatedAt: now
      };
      
      const updatedMeeting = await meetingService.updateMeeting(meetingId, meetingData);
      
      // Notificar o estudante que a reunião foi concluída
      await meetingService.notifyMeetingCompleted(updatedMeeting);
      
      res.status(200).json({
        success: true,
        message: 'Reunião concluída com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao concluir reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao concluir reunião'
      });
    }
  }

  /**
   * Obtém as reuniões de uma mentoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMeetingsByMentorship(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { mentorshipId } = req.params;
      const status = req.query.status as MeetingStatus | undefined;
      
      // Verificar se a mentoria existe
      const mentorship = await mentorshipService.getMentorshipById(mentorshipId);
      if (!mentorship) {
        throw new AppError('Mentoria não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor, o estudante ou um administrador
      if (mentorship.mentorId !== userId && mentorship.studentId !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar as reuniões desta mentoria', 403);
      }
      
      const meetings = await meetingService.getMeetingsByMentorship(mentorshipId, status);
      
      res.status(200).json({
        success: true,
        data: meetings
      });
    } catch (error: any) {
      console.error(`Erro ao obter reuniões da mentoria ID ${req.params.mentorshipId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter reuniões da mentoria'
      });
    }
  }

  /**
   * Obtém as próximas reuniões do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUpcomingMeetings(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const role = req.query.role as 'mentor' | 'student' | undefined;
      const limit = parseInt(req.query.limit as string) || 5;
      
      const meetings = await meetingService.getUpcomingMeetings(userId, role, limit);
      
      res.status(200).json({
        success: true,
        data: meetings
      });
    } catch (error: any) {
      console.error(`Erro ao obter próximas reuniões do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter próximas reuniões'
      });
    }
  }

  /**
   * Obtém o histórico de reuniões do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getMeetingHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const role = req.query.role as 'mentor' | 'student' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const meetings = await meetingService.getMeetingHistory(userId, role, page, limit);
      
      res.status(200).json({
        success: true,
        data: meetings
      });
    } catch (error: any) {
      console.error(`Erro ao obter histórico de reuniões do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter histórico de reuniões'
      });
    }
  }

  /**
   * Adiciona um recurso a uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async addResourceToMeeting(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId } = req.params;
      const { title, url, type, description } = req.body;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da reunião
      if (meeting.mentorId !== userId && meeting.studentId !== userId) {
        throw new AppError('Você não tem permissão para adicionar recursos a esta reunião', 403);
      }
      
      // Verificar se a reunião já foi cancelada
      if (meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível adicionar recursos a uma reunião cancelada', 400);
      }
      
      const resource = {
        id: Date.now().toString(),
        title,
        url,
        type: type || 'link',
        description: description || '',
        addedBy: userId,
        addedAt: new Date()
      };
      
      const updatedMeeting = await meetingService.addResourceToMeeting(meetingId, resource);
      
      res.status(200).json({
        success: true,
        message: 'Recurso adicionado com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao adicionar recurso à reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao adicionar recurso à reunião'
      });
    }
  }

  /**
   * Remove um recurso de uma reunião
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async removeResourceFromMeeting(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { meetingId, resourceId } = req.params;
      
      // Verificar se a reunião existe
      const meeting = await meetingService.getMeetingById(meetingId);
      if (!meeting) {
        throw new AppError('Reunião não encontrada', 404);
      }
      
      // Verificar se o usuário é o mentor ou o estudante da reunião
      if (meeting.mentorId !== userId && meeting.studentId !== userId) {
        throw new AppError('Você não tem permissão para remover recursos desta reunião', 403);
      }
      
      // Verificar se a reunião já foi cancelada
      if (meeting.status === MeetingStatus.CANCELLED) {
        throw new AppError('Não é possível remover recursos de uma reunião cancelada', 400);
      }
      
      // Verificar se o recurso existe
      const resource = meeting.resources?.find(r => r.id === resourceId);
      if (!resource) {
        throw new AppError('Recurso não encontrado', 404);
      }
      
      // Verificar se o usuário é quem adicionou o recurso ou é o mentor
      if (resource.addedBy !== userId && meeting.mentorId !== userId) {
        throw new AppError('Você não tem permissão para remover este recurso', 403);
      }
      
      const updatedMeeting = await meetingService.removeResourceFromMeeting(meetingId, resourceId);
      
      res.status(200).json({
        success: true,
        message: 'Recurso removido com sucesso',
        data: updatedMeeting
      });
    } catch (error: any) {
      console.error(`Erro ao remover recurso da reunião ID ${req.params.meetingId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao remover recurso da reunião'
      });
    }
  }
}

export default new MeetingController();