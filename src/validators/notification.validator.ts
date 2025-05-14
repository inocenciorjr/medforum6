import { body, param, query } from 'express-validator';

// Validation rules for creating a notification
export const createNotification = [
  body('userId')
    .if(body('isGlobal').not().equals(true))
    .notEmpty().withMessage('O ID do usuário é obrigatório para notificações não globais.')
    .isString().withMessage('O ID do usuário deve ser uma string.'),
  body('title')
    .notEmpty().withMessage('O título é obrigatório.')
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ max: 100 }).withMessage('O título não pode exceder 100 caracteres.'),
  body('message')
    .notEmpty().withMessage('A mensagem é obrigatória.')
    .isString().withMessage('A mensagem deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A mensagem não pode exceder 500 caracteres.'),
  body('type')
    .notEmpty().withMessage('O tipo é obrigatório.')
    .isIn(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACHIEVEMENT', 'SYSTEM'])
    .withMessage('Tipo inválido.'),
  body('data')
    .optional()
    .isObject().withMessage('Os dados adicionais devem ser um objeto.'),
  body('isGlobal')
    .optional()
    .isBoolean().withMessage('O campo isGlobal deve ser um booleano.')
];

// Validation rules for getting user notifications
export const getUserNotifications = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.'),
  query('unreadOnly')
    .optional()
    .isBoolean().withMessage('O campo unreadOnly deve ser um booleano.')
];

// Validation rules for getting a notification by ID
export const getNotificationById = [
  param('notificationId')
    .isString().withMessage('ID da notificação inválido.')
];

// Validation rules for marking a notification as read
export const markAsRead = [
  param('notificationId')
    .isString().withMessage('ID da notificação inválido.')
];

// Validation rules for deleting a notification
export const deleteNotification = [
  param('notificationId')
    .isString().withMessage('ID da notificação inválido.')
];

// Validation rules for sending bulk notifications
export const sendBulkNotifications = [
  body('userIds')
    .isArray({ min: 1 }).withMessage('A lista de usuários deve conter pelo menos um ID.')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every(id => typeof id === 'string');
    }).withMessage('Todos os IDs de usuário devem ser strings.'),
  body('title')
    .notEmpty().withMessage('O título é obrigatório.')
    .isString().withMessage('O título deve ser uma string.')
    .isLength({ max: 100 }).withMessage('O título não pode exceder 100 caracteres.'),
  body('message')
    .notEmpty().withMessage('A mensagem é obrigatória.')
    .isString().withMessage('A mensagem deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A mensagem não pode exceder 500 caracteres.'),
  body('type')
    .notEmpty().withMessage('O tipo é obrigatório.')
    .isIn(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACHIEVEMENT', 'SYSTEM'])
    .withMessage('Tipo inválido.'),
  body('data')
    .optional()
    .isObject().withMessage('Os dados adicionais devem ser um objeto.')
];

// Export all validators
export default {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
  sendBulkNotifications
};