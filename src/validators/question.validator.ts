import Joi from "joi";
import { FirebaseQuestionStatus, FirebaseQuestionDifficulty } from "../types/firebaseTypes";

const alternativeSchema = Joi.object({
    id: Joi.string().required(), // ID da alternativa (pode ser um UUID ou gerado)
    text: Joi.string().min(1).max(1000).required(),
    isCorrect: Joi.boolean().required(),
    explanation: Joi.string().max(2000).optional().allow(null, ""),
});

export const createQuestionSchema = Joi.object({
    title: Joi.string().min(3).max(255).required(),
    statement: Joi.string().min(10).required(),
    alternatives: Joi.array().items(alternativeSchema).min(2).max(10).required(), // Pelo menos 2 alternativas
    correctAlternativeId: Joi.string().required(), // ID da alternativa correta
    explanation: Joi.string().max(5000).optional().allow(null, ""),
    difficulty: Joi.string().valid(...Object.values(FirebaseQuestionDifficulty)).optional(),
    filterIds: Joi.array().items(Joi.string()).optional(),
    subFilterIds: Joi.array().items(Joi.string()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid(...Object.values(FirebaseQuestionStatus)).optional(),
    // createdBy will be set from authenticated user
});

export const updateQuestionSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    statement: Joi.string().min(10).optional(),
    alternatives: Joi.array().items(alternativeSchema).min(2).max(10).optional(),
    correctAlternativeId: Joi.string().optional(),
    explanation: Joi.string().max(5000).optional().allow(null, ""),
    difficulty: Joi.string().valid(...Object.values(FirebaseQuestionDifficulty)).optional(),
    filterIds: Joi.array().items(Joi.string()).optional(),
    subFilterIds: Joi.array().items(Joi.string()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid(...Object.values(FirebaseQuestionStatus)).optional(),
}).min(1); // Pelo menos um campo deve ser fornecido para atualização

export const listQuestionsSchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid(...Object.values(FirebaseQuestionStatus)).optional(),
    difficulty: Joi.string().valid(...Object.values(FirebaseQuestionDifficulty)).optional(),
    filterId: Joi.string().optional(), // Para filtrar por um filterId principal
    subFilterId: Joi.string().optional(), // Para filtrar por um subFilterId específico
    tag: Joi.string().optional(),
    search: Joi.string().optional().allow(""),
    orderBy: Joi.string().valid("createdAt", "difficulty", "reviewCount").optional(),
    orderDirection: Joi.string().valid("asc", "desc").optional(),
    excludeIds: Joi.array().items(Joi.string()).optional(), // Para excluir questões já vistas/usadas
    random: Joi.boolean().optional(), // Para buscar questões aleatórias (pode exigir lógica de serviço diferente)
});

export const submitAnswerSchema = Joi.object({
    alternativeId: Joi.string().required(),
    questionListId: Joi.string().optional(),
});

export const listUserQuestionHistorySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    lastVisibleId: Joi.string().optional().allow(null, ""),
});

