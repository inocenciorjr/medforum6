import Joi from "joi";
import { FirebaseMentorshipStatus, FirebaseMeetingFrequency } from "../types/firebaseTypes";

export const createMentorshipSchema = Joi.object({
    mentorId: Joi.string().required(),
    // studentId will be from the authenticated user making the request
    objectives: Joi.string().min(10).max(5000).required(),
    meetingFrequency: Joi.string().valid(...Object.values(FirebaseMeetingFrequency)).optional().default(FirebaseMeetingFrequency.WEEKLY),
    customFrequencyDays: Joi.number().integer().min(1).when('meetingFrequency', {
        is: FirebaseMeetingFrequency.CUSTOM,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
    }),
    totalMeetings: Joi.number().integer().min(0).optional().default(0), // 0 pode significar indefinido ou contínuo
});

export const updateMentorshipSchema = Joi.object({
    objectives: Joi.string().min(10).max(5000).optional(),
    meetingFrequency: Joi.string().valid(...Object.values(FirebaseMeetingFrequency)).optional(),
    customFrequencyDays: Joi.number().integer().min(1).when('meetingFrequency', {
        is: FirebaseMeetingFrequency.CUSTOM,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
    }),
    totalMeetings: Joi.number().integer().min(0).optional(),
    // Status é atualizado por rotas específicas (accept, cancel, complete)
}).min(1);

export const listMentorshipsSchema = Joi.object({
    as: Joi.string().valid("mentor", "student").optional(), // Para o usuário especificar qual papel quer listar, se tiver ambos
    mentorId: Joi.string().optional(), // Para admin listar por mentor específico
    studentId: Joi.string().optional(), // Para admin listar por estudante específico
    status: Joi.string().valid(...Object.values(FirebaseMentorshipStatus)).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
});

export const updateMentorshipStatusSchema = Joi.object({
    status: Joi.string().valid(...Object.values(FirebaseMentorshipStatus)).required(),
    reason: Joi.string().max(1000).optional().allow(null, ""), // Para cancelamento ou conclusão por admin
});

// Validador para quando o mentor completa a mentoria, podendo adicionar rating/feedback
export const completeMentorshipPayloadSchema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).optional().allow(null),
    feedback: Joi.string().max(2000).optional().allow(null, ""),
});

// Validador para quando o usuário (mentor/estudante) cancela a mentoria
export const cancelMentorshipPayloadSchema = Joi.object({
    reason: Joi.string().max(1000).optional().allow(null, ""),
});

