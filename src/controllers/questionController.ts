import { Request, Response, NextFunction } from "express";
import * as QuestionService from "../services/firebaseQuestionService";
import * as UserQuestionHistoryService from "../services/firebaseUserQuestionHistoryService"; 
import { firebaseQuestionListService } from "../services/firebaseQuestionListService";
import { FirebaseQuestion, FirebaseQuestionStatus } from "../types/firebaseTypes";
import { AppError } from "../utils/errors"; 
import { createQuestionSchema, updateQuestionSchema, listQuestionsSchema, submitAnswerSchema } from "../validators/question.validator"; 
import { AuthenticatedRequest } from "../middleware/authMiddleware"; // Importar AuthenticatedRequest

// Criar uma nova questão (geralmente por admin/mentor)
export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { error, value } = createQuestionSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const createdBy = authReq.user?.uid;
        if (!createdBy || (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor")) {
            throw new AppError("Não autorizado a criar questões", 403);
        }

        const questionData: Partial<FirebaseQuestion> = {
            ...value,
            createdBy,
            status: value.status || FirebaseQuestionStatus.DRAFT, // Default para DRAFT
        };

        const newQuestion = await QuestionService.createQuestion(questionData as FirebaseQuestion);
        res.status(201).json(newQuestion);
    } catch (err) {
        next(err);
    }
};

// Obter uma questão pelo ID
export const getQuestionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questionId = req.params.id;
        const question = await QuestionService.getQuestionById(questionId);
        if (!question) {
            throw new AppError("Questão não encontrada", 404);
        }
        res.status(200).json(question);
    } catch (err) {
        next(err);
    }
};

// Listar questões com filtros e paginação
export const listQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { error, value } = listQuestionsSchema.validate(req.query);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }
        const result = await QuestionService.getQuestions(value);
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

// Atualizar uma questão (geralmente por admin/mentor)
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const questionId = req.params.id;
        const { error, value } = updateQuestionSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") {
            throw new AppError("Não autorizado a atualizar esta questão", 403);
        }
        
        const questionToUpdate = await QuestionService.getQuestionById(questionId);
        if (!questionToUpdate) {
            throw new AppError("Questão não encontrada para atualização", 404);
        }

        const updatedQuestion = await QuestionService.updateQuestion(questionId, value);
        res.status(200).json(updatedQuestion);
    } catch (err) {
        next(err);
    }
};

// Deletar uma questão (geralmente por admin/mentor)
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const questionId = req.params.id;
        if (authReq.user?.role !== "admin" && authReq.user?.role !== "mentor") {
            throw new AppError("Não autorizado a deletar esta questão", 403);
        }

        const questionToDelete = await QuestionService.getQuestionById(questionId);
        if (!questionToDelete) {
            throw new AppError("Questão não encontrada para deleção", 404);
        }

        await QuestionService.deleteQuestion(questionId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// Submeter resposta a uma questão
export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const questionId = req.params.id;
        const { error, value } = submitAnswerSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        const userId = authReq.user?.uid;
        if (!userId) {
            throw new AppError("Usuário não autenticado", 401);
        }

        const question = await QuestionService.getQuestionById(questionId);
        if (!question || !question.alternatives) {
            throw new AppError("Questão ou alternativas não encontradas", 404);
        }

        const selectedAlternativeId = value.alternativeId;
        const selectedAlternative = question.alternatives.find(alt => alt.id === selectedAlternativeId);

        if (!selectedAlternative) {
            throw new AppError("Alternativa selecionada não encontrada", 400);
        }

        const isCorrect = selectedAlternative.isCorrect;

        // Se a questão estiver em uma lista, atualizar o status da tentativa
        if (value.questionListId) {
            await firebaseQuestionListService.updateQuestionListItemAttempt(value.questionListId, questionId, isCorrect);
        }
        await UserQuestionHistoryService.recordUserAnswer(userId, questionId, selectedAlternativeId, isCorrect, question.subFilterIds, question.difficulty);
        
        res.status(200).json({
            questionId,
            selectedAlternativeId,
            isCorrect,
            correctAlternativeId: question.correctAlternativeId,
            explanation: question.explanation, 
        });
    } catch (err) {
        next(err);
    }
};

