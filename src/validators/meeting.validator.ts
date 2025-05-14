import { body, param, query } from 'express-validator';
import { MeetingStatus } from '../types/firebaseTypes';

// Validation rules for creating a meeting
export const createMeeting = [
  body('mentorshipId')
    .notEmpty().withMessage('O ID da mentoria é obrigatório.')
    .isString().withMessage('O ID da mentoria deve ser uma string.'),
  body('title')
    .notEmpty().withMessage('O título é obrigatório.')
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('startTime')
    .notEmpty().withMessage('O horário de início é obrigatório.')
    .isISO8601().withMessage('O horário de início deve estar no formato ISO8601.'),
  body('endTime')
    .notEmpty().withMessage('O horário de término é obrigatório.')
    .isISO8601().withMessage('O horário de término deve estar no formato ISO8601.'),
  body('meetingUrl')
    .optional()
    .isURL().withMessage('A URL da reunião deve ser uma URL válida.'),
  body('meetingType')
    .optional()
    .isIn(['video', 'audio', 'in-person']).withMessage('Tipo de reunião inválido. Use "video", "audio" ou "in-person".'),
  body('agenda')
    .optional()
    .isArray().withMessage('A agenda deve ser um array.'),
  body('agenda.*.title')
    .optional()
    .isString().withMessage('O título do item da agenda deve ser uma string.'),
  body('agenda.*.duration')
    .optional()
    .isInt({ min: 1 }).withMessage('A duração do item da agenda deve ser um número inteiro positivo.')
];

// Validation rules for getting a meeting by ID
export const getMeetingById = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.')
];

// Validation rules for updating a meeting
export const updateMeeting = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.'),
  body('title')
    .optional()
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('startTime')
    .optional()
    .isISO8601().withMessage('O horário de início deve estar no formato ISO8601.'),
  body('endTime')
    .optional()
    .isISO8601().withMessage('O horário de término deve estar no formato ISO8601.'),
  body('meetingUrl')
    .optional()
    .isURL().withMessage('A URL da reunião deve ser uma URL válida.'),
  body('meetingType')
    .optional()
    .isIn(['video', 'audio', 'in-person']).withMessage('Tipo de reunião inválido. Use "video", "audio" ou "in-person".'),
  body('agenda')
    .optional()
    .isArray().withMessage('A agenda deve ser um array.'),
  body('agenda.*.title')
    .optional()
    .isString().withMessage('O título do item da agenda deve ser uma string.'),
  body('agenda.*.duration')
    .optional()
    .isInt({ min: 1 }).withMessage('A duração do item da agenda deve ser um número inteiro positivo.'),
  body('notes')
    .optional()
    .isString().withMessage('As anotações devem ser uma string.'),
  body('recordingUrl')
    .optional()
    .isURL().withMessage('A URL da gravação deve ser uma URL válida.'),
  body('resources')
    .optional()
    .isArray().withMessage('Os recursos devem ser um array.')
];

// Validation rules for canceling a meeting
export const cancelMeeting = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.'),
  body('reason')
    .notEmpty().withMessage('O motivo do cancelamento é obrigatório.')
    .isString().withMessage('O motivo deve ser uma string.')
    .isLength({ max: 500 }).withMessage('O motivo não pode exceder 500 caracteres.')
];

// Validation rules for completing a meeting
export const completeMeeting = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.'),
  body('notes')
    .optional()
    .isString().withMessage('As anotações devem ser uma string.'),
  body('recordingUrl')
    .optional()
    .isURL().withMessage('A URL da gravação deve ser uma URL válida.'),
  body('resources')
    .optional()
    .isArray().withMessage('Os recursos devem ser um array.')
];

// Validation rules for getting meetings by mentorship
export const getMeetingsByMentorship = [
  param('mentorshipId')
    .isString().withMessage('ID da mentoria inválido.'),
  query('status')
    .optional()
    .isIn(Object.values(MeetingStatus))
    .withMessage('Status inválido.')
];

// Validation rules for getting upcoming meetings
export const getUpcomingMeetings = [
  query('role')
    .optional()
    .isIn(['mentor', 'student'])
    .withMessage('Papel inválido. Use "mentor" ou "student".'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.')
];

// Validation rules for getting meeting history
export const getMeetingHistory = [
  query('role')
    .optional()
    .isIn(['mentor', 'student'])
    .withMessage('Papel inválido. Use "mentor" ou "student".'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('O limite deve ser um número inteiro entre 1 e 50.')
];

// Validation rules for adding a resource to a meeting
export const addResourceToMeeting = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.'),
  body('title')
    .notEmpty().withMessage('O título é obrigatório.')
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ min: 3, max: 100 }).withMessage('O título deve ter entre 3 e 100 caracteres.'),
  body('url')
    .notEmpty().withMessage('A URL é obrigatória.')
    .isURL().withMessage('A URL deve ser uma URL válida.'),
  body('type')
    .optional()
    .isIn(['link', 'document', 'video', 'image', 'other']).withMessage('Tipo de recurso inválido. Use "link", "document", "video", "image" ou "other".'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 200 }).withMessage('A descrição não pode exceder 200 caracteres.')
];

// Validation rules for removing a resource from a meeting
export const removeResourceFromMeeting = [
  param('meetingId')
    .isString().withMessage('ID da reunião inválido.'),
  param('resourceId')
    .isString().withMessage('ID do recurso inválido.')
];

// Export all validators
export default {
  createMeeting,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  completeMeeting,
  getMeetingsByMentorship,
  getUpcomingMeetings,
  getMeetingHistory,
  addResourceToMeeting,
  removeResourceFromMeeting
};