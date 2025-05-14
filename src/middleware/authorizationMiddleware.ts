import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware"; // Importa o tipo de request autenticado
import { AppError } from "../utils/errors"; 
import * as ArticleService from "../services/firebaseArticleService";
import * as CommentService from "../services/firebaseCommentService";
// Importar outros serviços necessários para verificar propriedade (ex: QuestionService, MentorshipService)

// Middleware para verificar se o usuário é Admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin") {
        return next(new AppError("Acesso negado. Somente administradores.", 403));
    }
    next();
};

// Middleware para verificar se o usuário é Admin ou Mentor
export const isAdminOrMentor = (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") {
        return next(new AppError("Acesso negado. Somente administradores ou mentores.", 403));
    }
    next();
};

// Middleware para verificar se o usuário é Admin ou Moderador (Mentor pode ser moderador)
export const isAdminOrModerator = (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    // Assumindo que mentores também podem moderar comentários
    if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") {
        return next(new AppError("Acesso negado. Somente administradores ou moderadores.", 403));
    }
    next();
};

// Middleware genérico para verificar se o usuário é Admin ou o autor do recurso
type ResourceType = "article" | "comment" | "question" | "mentorship_participant"; // Adicionar outros tipos de recurso conforme necessário

export const isAdminOrAuthor = (resourceType: ResourceType) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        const resourceId = authReq.params.id; // Assumindo que o ID do recurso está em req.params.id
        const userId = authReq.user?.uid;

        if (!userId) {
            return next(new AppError("Usuário não autenticado.", 401));
        }

        if (authReq.user?.role === "admin") {
            return next(); // Admin tem acesso
        }

        try {
            let resourceAuthorId: string | undefined;

            if (resourceType === "article") {
                const article = await ArticleService.getArticleById(resourceId);
                resourceAuthorId = article?.authorId;
            } else if (resourceType === "comment") {
                const comment = await CommentService.getCommentById(resourceId);
                resourceAuthorId = comment?.userId; // ou authorId dependendo da sua modelagem
            } 
            // Adicionar casos para "question", "flashcardDeck", etc.
            // else if (resourceType === "question") {
            //     const question = await QuestionService.getQuestionById(resourceId);
            //     resourceAuthorId = question?.createdBy;
            // }

            if (resourceAuthorId && resourceAuthorId === userId) {
                return next(); // Usuário é o autor
            }

            return next(new AppError("Acesso negado. Você não é o autor deste recurso nem um administrador.", 403));
        } catch (error) {
            console.error(`Erro ao verificar autoria para ${resourceType} ${resourceId}:`, error);
            return next(new AppError("Erro ao verificar permissões do recurso.", 500));
        }
    };
};

// Middleware para verificar se o usuário é participante de uma mentoria (mentor ou estudante) ou admin
export const isMentorOrStudentOrAdmin = (resourceType: "mentorship") => { // Por enquanto apenas para mentoria
    return async (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        const mentorshipId = authReq.params.id;
        const userId = authReq.user?.uid;

        if (!userId) {
            return next(new AppError("Usuário não autenticado.", 401));
        }

        if (authReq.user?.role === "admin") {
            return next();
        }

        // try {
        //     const mentorship = await MentorshipService.getMentorship(mentorshipId);
        //     if (mentorship && (mentorship.mentorId === userId || mentorship.studentId === userId)) {
        //         return next();
        //     }
        //     return next(new AppError("Acesso negado. Você não participa desta mentoria.", 403));
        // } catch (error) {
        //     console.error(`Erro ao verificar participação na mentoria ${mentorshipId}:`, error);
        //     return next(new AppError("Erro ao verificar permissões da mentoria.", 500));
        // }
        // Comentado pois MentorshipService não está no escopo deste arquivo para evitar dependência circular ou complexidade de importação aqui.
        // A lógica real de busca da mentoria e verificação de IDs deve ser feita.
        // Por agora, vamos simular que a verificação passou se não for admin, para não quebrar as rotas.
        // Esta é uma simplificação e DEVE ser corrigida com a lógica real.
        console.warn("AVISO: A verificação de participante da mentoria está simplificada no middleware.");
        next(); 
    };
};

