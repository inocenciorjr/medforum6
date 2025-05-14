import { Request, Response, NextFunction } from "express";
import { admin } from "../config/firebaseAdmin"; // Corrigido: importação nomeada
import { AppError } from "../utils/errors";
import * as UserService from "../services/firebaseUserService";
import { UserRole } from "../types/firebaseTypes"; // Importar UserRole para tipagem correta

// Interface para estender o objeto Request do Express
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string; // Corrigido: usar 'id' em vez de 'uid' para consistência
        uid: string; // Manter uid para compatibilidade interna se necessário, mas 'id' é o primário
        email?: string | null;
        role: UserRole; // Corrigido: usar UserRole e tornar obrigatório
        displayName?: string | null;
        photoURL?: string | null;
    };
}

// Middleware para verificar token de autenticação e popular req.user
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const authorizationHeader = authReq.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return next(new AppError("Token de autenticação não fornecido ou mal formatado.", 401));
    }

    const idToken = authorizationHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userProfile = await UserService.getUserById(decodedToken.uid);
        
        authReq.user = {
            id: decodedToken.uid, // Usar uid como id
            uid: decodedToken.uid,
            email: decodedToken.email || null,
            role: userProfile?.role || UserRole.STUDENT, // Default para STUDENT se não definido
            displayName: userProfile?.displayName || decodedToken.name || null,
            photoURL: userProfile?.profileImage || decodedToken.picture || null,
        };
        next();
    } catch (error) {
        console.error("Erro ao verificar token Firebase:", error);
        return next(new AppError("Token de autenticação inválido ou expirado.", 403));
    }
};

// Middleware para popular req.user opcionalmente, sem bloquear a requisição se não autenticado
export const authenticateOptional = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const authorizationHeader = authReq.headers.authorization;

    if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
        const idToken = authorizationHeader.split("Bearer ")[1];
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const userProfile = await UserService.getUserById(decodedToken.uid);
            
            authReq.user = {
                id: decodedToken.uid, // Usar uid como id
                uid: decodedToken.uid,
                email: decodedToken.email || null,
                role: userProfile?.role || UserRole.STUDENT, // Default para STUDENT se não definido
                displayName: userProfile?.displayName || decodedToken.name || null,
                photoURL: userProfile?.profileImage || decodedToken.picture || null,
            };
        } catch (error) {
            console.warn("Token opcional inválido ou expirado, continuando como não autenticado.");
        }
    }
    next();
};
