import { Router } from 'express';
import notificationController from '../../controllers/notification/notificationController';
import { validate } from '../../middlewares/validation.middleware';
import notificationValidator from '../../validators/notification.validator';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/notifications
 * @desc Cria uma nova notificação (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin,
  validate(notificationValidator.createNotification), 
  notificationController.createNotification
);

/**
 * @route GET /api/notifications
 * @desc Obtém todas as notificações do usuário
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(notificationValidator.getUserNotifications), 
  notificationController.getUserNotifications
);

/**
 * @route GET /api/notifications/:notificationId
 * @desc Obtém uma notificação pelo ID
 * @access Private (destinatário ou admin)
 */
router.get('/:notificationId', 
  authenticate, 
  validate(notificationValidator.getNotificationById), 
  notificationController.getNotificationById
);

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Marca uma notificação como lida
 * @access Private (destinatário)
 */
router.put('/:notificationId/read', 
  authenticate, 
  validate(notificationValidator.markAsRead), 
  notificationController.markAsRead
);

/**
 * @route PUT /api/notifications/read-all
 * @desc Marca todas as notificações do usuário como lidas
 * @access Private
 */
router.put('/read-all', 
  authenticate, 
  notificationController.markAllAsRead
);

/**
 * @route DELETE /api/notifications/:notificationId
 * @desc Exclui uma notificação
 * @access Private (destinatário ou admin)
 */
router.delete('/:notificationId', 
  authenticate, 
  validate(notificationValidator.deleteNotification), 
  notificationController.deleteNotification
);

/**
 * @route GET /api/notifications/count/unread
 * @desc Obtém o contador de notificações não lidas
 * @access Private
 */
router.get('/count/unread', 
  authenticate, 
  notificationController.getUnreadCount
);

/**
 * @route POST /api/notifications/bulk
 * @desc Envia uma notificação para vários usuários (apenas para administradores)
 * @access Private (Admin)
 */
router.post('/bulk', 
  authenticate, 
  isAdmin,
  validate(notificationValidator.sendBulkNotifications), 
  notificationController.sendBulkNotifications
);

export default router;