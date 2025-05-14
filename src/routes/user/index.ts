import { Router } from 'express';
import * as userController from '../../controllers/user/userController';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Rotas de perfil
router.get('/profile', authenticate, userController.getUserProfile);
router.put('/profile', authenticate, userController.updateUserProfile);

// Rotas de sessões de estudo
router.post('/study-sessions', authenticate, userController.createStudySession);
router.get('/study-sessions', authenticate, userController.getUserStudySessions);
router.put('/study-sessions/:id', authenticate, userController.updateStudySession);
router.delete('/study-sessions/:id', authenticate, userController.deleteStudySession);

// Rotas de notificações
router.get('/notifications', authenticate, userController.getUserNotifications);
router.put('/notifications/:id/read', authenticate, userController.markNotificationAsRead);
router.put('/notifications/read-all', authenticate, userController.markAllNotificationsAsRead);
router.delete('/notifications/:id', authenticate, userController.deleteNotification);
router.put('/notification-preferences', authenticate, userController.updateNotificationPreferences);

// Rotas de estatísticas e conquistas
router.get('/statistics', authenticate, userController.getUserStatistics);
router.get('/achievements', authenticate, userController.getUserAchievements);

export default router;