import Joi from "joi";
import { FirebaseArticleStatus } from "../types/firebaseTypes";

export const createArticleSchema = Joi.object({
    title: Joi.string().min(3).max(255).required(),
    content: Joi.string().min(10).required(),
    excerpt: Joi.string().max(500).optional().allow(""),
    categoryId: Joi.string().optional().allow(null, ""), // Assuming categoryId is a string ID
    tags: Joi.array().items(Joi.string()).optional(),
    featuredImage: Joi.string().uri().optional().allow(null, ""),
    status: Joi.string().valid(...Object.values(FirebaseArticleStatus)).optional(),
    // authorId will be set from authenticated user
});

export const updateArticleSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    content: Joi.string().min(10).optional(),
    excerpt: Joi.string().max(500).optional().allow(""),
    categoryId: Joi.string().optional().allow(null, ""),
    tags: Joi.array().items(Joi.string()).optional(),
    featuredImage: Joi.string().uri().optional().allow(null, ""),
    status: Joi.string().valid(...Object.values(FirebaseArticleStatus)).optional(),
});

export const listArticlesSchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid(...Object.values(FirebaseArticleStatus)).optional(),
    authorId: Joi.string().optional(),
    categoryId: Joi.string().optional(),
    tag: Joi.string().optional(), // For filtering by a single tag
    search: Joi.string().optional().allow(""),
    orderBy: Joi.string().valid("createdAt", "publishedAt", "viewCount", "likeCount").optional(),
    orderDirection: Joi.string().valid("asc", "desc").optional(),
});

