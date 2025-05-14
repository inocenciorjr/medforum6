import { Router } from 'express';
import mentorshipController from '../../controllers/mentorship/mentorshipController';
import { validate } from '../../middlewares/validation.middleware';
import mentorshipValidator from '../../validators/mentorship.validator';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/mentorships
 * @desc Solicita uma nova mentoria
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(mentorshipValidator.requestMentorship), 
  mentorshipController.requestMentorship
);

/**
 * @route GET /api/mentorships
 * @desc Obtém as mentorias do usuário autenticado
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(mentorshipValidator.getUserMentorships), 
  mentorshipController.getUserMentorships
);

/**
 * @route GET /api/mentorships/all
 * @desc Obtém todas as mentorias (apenas para administradores)
 * @access Private (Admin)
 */
router.get('/all', 
  authenticate, 
  isAdmin,
  validate(mentorshipValidator.getAllMentorships), 
  mentorshipController.getAllMentorships
);

/**
 * @route GET /api/mentorships/subjects
 * @desc Obtém os assuntos disponíveis para mentoria
 * @access Public
 */
router.get('/subjects', 
  mentorshipController.getMentorshipSubjects
);

/**
 * @route GET /api/mentorships/mentors
 * @desc Obtém os mentores disponíveis
 * @access Public
 */
router.get('/mentors', 
  validate(mentorshipValidator.getAvailableMentors), 
  mentorshipController.getAvailableMentors
);

/**
 * @route GET /api/mentorships/:mentorshipId
 * @desc Obtém uma mentoria pelo ID
 * @access Private
 */
router.get('/:mentorshipId', 
  authenticate, 
  validate(mentorshipValidator.getMentorshipById), 
  mentorshipController.getMentorshipById
);

/**
 * @route PATCH /api/mentorships/:mentorshipId/accept
 * @desc Aceita uma solicitação de mentoria
 * @access Private
 */
router.patch('/:mentorshipId/accept', 
  authenticate, 
  validate(mentorshipValidator.getMentorshipById), 
  mentorshipController.acceptMentorship
);

/**
 * @route PATCH /api/mentorships/:mentorshipId/reject
 * @desc Rejeita uma solicitação de mentoria
 * @access Private
 */
router.patch('/:mentorshipId/reject', 
  authenticate, 
  validate(mentorshipValidator.rejectMentorship), 
  mentorshipController.rejectMentorship
);

/**
 * @route PATCH /api/mentorships/:mentorshipId/cancel
 * @desc Cancela uma mentoria
 * @access Private
 */
router.patch('/:mentorshipId/cancel', 
  authenticate, 
  validate(mentorshipValidator.cancelMentorship), 
  mentorshipController.cancelMentorship
);

/**
 * @route PATCH /api/mentorships/:mentorshipId/complete
 * @desc Conclui uma mentoria
 * @access Private
 */
router.patch('/:mentorshipId/complete', 
  authenticate, 
  validate(mentorshipValidator.completeMentorship), 
  mentorshipController.completeMentorship
);

/**
 * @route POST /api/mentorships/:mentorshipId/subjects
 * @desc Adiciona um assunto a uma mentoria
 * @access Private
 */
router.post('/:mentorshipId/subjects', 
  authenticate, 
  validate(mentorshipValidator.addSubjectToMentorship), 
  mentorshipController.addSubjectToMentorship
);

/**
 * @route DELETE /api/mentorships/:mentorshipId/subjects/:subjectId
 * @desc Remove um assunto de uma mentoria
 * @access Private
 */
router.delete('/:mentorshipId/subjects/:subjectId', 
  authenticate, 
  validate(mentorshipValidator.removeSubjectFromMentorship), 
  mentorshipController.removeSubjectFromMentorship
);

export default router;