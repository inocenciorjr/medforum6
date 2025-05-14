import { Request, Response, NextFunction } from "express";
import * as UserQuestionHistoryService from "../services/firebaseUserQuestionHistoryService";
import { AppError } from "../utils/errors"; // Alterado de ExtendedError para AppError
import { listUserQuestionHistorySchema } from "../validators/question.validator"; // Supondo que um validador para a listagem exista ou será criado

// Listar histórico de respostas de um usuário com paginação
export const listUserHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore // req.user é adicionado pelo middleware de autenticação
        const userId = req.user?.uid;
        if (!userId) {
            throw new AppError("Usuário não autenticado", 401); // Alterado de ExtendedError para AppError
        }

        const { error, value } = listUserQuestionHistorySchema.validate(req.query);
        if (error) {
            throw new AppError(error.details[0].message, 400); // Alterado de ExtendedError para AppError
        }

        const { limit, lastVisibleId } = value;

        const result = await UserQuestionHistoryService.getUserQuestionHistory(userId, limit, lastVisibleId);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

// Obter uma entrada específica do histórico pelo ID (para admin ou dono)
export const getHistoryEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entryId = req.params.id;
        const historyEntry = await UserQuestionHistoryService.getHistoryEntryById(entryId);

        if (!historyEntry) {
            throw new AppError("Entrada do histórico não encontrada", 404); // Alterado de ExtendedError para AppError
        }

        // @ts-ignore
        const requestingUserId = req.user?.uid;
        // @ts-ignore
        if (historyEntry.userId !== requestingUserId && req.user?.role !== "admin") {
            throw new AppError("Não autorizado a visualizar esta entrada do histórico", 403); // Alterado de ExtendedError para AppError
        }

        res.status(200).json(historyEntry);
    } catch (err) {
        next(err);
    }
};

