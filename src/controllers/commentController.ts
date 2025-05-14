import { Request, Response, NextFunction } from "express";
import * as CommentService from "../services/firebaseCommentService";
import { FirebaseComment, FirebaseCommentStatus } from "../types/firebaseTypes";
import { AppError } from "../utils/errors"; 
import { createCommentSchema, updateCommentSchema, listCommentsSchema } from "../validators/comment.validator"; 
import { AuthenticatedRequest } from "../middleware/authMiddleware"; // Importar AuthenticatedRequest

// Criar um novo comentário
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { error, value } = createCommentSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const userId = authReq.user?.uid;
        if (!userId) {
            throw new AppError("Usuário não autenticado", 401);
        }

        const commentData = {
            ...value,
            userId,
            authorId: userId, // Mantendo authorId para consistência
            authorName: authReq.user?.displayName || "Usuário Anônimo",
            authorProfileImage: authReq.user?.photoURL || null,
            status: FirebaseCommentStatus.PENDING, // Comentários novos podem começar como pendentes para moderação
        };

        // Garantir que postId está definido
        if (!commentData.postId) {
            throw new AppError("O ID do post é obrigatório", 400);
        }

        const newComment = await CommentService.createComment(commentData);
        res.status(201).json(newComment);
    } catch (err) {
        next(err);
    }
};

// Obter um comentário pelo ID
export const getCommentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const commentId = req.params.id;
        const comment = await CommentService.getCommentById(commentId);
        if (!comment) {
            throw new AppError("Comentário não encontrado", 404);
        }
        res.status(200).json(comment);
    } catch (err) {
        next(err);
    }
};

// Listar comentários por contentId
export const listCommentsByContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contentId = req.params.contentId || req.query.contentId as string;
        if (!contentId) {
            throw new AppError("Content ID é obrigatório", 400);
        }

        const { error, value } = listCommentsSchema.validate(req.query);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }
        
        const filters = {
            ...value,
            contentId, 
            articleId: value.contentType === "article" ? contentId : undefined,
            postId: value.contentType === "post" ? contentId : undefined, 
        };

        const result = await CommentService.listCommentsByPostId(filters); 
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

// Atualizar um comentário
export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const commentId = req.params.id;
        const { error, value } = updateCommentSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const userId = authReq.user?.uid;
        const commentToUpdate = await CommentService.getCommentById(commentId);

        if (!commentToUpdate) {
            throw new AppError("Comentário não encontrado", 404);
        }

        if (commentToUpdate.userId !== userId && authReq.user?.role !== "admin") {
            throw new AppError("Não autorizado a atualizar este comentário", 403);
        }

        const updateData: Partial<FirebaseComment> = { text: value.text };
        if (authReq.user?.role === "admin" && value.status) {
            updateData.status = value.status;
        }

        const updatedComment = await CommentService.updateComment(commentId, userId!, updateData);
        res.status(200).json(updatedComment);
    } catch (err) {
        next(err);
    }
};

// Deletar um comentário
export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const commentId = req.params.id;
        const userId = authReq.user?.uid;
        const commentToDelete = await CommentService.getCommentById(commentId);

        if (!commentToDelete) {
            throw new AppError("Comentário não encontrado", 404);
        }

        if (commentToDelete.userId !== userId && authReq.user?.role !== "admin") {
            throw new AppError("Não autorizado a deletar este comentário", 403);
        }

        await CommentService.deleteComment(commentId, userId!);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// Aprovar um comentário
export const approveComment = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const commentId = req.params.id;
        if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") { 
            throw new AppError("Não autorizado a aprovar comentários", 403);
        }
        const approvedComment = await CommentService.updateCommentStatus(commentId, FirebaseCommentStatus.APPROVED);
        res.status(200).json(approvedComment);
    } catch (err) {
        next(err);
    }
};

// Rejeitar um comentário
export const rejectComment = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const commentId = req.params.id;
        if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") {
            throw new AppError("Não autorizado a rejeitar comentários", 403);
        }
        const rejectedComment = await CommentService.updateCommentStatus(commentId, FirebaseCommentStatus.REJECTED);
        res.status(200).json(rejectedComment);
    } catch (err) {
        next(err);
    }
};

