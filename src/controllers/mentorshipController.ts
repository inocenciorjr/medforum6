import { Request, Response, NextFunction } from "express";
import * as MentorshipService from "../services/firebaseMentorshipService";
import { FirebaseMentorship, FirebaseMentorshipStatus, FirebaseMeetingFrequency } from "../types/firebaseTypes";
import { AppError } from "../utils/errors"; // Alterado de ExtendedError para AppError
import { 
    createMentorshipSchema, 
    updateMentorshipSchema, 
    listMentorshipsSchema, 
    updateMentorshipStatusSchema 
} from "../validators/mentorship.validator"; // Supondo que os validadores existem

// Criar uma nova mentoria (solicitação do estudante para um mentor)
export const requestMentorship = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { error, value } = createMentorshipSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400); // Alterado de ExtendedError para AppError
        }

        // @ts-ignore // req.user é adicionado pelo middleware de autenticação
        const studentId = req.user?.uid;
        if (!studentId) {
            throw new AppError("Usuário (estudante) não autenticado", 401); // Alterado de ExtendedError para AppError
        }

        const { mentorId, objectives, meetingFrequency, customFrequencyDays, meetingCount: totalMeetings } = value;

        const newMentorship = await MentorshipService.createMentorship(
            mentorId,
            studentId,
            objectives,
            meetingFrequency,
            customFrequencyDays,
            totalMeetings
        );
        res.status(201).json(newMentorship);
    } catch (err) {
        next(err);
    }
};

// Obter uma mentoria pelo ID
export const getMentorshipById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
        const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }

        // @ts-ignore
        const userId = req.user?.uid;
        // @ts-ignore
        if (mentorship.studentId !== userId && mentorship.mentorId !== userId && req.user?.role !== "admin") {
            throw new AppError("Não autorizado a visualizar esta mentoria", 403); // Alterado de ExtendedError para AppError
        }

        res.status(200).json(MentorshipService.getMentorshipSummary(mentorship));
    } catch (err) {
        next(err);
    }
};

// Listar mentorias (para estudante, mentor ou admin com filtros)
export const listMentorships = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { error, value } = listMentorshipsSchema.validate(req.query);
        if (error) {
            throw new AppError(error.details[0].message, 400); // Alterado de ExtendedError para AppError
        }

        // @ts-ignore
        const userId = req.user?.uid;
        // @ts-ignore
        const userRole = req.user?.role;

        let mentorships: FirebaseMentorship[] = [];

        if (userRole === "admin" && value.mentorId) {
            mentorships = await MentorshipService.getMentorshipsByMentor(value.mentorId);
        } else if (userRole === "admin" && value.studentId) {
            mentorships = await MentorshipService.getMentorshipsByStudent(value.studentId);
        } else if (userRole === "admin") {
            // Potencialmente uma listagem geral para admin, pode precisar de paginação
            mentorships = await MentorshipService.getActiveMentorships(); // Exemplo, pode precisar de mais filtros
        } else if (value.as === "mentor" || (userRole === "mentor" && !value.as)){
            mentorships = await MentorshipService.getMentorshipsByMentor(userId);
        } else if (value.as === "student" || (userRole === "student" && !value.as)) {
            mentorships = await MentorshipService.getMentorshipsByStudent(userId);
        } else {
             throw new AppError("Parâmetros de listagem inválidos ou não autorizado", 400); // Alterado de ExtendedError para AppError
        }
        
        // Aplicar filtros de status se presentes em 'value'
        if (value.status) {
            mentorships = mentorships.filter(m => m.status === value.status);
        }

        res.status(200).json(mentorships.map(MentorshipService.getMentorshipSummary));
    } catch (err) {
        next(err);
    }
};

// Atualizar uma mentoria (ex: objetivos, frequência pelo mentor ou estudante)
export const updateMentorshipDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
        const { error, value } = updateMentorshipSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400); // Alterado de ExtendedError para AppError
        }

        const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }

        // @ts-ignore
        const userId = req.user?.uid;
        // @ts-ignore
        if (mentorship.studentId !== userId && mentorship.mentorId !== userId && req.user?.role !== "admin") {
            throw new AppError("Não autorizado a atualizar esta mentoria", 403); // Alterado de ExtendedError para AppError
        }
        
        // Apenas certos campos podem ser atualizados por esta rota
        const { objectives, meetingFrequency, customFrequencyDays, totalMeetings } = value;
        const updatePayload: Partial<FirebaseMentorship> = {};
        if (objectives !== undefined) updatePayload.objectives = objectives;
        if (meetingFrequency !== undefined) {
            const updatedMentorship = await MentorshipService.updateMeetingFrequency(mentorshipId, meetingFrequency, customFrequencyDays);
            return res.status(200).json(MentorshipService.getMentorshipSummary(updatedMentorship!));
        }
        if (totalMeetings !== undefined) updatePayload.meetingCount = totalMeetings;

        if (Object.keys(updatePayload).length === 0) {
            return res.status(200).json(MentorshipService.getMentorshipSummary(mentorship)); // Nenhuma alteração válida
        }

        const updatedMentorship = await MentorshipService.updateMentorship(mentorshipId, updatePayload);
        res.status(200).json(MentorshipService.getMentorshipSummary(updatedMentorship!));
    } catch (err) {
        next(err);
    }
};

// Mentor aceita uma solicitação de mentoria
export const acceptMentorshipRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
        const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }
        // @ts-ignore
        if (mentorship.mentorId !== req.user?.uid) {
            throw new AppError("Apenas o mentor pode aceitar a solicitação", 403); // Alterado de ExtendedError para AppError
        }
        const acceptedMentorship = await MentorshipService.acceptMentorship(mentorshipId);
        res.status(200).json(MentorshipService.getMentorshipSummary(acceptedMentorship!));
    } catch (err) {
        next(err);
    }
};

// Cancelar uma mentoria (pelo mentor, estudante ou admin)
export const cancelMentorshipByUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
        const { reason } = req.body; // Opcional
        const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }
        // @ts-ignore
        const userId = req.user?.uid;
        // @ts-ignore
        if (mentorship.studentId !== userId && mentorship.mentorId !== userId && req.user?.role !== "admin") {
            throw new AppError("Não autorizado a cancelar esta mentoria", 403); // Alterado de ExtendedError para AppError
        }
        const cancelledMentorship = await MentorshipService.cancelMentorship(mentorshipId, reason);
        res.status(200).json(MentorshipService.getMentorshipSummary(cancelledMentorship!));
    } catch (err) {
        next(err);
    }
};

// Completar uma mentoria (pelo mentor)
export const completeMentorshipByMentor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
        const { rating, feedback } = req.body; // Opcional
        const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }
        // @ts-ignore
        if (mentorship.mentorId !== req.user?.uid) {
            throw new AppError("Apenas o mentor pode completar a mentoria", 403); // Alterado de ExtendedError para AppError
        }
        const completedMentorship = await MentorshipService.completeMentorship(mentorshipId, rating, feedback);
        res.status(200).json(MentorshipService.getMentorshipSummary(completedMentorship!));
    } catch (err) {
        next(err);
    }
};

// Registrar conclusão de uma reunião (pelo mentor)
export const recordMeetingCompletionByMentor = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const mentorshipId = req.params.id;
         const mentorship = await MentorshipService.getMentorship(mentorshipId);
        if (!mentorship) {
            throw new AppError("Mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }
        // @ts-ignore
        if (mentorship.mentorId !== req.user?.uid) {
            throw new AppError("Apenas o mentor pode registrar a conclusão da reunião", 403); // Alterado de ExtendedError para AppError
        }
        const updatedMentorship = await MentorshipService.recordMeetingCompletion(mentorshipId);
        res.status(200).json(MentorshipService.getMentorshipSummary(updatedMentorship!));
    } catch (err) {
        next(err);
    }
};

// Admin atualiza status de uma mentoria (para casos especiais)
export const updateMentorshipStatusByAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore
        if (req.user?.role !== "admin") {
            throw new AppError("Apenas administradores podem alterar o status diretamente", 403); // Alterado de ExtendedError para AppError
        }
        const mentorshipId = req.params.id;
        const { error, value } = updateMentorshipStatusSchema.validate(req.body);
        if (error) {
            throw new AppError(error.details[0].message, 400); // Alterado de ExtendedError para AppError
        }
        const { status, reason } = value;
        let updatedMentorship;
        if (status === FirebaseMentorshipStatus.CANCELLED) {
            updatedMentorship = await MentorshipService.cancelMentorship(mentorshipId, reason || "Cancelado pelo administrador");
        } else if (status === FirebaseMentorshipStatus.COMPLETED) {
            updatedMentorship = await MentorshipService.completeMentorship(mentorshipId, undefined, reason || "Completado pelo administrador");
        } else {
            updatedMentorship = await MentorshipService.updateMentorship(mentorshipId, { status });
        }
        
        if (!updatedMentorship) {
            throw new AppError("Falha ao atualizar status da mentoria ou mentoria não encontrada", 404); // Alterado de ExtendedError para AppError
        }
        res.status(200).json(MentorshipService.getMentorshipSummary(updatedMentorship));
    } catch (err) {
        next(err);
    }
};

