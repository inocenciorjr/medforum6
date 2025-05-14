import { Request, Response, NextFunction } from "express";
import * as UserService from "../services/firebaseUserService";
import * as ArticleService from "../services/firebaseArticleService";
import * as CommentService from "../services/firebaseCommentService";
import * as QuestionService from "../services/firebaseQuestionService";
import * as PlanService from "../services/firebasePlanService";
import * as PaymentService from "../services/firebasePaymentService";
import * as MentorshipService from "../services/firebaseMentorshipService";
import * as SimulatedExamService from "../services/firebaseSimulatedExamService";
import { AppError } from "../utils/errors";
import { FirebaseUser, UserRole, FirebaseArticleStatus, FirebaseCommentStatus, FirebaseQuestionStatus, FirebasePlan, FirebasePayment, FirebaseMentorship, FirebaseSimulatedExam, FirebaseSimulatedExamStatus } from "../types/firebaseTypes";
import { AuthenticatedRequest } from "../middleware/authMiddleware"; // Importar AuthenticatedRequest

// Middleware para verificar se o usuário é admin (exemplo, idealmente estaria em authorizationMiddleware)
// Este isAdmin específico do controller pode ser removido se já existir um global em authorizationMiddleware
// export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
//     const authReq = req as AuthenticatedRequest;
//     if (authReq.user?.role !== UserRole.ADMIN) {
//         return next(new AppError("Acesso negado. Somente administradores.", 403));
//     }
//     next();
// };

// Exemplo: Listar todos os usuários (com filtros e paginação)
export const listAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Adicionar validação de query params para filtros e paginação
        const { limit, startAfter, sortBy, sortDirection, role, isActive, searchQuery } = req.query;
        const usersResult = await UserService.getUsers({
            limit: limit ? parseInt(limit as string) : undefined,
            startAfter: startAfter as string | undefined,
            sortBy: sortBy as keyof FirebaseUser | undefined,
            sortDirection: sortDirection as "asc" | "desc" | undefined,
            role: role as UserRole | undefined,
            isActive: isActive !== undefined ? (isActive === "true") : undefined,
            searchQuery: searchQuery as string | undefined,
        });
        res.status(200).json(usersResult);
    } catch (err) {
        next(err);
    }
};

// Exemplo: Atualizar o papel (role) de um usuário
export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userIdToUpdate = req.params.userId;
        const { role } = req.body;

        if (!role || !Object.values(UserRole).includes(role as UserRole)) {
            throw new AppError("Papel (role) inválido fornecido.", 400);
        }
        // A função updateUserRole em firebaseUserService não existe, precisaria ser implementada
        // ou usar a updateUser genérica.
        // Por ora, vamos assumir que UserService.updateUser pode atualizar a role.
        await UserService.updateUser(userIdToUpdate, { role: role as UserRole });
        const updatedUser = await UserService.getUser(userIdToUpdate);

        if (!updatedUser) {
            throw new AppError("Usuário não encontrado após tentativa de atualização de papel.", 404);
        }
        res.status(200).json(updatedUser);
    } catch (err) {
        next(err);
    }
};

// Exemplo: Gerenciar status de artigos (publicar, arquivar)
export const manageArticleStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const articleId = req.params.articleId;
        const { status } = req.body;

        if (!status || !Object.values(FirebaseArticleStatus).includes(status as FirebaseArticleStatus)) {
            throw new AppError("Status de artigo inválido.", 400);
        }

        const updatedArticle = await ArticleService.updateArticle(articleId, { status: status as FirebaseArticleStatus });
        if (!updatedArticle) {
            throw new AppError("Artigo não encontrado para atualização de status.", 404);
        }
        res.status(200).json(updatedArticle);
    } catch (err) {
        next(err);
    }
};

// Placeholder para futuras funções de dashboard administrativo
export const getAdminDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Lógica para buscar estatísticas relevantes para o admin
        // Ex: número de usuários, artigos, pagamentos recentes, etc.
        const usersResult = await UserService.getUsers({ limit: 0 }); // Para obter o total
        const userCount = usersResult.users.length; // Simplificado, idealmente o serviço retornaria o total
        // Adicionar mais estatísticas conforme necessário
        res.status(200).json({ userCount /*, outrasStats */ });
    } catch (err) {
        next(err);
    }
};

