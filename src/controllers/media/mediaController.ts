import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as mediaService from '../../services/firebaseMediaService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';
import path from 'path';
import fs from 'fs';

/**
 * Controlador para operações relacionadas a arquivos de mídia
 *
 * Responsável por gerenciar uploads, downloads e exclusão de arquivos de mídia
 */
class MediaController {
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
   * Faz upload de um arquivo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      
      if (!req.file) {
        throw new AppError('Nenhum arquivo enviado', 400);
      }
      
      const { originalname, mimetype, size, path: tempPath } = req.file;
      const { folder = 'general', description, isPublic = false } = req.body;
      
      // Verificar tamanho máximo (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB em bytes
      if (size > maxSize) {
        // Remover arquivo temporário
        fs.unlinkSync(tempPath);
        throw new AppError('Tamanho do arquivo excede o limite de 10MB', 400);
      }
      
      // Verificar tipos de arquivo permitidos
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/webm'
      ];
      
      if (!allowedMimeTypes.includes(mimetype)) {
        // Remover arquivo temporário
        fs.unlinkSync(tempPath);
        throw new AppError('Tipo de arquivo não permitido', 400);
      }
      
      // Ler o arquivo
      const fileBuffer = fs.readFileSync(tempPath);
      
      // Gerar nome de arquivo único
      const fileExtension = path.extname(originalname);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
      
      // Fazer upload para o Firebase Storage
      const fileData = {
        originalName: originalname,
        fileName,
        mimeType: mimetype,
        size,
        folder,
        description: description || '',
        uploadedBy: userId,
        isPublic: isPublic === 'true' || isPublic === true,
        createdAt: new Date()
      };
      
      const uploadedFile = await mediaService.uploadFile(fileBuffer, fileData);
      
      // Remover arquivo temporário
      fs.unlinkSync(tempPath);
      
      res.status(201).json({
        success: true,
        message: 'Arquivo enviado com sucesso',
        data: uploadedFile
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload de arquivo:', error);
      
      // Remover arquivo temporário se existir
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao fazer upload de arquivo'
      });
    }
  }

  /**
   * Obtém um arquivo pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getFileById(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      
      const file = await mediaService.getFileById(fileId);
      
      if (!file) {
        throw new AppError('Arquivo não encontrado', 404);
      }
      
      // Verificar permissão: arquivos públicos ou arquivos do próprio usuário ou admin
      if (!file.isPublic && file.uploadedBy !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este arquivo', 403);
      }
      
      res.status(200).json({
        success: true,
        data: file
      });
    } catch (error: any) {
      console.error(`Erro ao obter arquivo ID ${req.params.fileId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter arquivo'
      });
    }
  }

  /**
   * Faz download de um arquivo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      
      const file = await mediaService.getFileById(fileId);
      
      if (!file) {
        throw new AppError('Arquivo não encontrado', 404);
      }
      
      // Verificar permissão: arquivos públicos ou arquivos do próprio usuário ou admin
      if (!file.isPublic && file.uploadedBy !== req.user?.id && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para acessar este arquivo', 403);
      }
      
      // Obter URL de download
      const downloadUrl = await mediaService.getFileDownloadUrl(fileId);
      
      // Registrar download
      await mediaService.recordFileDownload(fileId, req.user?.id);
      
      // Redirecionar para URL de download
      res.redirect(downloadUrl);
    } catch (error: any) {
      console.error(`Erro ao fazer download do arquivo ID ${req.params.fileId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao fazer download do arquivo'
      });
    }
  }

  /**
   * Exclui um arquivo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = this.getAuthenticatedUserId(req);
      
      const file = await mediaService.getFileById(fileId);
      
      if (!file) {
        throw new AppError('Arquivo não encontrado', 404);
      }
      
      // Verificar permissão: apenas o proprietário ou admin pode excluir
      if (file.uploadedBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir este arquivo', 403);
      }
      
      await mediaService.deleteFile(fileId);
      
      res.status(200).json({
        success: true,
        message: 'Arquivo excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir arquivo ID ${req.params.fileId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir arquivo'
      });
    }
  }

  /**
   * Atualiza metadados de um arquivo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateFileMetadata(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const { fileId } = req.params;
      const userId = this.getAuthenticatedUserId(req);
      const { description, folder, isPublic } = req.body;
      
      const file = await mediaService.getFileById(fileId);
      
      if (!file) {
        throw new AppError('Arquivo não encontrado', 404);
      }
      
      // Verificar permissão: apenas o proprietário ou admin pode atualizar
      if (file.uploadedBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para atualizar este arquivo', 403);
      }
      
      const updatedFile = await mediaService.updateFileMetadata(fileId, {
        description,
        folder,
        isPublic: isPublic === 'true' || isPublic === true
      });
      
      res.status(200).json({
        success: true,
        message: 'Metadados do arquivo atualizados com sucesso',
        data: updatedFile
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar metadados do arquivo ID ${req.params.fileId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar metadados do arquivo'
      });
    }
  }

  /**
   * Lista arquivos do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserFiles(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const folder = req.query.folder as string;
      const type = req.query.type as string;
      
      const files = await mediaService.getUserFiles(userId, page, limit, folder, type);
      
      res.status(200).json({
        success: true,
        data: files
      });
    } catch (error: any) {
      console.error(`Erro ao listar arquivos do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao listar arquivos do usuário'
      });
    }
  }

  /**
   * Lista pastas do usuário
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserFolders(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const folders = await mediaService.getUserFolders(userId);
      
      res.status(200).json({
        success: true,
        data: folders
      });
    } catch (error: any) {
      console.error(`Erro ao listar pastas do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao listar pastas do usuário'
      });
    }
  }

  /**
   * Cria uma nova pasta
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createFolder(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { name, parentFolder } = req.body;
      
      // Verificar se a pasta já existe
      const existingFolder = await mediaService.getFolderByName(userId, name, parentFolder);
      if (existingFolder) {
        throw new AppError('Já existe uma pasta com este nome', 409);
      }
      
      const folder = await mediaService.createFolder({
        name,
        parentFolder: parentFolder || null,
        createdBy: userId,
        createdAt: new Date()
      });
      
      res.status(201).json({
        success: true,
        message: 'Pasta criada com sucesso',
        data: folder
      });
    } catch (error: any) {
      console.error('Erro ao criar pasta:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar pasta'
      });
    }
  }

  /**
   * Exclui uma pasta
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteFolder(req: Request, res: Response): Promise<void> {
    try {
      const { folderId } = req.params;
      const userId = this.getAuthenticatedUserId(req);
      
      const folder = await mediaService.getFolderById(folderId);
      
      if (!folder) {
        throw new AppError('Pasta não encontrada', 404);
      }
      
      // Verificar permissão: apenas o proprietário ou admin pode excluir
      if (folder.createdBy !== userId && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Você não tem permissão para excluir esta pasta', 403);
      }
      
      // Verificar se a pasta contém arquivos
      const filesInFolder = await mediaService.getFilesInFolder(folderId);
      if (filesInFolder.length > 0) {
        throw new AppError('Não é possível excluir uma pasta que contém arquivos', 400);
      }
      
      // Verificar se a pasta contém subpastas
      const subfolders = await mediaService.getSubfolders(folderId);
      if (subfolders.length > 0) {
        throw new AppError('Não é possível excluir uma pasta que contém subpastas', 400);
      }
      
      await mediaService.deleteFolder(folderId);
      
      res.status(200).json({
        success: true,
        message: 'Pasta excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir pasta ID ${req.params.folderId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir pasta'
      });
    }
  }
}

export default new MediaController();