import { Router } from 'express';
import flashcardController from '../../controllers/flashcard/flashcardController';
import { validate } from '../../middlewares/validation.middleware';
import flashcardValidator from '../../validators/flashcard.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/decks/:deckId/flashcards
 * @desc Obtém todos os flashcards de um deck
 * @access Public (com autenticação opcional para decks privados)
 */
router.get('/decks/:deckId/flashcards', 
  optionalAuthenticate, 
  flashcardController.getFlashcardsByDeck
);

/**
 * @route GET /api/flashcards/:flashcardId
 * @desc Obtém um flashcard específico pelo ID
 * @access Public (com autenticação opcional para flashcards de decks privados)
 */
router.get('/:flashcardId', 
  optionalAuthenticate, 
  flashcardController.getFlashcardById
);

/**
 * @route POST /api/decks/:deckId/flashcards
 * @desc Cria um novo flashcard
 * @access Private
 */
router.post('/decks/:deckId/flashcards', 
  authenticate, 
  validate(flashcardValidator.createFlashcard), 
  flashcardController.createFlashcard
);

/**
 * @route PUT /api/flashcards/:flashcardId
 * @desc Atualiza um flashcard existente
 * @access Private
 */
router.put('/:flashcardId', 
  authenticate, 
  validate(flashcardValidator.updateFlashcard), 
  flashcardController.updateFlashcard
);

/**
 * @route DELETE /api/flashcards/:flashcardId
 * @desc Exclui um flashcard
 * @access Private
 */
router.delete('/:flashcardId', 
  authenticate, 
  flashcardController.deleteFlashcard
);

/**
 * @route POST /api/flashcards/:flashcardId/interactions
 * @desc Registra uma interação do usuário com um flashcard
 * @access Private
 */
router.post('/:flashcardId/interactions', 
  authenticate, 
  validate(flashcardValidator.recordFlashcardInteraction), 
  flashcardController.recordFlashcardInteraction
);

/**
 * @route GET /api/flashcards/:flashcardId/interactions
 * @desc Obtém o histórico de interações do usuário com um flashcard
 * @access Private
 */
router.get('/:flashcardId/interactions', 
  authenticate, 
  flashcardController.getFlashcardInteractionHistory
);

/**
 * @route GET /api/decks/:deckId/review
 * @desc Obtém flashcards para revisão com base no algoritmo de repetição espaçada
 * @access Private
 */
router.get('/decks/:deckId/review', 
  authenticate, 
  validate(flashcardValidator.getFlashcardsForReview), 
  flashcardController.getFlashcardsForReview
);

/**
 * @route GET /api/decks/:deckId/statistics
 * @desc Obtém estatísticas de estudo do usuário para um deck específico
 * @access Private
 */
router.get('/decks/:deckId/statistics', 
  authenticate, 
  flashcardController.getDeckStudyStatistics
);

export default router;