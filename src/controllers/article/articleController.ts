import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as articleService from '../../services/firebaseArticleService';
import * as categoryService from '../../services/firebaseCategoryService';
import * as tagService from '../../services/firebaseTagService';
import { AppError } from '../../utils/errors';
import { UserRole, ArticleStatus } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a artigos
 *
 * Responsável por gerenciar artigos e publicações no blog
 */
class ArticleController {
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
   * Cria um novo artigo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createArticle(req: Request, res: Response): Promise<void> {
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
        content, 
        summary, 
        categoryId, 
        tagIds, 
        coverImageUrl, 
        status,
        isHighlighted,
        isPublic,
        publishedAt,
        metaTitle,
        metaDescription,
        metaKeywords
      } = req.body;
      
      // Verificar se o usuário é um autor ou administrador
      if (req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.AUTHOR) {
        throw new AppError('Apenas autores e administradores podem criar artigos', 403);
      }
      
      // Verificar se a categoria existe
      if (categoryId) {
        const category = await categoryService.getCategoryById(categoryId);
        if (!category) {
          throw new AppError('Categoria não encontrada', 404);
        }
      }
      
      // Verificar se as tags existem
      if (tagIds && tagIds.length > 0) {
        const validTagIds = await tagService.validateTagIds(tagIds);
        if (validTagIds.length !== tagIds.length) {
          throw new AppError('Uma ou mais tags são inválidas', 400);
        }
      }
      
      // Definir o status do artigo
      let articleStatus = status || ArticleStatus.DRAFT;
      
      // Se o status for PUBLISHED, verificar se o usuário é um administrador
      if (articleStatus === ArticleStatus.PUBLISHED && req.user?.role !== UserRole.ADMIN) {
        articleStatus = ArticleStatus.PENDING;
      }
      
      // Definir a data de publicação
      let pubDate = null;
      if (articleStatus === ArticleStatus.PUBLISHED) {
        pubDate = publishedAt ? new Date(publishedAt) : new Date();
      }
      
      const articleData = {
        title,
        content,
        summary: summary || '',
        categoryId: categoryId || null,
        tagIds: tagIds || [],
        coverImageUrl: coverImageUrl || null,
        status: articleStatus,
        isHighlighted: isHighlighted === true && req.user?.role === UserRole.ADMIN,
        isPublic: isPublic !== false,
        authorId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: pubDate,
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || summary || '',
        metaKeywords: metaKeywords || [],
        viewCount: 0,
        likeCount: 0,
        commentCount: 0
      };
      
      const article = await articleService.createArticle(articleData);
      
      // Se o status for PENDING, notificar os administradores
      if (articleStatus === ArticleStatus.PENDING) {
        await articleService.notifyArticlePendingReview(article);
      }
      
      res.status(201).json({
        success: true,
        message: 'Artigo criado com sucesso',
        data: article
      });
    } catch (error: any) {
      console.error('Erro ao criar artigo:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar artigo'
      });
    }
  }

  /**
   * Obtém um artigo pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getArticleById(req: Request, res: Response): Promise<void> {
    try {
      const { articleId } = req.params;
      const userId = req.user?.id;
      
      const article = await articleService.getArticleById(articleId);
      
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o artigo pode ser acessado
      const isAdmin = req.user?.role === UserRole.ADMIN;
      const isAuthor = userId && article.authorId === userId;
      
      // Se o artigo não for público ou não estiver publicado, verificar permissões
      if ((!article.isPublic || article.status !== ArticleStatus.PUBLISHED) && !isAdmin && !isAuthor) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Incrementar contador de visualizações apenas para artigos publicados
      if (article.status === ArticleStatus.PUBLISHED && !isAdmin && !isAuthor) {
        await articleService.incrementArticleViewCount(articleId);
        article.viewCount += 1;
      }
      
      res.status(200).json({
        success: true,
        data: article
      });
    } catch (error: any) {
      console.error(`Erro ao obter artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter artigo'
      });
    }
  }

  /**
   * Atualiza um artigo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateArticle(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      const { 
        title, 
        content, 
        summary, 
        categoryId, 
        tagIds, 
        coverImageUrl, 
        status,
        isHighlighted,
        isPublic,
        publishedAt,
        metaTitle,
        metaDescription,
        metaKeywords
      } = req.body;
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para atualizar o artigo
      const isAdmin = req.user?.role === UserRole.ADMIN;
      const isAuthor = article.authorId === userId;
      
      if (!isAdmin && !isAuthor) {
        throw new AppError('Você não tem permissão para atualizar este artigo', 403);
      }
      
      // Verificar se a categoria existe
      if (categoryId) {
        const category = await categoryService.getCategoryById(categoryId);
        if (!category) {
          throw new AppError('Categoria não encontrada', 404);
        }
      }
      
      // Verificar se as tags existem
      if (tagIds && tagIds.length > 0) {
        const validTagIds = await tagService.validateTagIds(tagIds);
        if (validTagIds.length !== tagIds.length) {
          throw new AppError('Uma ou mais tags são inválidas', 400);
        }
      }
      
      // Definir o status do artigo
      let articleStatus = status || article.status;
      
      // Se o status for PUBLISHED, verificar se o usuário é um administrador
      if (articleStatus === ArticleStatus.PUBLISHED && !isAdmin) {
        articleStatus = ArticleStatus.PENDING;
      }
      
      // Definir a data de publicação
      let pubDate = article.publishedAt;
      if (articleStatus === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
        pubDate = publishedAt ? new Date(publishedAt) : new Date();
      }
      
      const articleData = {
        title,
        content,
        summary,
        categoryId,
        tagIds,
        coverImageUrl,
        status: articleStatus,
        isHighlighted: isHighlighted === true && isAdmin ? true : article.isHighlighted,
        isPublic: isPublic !== undefined ? isPublic : article.isPublic,
        updatedAt: new Date(),
        updatedBy: userId,
        publishedAt: pubDate,
        metaTitle,
        metaDescription,
        metaKeywords
      };
      
      const updatedArticle = await articleService.updateArticle(articleId, articleData);
      
      // Se o status mudou para PENDING, notificar os administradores
      if (articleStatus === ArticleStatus.PENDING && article.status !== ArticleStatus.PENDING) {
        await articleService.notifyArticlePendingReview(updatedArticle);
      }
      
      // Se o status mudou para PUBLISHED, notificar o autor
      if (articleStatus === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
        await articleService.notifyArticlePublished(updatedArticle);
      }
      
      res.status(200).json({
        success: true,
        message: 'Artigo atualizado com sucesso',
        data: updatedArticle
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar artigo'
      });
    }
  }

  /**
   * Exclui um artigo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteArticle(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o usuário tem permissão para excluir o artigo
      const isAdmin = req.user?.role === UserRole.ADMIN;
      const isAuthor = article.authorId === userId;
      
      if (!isAdmin && !isAuthor) {
        throw new AppError('Você não tem permissão para excluir este artigo', 403);
      }
      
      await articleService.deleteArticle(articleId);
      
      res.status(200).json({
        success: true,
        message: 'Artigo excluído com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir artigo'
      });
    }
  }

  /**
   * Obtém todos os artigos
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllArticles(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === UserRole.ADMIN;
      const isAuthor = req.user?.role === UserRole.AUTHOR;
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.categoryId as string;
      const tagId = req.query.tagId as string;
      const status = req.query.status as ArticleStatus;
      const authorId = req.query.authorId as string;
      const searchQuery = req.query.search as string;
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc';
      const onlyHighlighted = req.query.onlyHighlighted === 'true';
      
      // Se não for admin ou autor, só pode ver artigos publicados e públicos
      const filterOptions = {
        page,
        limit,
        categoryId,
        tagId,
        status: isAdmin || isAuthor ? status : ArticleStatus.PUBLISHED,
        authorId: isAdmin ? authorId : (isAuthor ? userId : authorId),
        searchQuery,
        sortBy,
        sortOrder,
        onlyHighlighted,
        onlyPublic: !isAdmin && !isAuthor,
        userId
      };
      
      const articles = await articleService.getAllArticles(filterOptions);
      
      res.status(200).json({
        success: true,
        data: articles
      });
    } catch (error: any) {
      console.error('Erro ao obter artigos:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter artigos'
      });
    }
  }

  /**
   * Obtém os artigos do usuário autenticado
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getUserArticles(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as ArticleStatus;
      
      const filterOptions = {
        page,
        limit,
        authorId: userId,
        status,
        userId
      };
      
      const articles = await articleService.getAllArticles(filterOptions);
      
      res.status(200).json({
        success: true,
        data: articles
      });
    } catch (error: any) {
      console.error(`Erro ao obter artigos do usuário ID ${req.user?.id}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter artigos do usuário'
      });
    }
  }

  /**
   * Aprova um artigo (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async approveArticle(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      
      // Verificar se o usuário é um administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem aprovar artigos', 403);
      }
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o artigo está pendente
      if (article.status !== ArticleStatus.PENDING) {
        throw new AppError('Apenas artigos pendentes podem ser aprovados', 400);
      }
      
      const articleData = {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: userId
      };
      
      const updatedArticle = await articleService.updateArticle(articleId, articleData);
      
      // Notificar o autor que o artigo foi aprovado
      await articleService.notifyArticlePublished(updatedArticle);
      
      res.status(200).json({
        success: true,
        message: 'Artigo aprovado com sucesso',
        data: updatedArticle
      });
    } catch (error: any) {
      console.error(`Erro ao aprovar artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao aprovar artigo'
      });
    }
  }

  /**
   * Rejeita um artigo (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async rejectArticle(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      const { reason } = req.body;
      
      // Verificar se o usuário é um administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem rejeitar artigos', 403);
      }
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o artigo está pendente
      if (article.status !== ArticleStatus.PENDING) {
        throw new AppError('Apenas artigos pendentes podem ser rejeitados', 400);
      }
      
      const articleData = {
        status: ArticleStatus.REJECTED,
        rejectionReason: reason,
        updatedAt: new Date(),
        updatedBy: userId
      };
      
      const updatedArticle = await articleService.updateArticle(articleId, articleData);
      
      // Notificar o autor que o artigo foi rejeitado
      await articleService.notifyArticleRejected(updatedArticle, reason);
      
      res.status(200).json({
        success: true,
        message: 'Artigo rejeitado com sucesso',
        data: updatedArticle
      });
    } catch (error: any) {
      console.error(`Erro ao rejeitar artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao rejeitar artigo'
      });
    }
  }

  /**
   * Destaca ou remove destaque de um artigo (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async toggleArticleHighlight(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      const { isHighlighted } = req.body;
      
      // Verificar se o usuário é um administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem destacar artigos', 403);
      }
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o artigo está publicado
      if (article.status !== ArticleStatus.PUBLISHED) {
        throw new AppError('Apenas artigos publicados podem ser destacados', 400);
      }
      
      const articleData = {
        isHighlighted,
        updatedAt: new Date(),
        updatedBy: userId
      };
      
      const updatedArticle = await articleService.updateArticle(articleId, articleData);
      
      res.status(200).json({
        success: true,
        message: isHighlighted ? 'Artigo destacado com sucesso' : 'Destaque removido com sucesso',
        data: updatedArticle
      });
    } catch (error: any) {
      console.error(`Erro ao alterar destaque do artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao alterar destaque do artigo'
      });
    }
  }

  /**
   * Curtir ou descurtir um artigo
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async toggleArticleLike(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(req);
      const { articleId } = req.params;
      
      // Verificar se o artigo existe
      const article = await articleService.getArticleById(articleId);
      if (!article) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      // Verificar se o artigo está publicado e é público
      if (article.status !== ArticleStatus.PUBLISHED || !article.isPublic) {
        throw new AppError('Artigo não encontrado', 404);
      }
      
      const hasLiked = await articleService.hasUserLikedArticle(articleId, userId);
      
      if (hasLiked) {
        await articleService.unlikeArticle(articleId, userId);
      } else {
        await articleService.likeArticle(articleId, userId);
      }
      
      const updatedLikeCount = await articleService.getArticleLikeCount(articleId);
      
      res.status(200).json({
        success: true,
        message: hasLiked ? 'Curtida removida com sucesso' : 'Artigo curtido com sucesso',
        data: {
          liked: !hasLiked,
          likeCount: updatedLikeCount
        }
      });
    } catch (error: any) {
      console.error(`Erro ao curtir/descurtir artigo ID ${req.params.articleId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao curtir/descurtir artigo'
      });
    }
  }

  /**
   * Obtém as estatísticas de artigos (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getArticleStatistics(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é um administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Apenas administradores podem acessar estatísticas de artigos', 403);
      }
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const statistics = await articleService.getArticleStatistics(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Erro ao obter estatísticas de artigos:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter estatísticas de artigos'
      });
    }
  }
}

export default new ArticleController();