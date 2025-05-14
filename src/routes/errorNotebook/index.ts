import { Router } from 'express';
import errorNotebookController from '../../controllers/errorNotebook/errorNotebookController';
import { validate } from '../../middlewares/validation.middleware';
import errorNotebookValidator from '../../validators/errorNotebook.validator';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /api/error-notebook
 * @desc Adiciona uma questão ao caderno de erros
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(errorNotebookValidator.addErrorEntry), 
  errorNotebookController.addErrorEntry
);

/**
 * @route GET /api/error-notebook
 * @desc Obtém todas as entradas do caderno de erros do usuário
 * @access Private
 */
router.get('/', 
  authenticate, 
  validate(errorNotebookValidator.getUserErrorEntries), 
  errorNotebookController.getUserErrorEntries
);

/**
 * @route GET /api/error-notebook/due
 * @desc Obtém as entradas do caderno de erros que precisam ser revisadas hoje
 * @access Private
 */
router.get('/due', 
  authenticate, 
  validate(errorNotebookValidator.getDueReviews), 
  errorNotebookController.getDueReviews
);

/**
 * @route GET /api/error-notebook/statistics
 * @desc Obtém estatísticas do caderno de erros do usuário
 * @access Private
 */
router.get('/statistics', 
  authenticate, 
  errorNotebookController.getErrorNotebookStatistics
);

/**
 * @route POST /api/error-notebook/import
 * @desc Importa questões para o caderno de erros a partir de um simulado
 * @access Private
 */
router.post('/import', 
  authenticate, 
  validate(errorNotebookValidator.importFromSimulatedExam), 
  errorNotebookController.importFromSimulatedExam
);

/**
 * @route GET /api/error-notebook/export/pdf
 * @desc Exporta o caderno de erros para PDF
 * @access Private
 */
router.get('/export/pdf', 
  authenticate, 
  validate(errorNotebookValidator.exportToPdf), 
  errorNotebookController.exportToPdf
);

/**
 * @route GET /api/error-notebook/:entryId
 * @desc Obtém uma entrada do caderno de erros pelo ID
 * @access Private
 */
router.get('/:entryId', 
  authenticate, 
  validate(errorNotebookValidator.getErrorEntryById), 
  errorNotebookController.getErrorEntryById
);

/**
 * @route PUT /api/error-notebook/:entryId
 * @desc Atualiza uma entrada do caderno de erros
 * @access Private
 */
router.put('/:entryId', 
  authenticate, 
  validate(errorNotebookValidator.updateErrorEntry), 
  errorNotebookController.updateErrorEntry
);

/**
 * @route DELETE /api/error-notebook/:entryId
 * @desc Remove uma entrada do caderno de erros
 * @access Private
 */
router.delete('/:entryId', 
  authenticate, 
  validate(errorNotebookValidator.deleteErrorEntry), 
  errorNotebookController.deleteErrorEntry
);

/**
 * @route POST /api/error-notebook/:entryId/review
 * @desc Registra uma revisão de uma entrada do caderno de erros
 * @access Private
 */
router.post('/:entryId/review', 
  authenticate, 
  validate(errorNotebookValidator.reviewErrorEntry), 
  errorNotebookController.reviewErrorEntry
);

/**
 * @route GET /api/error-notebook/:entryId/review-history
 * @desc Obtém o histórico de revisões de uma entrada do caderno de erros
 * @access Private
 */
router.get('/:entryId/review-history', 
  authenticate, 
  validate(errorNotebookValidator.getErrorEntryReviewHistory), 
  errorNotebookController.getErrorEntryReviewHistory
);

/**
 * @route PATCH /api/error-notebook/:entryId/archive
 * @desc Arquiva ou desarquiva uma entrada do caderno de erros
 * @access Private
 */
router.patch('/:entryId/archive', 
  authenticate, 
  validate(errorNotebookValidator.toggleArchiveErrorEntry), 
  errorNotebookController.toggleArchiveErrorEntry
);

/**
 * @route PATCH /api/error-notebook/:entryId/mastered
 * @desc Marca ou desmarca uma entrada do caderno de erros como dominada
 * @access Private
 */
router.patch('/:entryId/mastered', 
  authenticate, 
  validate(errorNotebookValidator.toggleMasteredErrorEntry), 
  errorNotebookController.toggleMasteredErrorEntry
);

export default router;