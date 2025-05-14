import Joi from "joi";
import { FirebaseCommentStatus, FirebaseCommentContentType } from "../types/firebaseTypes"; // Supondo que FirebaseCommentContentType existe

export const createCommentSchema = Joi.object({
    contentId: Joi.string().required(), // ID do Artigo, Questão, etc.
    contentType: Joi.string().valid(...Object.values(FirebaseCommentContentType)).required(), // "article", "question", "post"
    text: Joi.string().min(1).max(2000).required(),
    parentId: Joi.string().optional().allow(null, ""), // Para respostas a outros comentários
});

export const updateCommentSchema = Joi.object({
    text: Joi.string().min(1).max(2000).optional(),
    status: Joi.string().valid(...Object.values(FirebaseCommentStatus)).optional(), // Apenas admin/moderador deveria poder mudar status
});

export const listCommentsSchema = Joi.object({
    contentId: Joi.string().optional(), // Pode ser parte da rota ou query
    contentType: Joi.string().valid(...Object.values(FirebaseCommentContentType)).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    orderBy: Joi.string().valid("createdAt", "likeCount").optional(),
    orderDirection: Joi.string().valid("asc", "desc").optional(),
    status: Joi.string().valid(...Object.values(FirebaseCommentStatus)).optional(), // Para filtrar por status de moderação
    parentId: Joi.string().optional().allow(null, ""), // Para buscar respostas diretas a um comentário
    isDeleted: Joi.boolean().optional(), // Para incluir ou excluir comentários deletados (soft delete)
});

