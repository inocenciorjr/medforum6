import { Request, Response, NextFunction } from "express";
import * as ArticleService from "../services/firebaseArticleService";
import { FirebaseArticle, FirebaseArticleStatus } from "../types/firebaseTypes";
import { AppError } from "../utils/errors"; 
import { createArticleSchema, updateArticleSchema, listArticlesSchema } from "../validators/article.validator"; 
import { AuthenticatedRequest } from "../middleware/authMiddleware"; // Importar AuthenticatedRequest

// Criar um novo artigo
export const createArticle = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { error, value } = createArticleSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const authorId = authReq.user?.uid;
        if (!authorId) {
            throw new AppError("Usuário não autenticado", 401);
        }

        const articleData: Partial<FirebaseArticle> = {
            ...value,
            authorId,
            status: value.status || FirebaseArticleStatus.DRAFT, // Default para DRAFT se não especificado
        };
        // O serviço createArticle já lida com a omissão dos campos necessários
        const newArticle = await ArticleService.createArticle(articleData as Omit<FirebaseArticle, "id" | "createdAt" | "updatedAt" | "viewCount" | "likeCount" | "commentCount" | "publishedAt" | "searchableText">);
        res.status(201).json(newArticle);
    } catch (err) {
        next(err);
    }
};

// Obter um artigo pelo ID
export const getArticleById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const articleId = req.params.id;
        const article = await ArticleService.getArticleById(articleId);
        if (!article) {
            throw new AppError("Artigo não encontrado", 404);
        }
        res.status(200).json(article);
    } catch (err) {
        next(err);
    }
};

// Listar artigos com filtros e paginação
export const listArticles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { error, value } = listArticlesSchema.validate(req.query);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }
        // Corrigido para usar listArticles do serviço
        const result = await ArticleService.listArticles(value);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

// Atualizar um artigo
export const updateArticle = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const articleId = req.params.id;
        const { error, value } = updateArticleSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const userId = authReq.user?.uid;
        const articleToUpdate = await ArticleService.getArticleById(articleId);

        if (!articleToUpdate) {
            throw new AppError("Artigo não encontrado", 404);
        }
        
        if (articleToUpdate.authorId !== userId && authReq.user?.role !== "admin") {
            throw new AppError("Não autorizado a atualizar este artigo", 403);
        }

        const updatedArticle = await ArticleService.updateArticle(articleId, value);
        res.status(200).json(updatedArticle);
    } catch (err) {
        next(err);
    }
};

// Deletar um artigo
export const deleteArticle = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const articleId = req.params.id;
        const userId = authReq.user?.uid;
        const articleToDelete = await ArticleService.getArticleById(articleId);

        if (!articleToDelete) {
            throw new AppError("Artigo não encontrado", 404);
        }
        
        if (articleToDelete.authorId !== userId && authReq.user?.role !== "admin") {
            throw new AppError("Não autorizado a deletar este artigo", 403);
        }

        await ArticleService.deleteArticle(articleId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

