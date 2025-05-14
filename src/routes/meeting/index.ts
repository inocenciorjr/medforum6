import { Router } from 'express';
import meetingController from '../../controllers/meeting/meetingController';
import { validate } from '../../middlewares/validation.middleware';
import meetingValidator from '../../validators/meeting.validator';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';

const router = Router();

/**
 * @route POST /api/meetings
 * @desc Cria uma nova reunião
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(meetingValidator.createMeeting), 
  meetingController.createMeeting
);

/**
 * @route GET /api/meetings/:meetingId
 * @desc Obtém uma reunião pelo ID
 * @access Private
 */
router.get('/:meetingId', 
  authenticate, 
  validate(meetingValidator.getMeetingById), 
  meetingController.getMeetingById
);

/**
 * @route PUT /api/meetings/:meetingId
 * @desc Atualiza uma reunião
 * @access Private
 */
router.put('/:meetingId', 
  authenticate, 
  validate(meetingValidator.updateMeeting), 
  meetingController.updateMeeting
);

/**
 * @route PATCH /api/meetings/:meetingId/confirm
 * @desc Confirma uma reunião
 * @access Private
 */
router.patch('/:meetingId/confirm', 
  authenticate, 
  validate(meetingValidator.getMeetingById), 
  meetingController.confirmMeeting
);

/**
 * @route PATCH /api/meetings/:meetingId/cancel
 * @desc Cancela uma reunião
 * @access Private
 */
router.patch('/:meetingId/cancel', 
  authenticate, 
  validate(meetingValidator.cancelMeeting), 
  meetingController.cancelMeeting
);

/**
 * @route PATCH /api/meetings/:meetingId/complete
 * @desc Conclui uma reunião
 * @access Private
 */
router.patch('/:meetingId/complete', 
  authenticate, 
  validate(meetingValidator.completeMeeting), 
  meetingController.completeMeeting
);

/**
 * @route GET /api/meetings/mentorship/:mentorshipId
 * @desc Obtém as reuniões de uma mentoria
 * @access Private
 */
router.get('/mentorship/:mentorshipId', 
  authenticate, 
  validate(meetingValidator.getMeetingsByMentorship), 
  meetingController.getMeetingsByMentorship
);

/**
 * @route GET /api/meetings/upcoming
 * @desc Obtém as próximas reuniões do usuário
 * @access Private
 */
router.get('/upcoming/list', 
  authenticate, 
  validate(meetingValidator.getUpcomingMeetings), 
  meetingController.getUpcomingMeetings
);

/**
 * @route GET /api/meetings/history
 * @desc Obtém o histórico de reuniões do usuário
 * @access Private
 */
router.get('/history/list', 
  authenticate, 
  validate(meetingValidator.getMeetingHistory), 
  meetingController.getMeetingHistory
);

/**
 * @route POST /api/meetings/:meetingId/resources
 * @desc Adiciona um recurso a uma reunião
 * @access Private
 */
router.post('/:meetingId/resources', 
  authenticate, 
  validate(meetingValidator.addResourceToMeeting), 
  meetingController.addResourceToMeeting
);

/**
 * @route DELETE /api/meetings/:meetingId/resources/:resourceId
 * @desc Remove um recurso de uma reunião
 * @access Private
 */
router.delete('/:meetingId/resources/:resourceId', 
  authenticate, 
  validate(meetingValidator.removeResourceFromMeeting), 
  meetingController.removeResourceFromMeeting
);

export default router;