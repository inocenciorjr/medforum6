import Joi from "joi";
import { UserRole } from "../types/firebaseTypes"; // Supondo que UserRole enum existe

// Validador para listar usuários (usado pelo adminController)
export const listAllUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    role: Joi.string().valid(...Object.values(UserRole)).optional(),
    status: Joi.string().optional(), // Pode ser "active", "inactive", etc. Depende da implementação do UserService
    search: Joi.string().optional().allow(""),
});

// Validador para atualizar o papel de um usuário
export const updateUserRoleSchema = Joi.object({
    role: Joi.string().valid(...Object.values(UserRole)).required(),
});

// Validador para gerenciar o status de um artigo (exemplo)
export const manageArticleStatusSchema = Joi.object({
    status: Joi.string().required(), // Adicionar validação específica de status do artigo se necessário
});

// Adicionar mais validadores para outras ações administrativas conforme elas são definidas
// Por exemplo, para gerenciar planos, pagamentos, etc.

