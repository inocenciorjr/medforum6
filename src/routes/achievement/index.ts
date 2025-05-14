import { Router } from 'express';
import achievementController from '../../controllers/achievement/achievementController';
import { validate } from '../../middlewares/validation.middleware';
import achievementValidator from '../../validators/achievement.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route GET /api/achievements
 * @desc Obtém todas as conquistas disponíveis
 * @access Public (com autenticação opcional para incluir conquistas ocultas para admins)
 */
router.get('/', 
  optionalAuthenticate, 
  validate(achievementValidator.getAchievements), 
  achievementController.getAllAchievements
);

/**
 * @route GET /api/achievements/:achievementId
 * @desc Obtém uma conquista específica pelo ID
 * @access Public (com autenticação opcional para conquistas ocultas)
 */
router.get('/:achievementId', 
  optionalAuthenticate, 
  achievementController.getAchievementById
);

/**
 * @route POST /api/achievements
 * @desc Cria uma nova conquista (apenas admin)
 * @access Private (Admin)
 */
router.post('/', 
  authenticate, 
  isAdmin, 
  validate(achievementValidator.createAchievement), 
  achievementController.createAchievement
);

/**
 * @route PUT /api/achievements/:achievementId
 * @desc Atualiza uma conquista existente (apenas admin)
 * @access Private (Admin)
 */
router.put('/:achievementId', 
  authenticate, 
  isAdmin, 
  validate(achievementValidator.updateAchievement), 
  achievementController.updateAchievement
);

/**
 * @route DELETE /api/achievements/:achievementId
 * @desc Exclui uma conquista (apenas admin)
 * @access Private (Admin)
 */
router.delete('/:achievementId', 
  authenticate, 
  isAdmin, 
  achievementController.deleteAchievement
);

/**
 * @route GET /api/achievements/user/me
 * @desc Obtém as conquistas do usuário autenticado
 * @access Private
 */
router.get('/user/me', 
  authenticate, 
  validate(achievementValidator.getUserAchievements), 
  achievementController.getUserAchievements
);

/**
 * @route POST /api/achievements/user/:userId/:achievementId
 * @desc Atribui uma conquista a um usuário (apenas admin)
 * @access Private (Admin)
 */
router.post('/user/:userId/:achievementId', 
  authenticate, 
  isAdmin, 
  validate(achievementValidator.assignAchievementToUser), 
  achievementController.assignAchievementToUser
);

/**
 * @route DELETE /api/achievements/user/:userId/:achievementId
 * @desc Remove uma conquista de um usuário (apenas admin)
 * @access Private (Admin)
 */
router.delete('/user/:userId/:achievementId', 
  authenticate, 
  isAdmin, 
  validate(achievementValidator.assignAchievementToUser), 
  achievementController.removeAchievementFromUser
);

/**
 * @route PUT /api/achievements/user/:userId/:achievementId/progress
 * @desc Atualiza o progresso de uma conquista para um usuário (apenas admin)
 * @access Private (Admin)
 */
router.put('/user/:userId/:achievementId/progress', 
  authenticate, 
  isAdmin, 
  validate(achievementValidator.updateUserAchievementProgress), 
  achievementController.updateUserAchievementProgress
);

export default router;