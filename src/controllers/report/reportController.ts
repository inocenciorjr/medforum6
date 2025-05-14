import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as reportService from '../../services/firebaseReportService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a denúncias
 *
 * Responsável por gerenciar denúncias de conteúdo impróprio
 */
class ReportController {
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
   * Cria uma nova denúncia
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createReport(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { resourceType, resourceId, reason, description } = req.body;
      
      const reportData = {
        resourceType,
        resourceId,
        reason,
        description,
        reportedBy: userId,
        status: 'PENDING',
        createdAt: new Date()
      };
      
      const report = await reportService.createReport(reportData);
      
      res.status(201).json({
        success: true,
        message: 'Denúncia enviada com sucesso',
        data: report
      });
    } catch (error: any) {
      console.error('Erro ao criar denúncia:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar denúncia'
      });
    }
  }

  /**
   * Obtém todas as denúncias (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllReports(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const resourceType = req.query.resourceType as string;
      
      const reports = await reportService.getAllReports(page, limit, status, resourceType);
      
      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error: any) {
      console.error('Erro ao obter denúncias:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter denúncias'
      });
    }
  }

  /**
   * Obtém uma denúncia pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getReportById(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = this.getAuthenticatedUserId(req);
      
      const report = await reportService.getReportById(reportId);
      
      if (!report) {
        throw new AppError('Denúncia não encontrada', 404);
      }
      
      // Verificar permissão: apenas o autor da denúncia ou administradores podem ver
      if (report.reportedBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar esta denúncia', 403);
      }
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error(`Erro ao obter denúncia ID ${req.params.reportId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter denúncia'
      });
    }
  }

  /**
   * Atualiza o status de uma denúncia (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateReportStatus(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { reportId } = req.params;
      const { status, adminNotes } = req.body;
      
      // Verificar se a denúncia existe
      const report = await reportService.getReportById(reportId);
      if (!report) {
        throw new AppError('Denúncia não encontrada', 404);
      }
      
      const updatedReport = await reportService.updateReportStatus(reportId, status, adminNotes, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Status da denúncia atualizado com sucesso',
        data: updatedReport
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar status da denúncia ID ${req.params.reportId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar status da denúncia'
      });
    }
  }

  /**
   * Obtém as denúncias feitas pelo usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserReports(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const reports = await reportService.getUserReports(userId, page, limit);
      
      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error: any) {
      console.error(`Erro ao obter denúncias do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter denúncias do usuário'
      });
    }
  }

  /**
   * Obtém as denúncias relacionadas a um recurso específico (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getResourceReports(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { resourceType, resourceId } = req.params;
      
      const reports = await reportService.getResourceReports(resourceType, resourceId);
      
      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error: any) {
      console.error(`Erro ao obter denúncias do recurso tipo ${req.params.resourceType} ID ${req.params.resourceId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter denúncias do recurso'
      });
    }
  }

  /**
   * Obtém estatísticas de denúncias (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getReportStatistics(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const statistics = await reportService.getReportStatistics(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Erro ao obter estatísticas de denúncias:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de denúncias'
      });
    }
  }
}

export default new ReportController();