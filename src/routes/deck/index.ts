import { Router } from 'express';
import deckController from '../../controllers/deck/deckController';
import { validate } from '../../middlewares/validation.middleware';
import deckValidator from '../../validators/deck.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/decks
 * @desc Obtém todos os decks públicos ou do usuário autenticado
 * @access Public (com autenticação opcional para incluir decks privados)
 */
router.get('/', 
  optionalAuthenticate, 
  validate(deckValidator.getDecks), 
  deckController.getAllDecks
);

/**
 * @route GET /api/decks/:deckId
 * @desc Obtém um deck específico pelo ID
 * @access Public (com autenticação opcional para decks privados)
 */
router.get('/:deckId', 
  optionalAuthenticate, 
  deckController.getDeckById
);

/**
 * @route POST /api/decks
 * @desc Cria um novo deck
 * @access Private
 */
router.post('/', 
  authenticate, 
  validate(deckValidator.createDeck), 
  deckController.createDeck
);

/**
 * @route PUT /api/decks/:deckId
 * @desc Atualiza um deck existente
 * @access Private
 */
router.put('/:deckId', 
  authenticate, 
  validate(deckValidator.updateDeck), 
  deckController.updateDeck
);

/**
 * @route DELETE /api/decks/:deckId
 * @desc Exclui um deck
 * @access Private
 */
router.delete('/:deckId', 
  authenticate, 
  deckController.deleteDeck
);

/**
 * @route GET /api/decks/user/me
 * @desc Obtém todos os decks criados pelo usuário autenticado
 * @access Private
 */
router.get('/user/me', 
  authenticate, 
  validate(deckValidator.getDecks), 
  deckController.getMyDecks
);

/**
 * @route GET /api/decks/categories/all
 * @desc Obtém todas as categorias de decks disponíveis
 * @access Public
 */
router.get('/categories/all', 
  deckController.getDeckCategories
);

/**
 * @route GET /api/decks/tags/all
 * @desc Obtém todas as tags de decks disponíveis
 * @access Public
 */
router.get('/tags/all', 
  deckController.getDeckTags
);

/**
 * @route POST /api/decks/:deckId/duplicate
 * @desc Duplica um deck existente para o usuário autenticado
 * @access Private
 */
router.post('/:deckId/duplicate', 
  authenticate, 
  validate(deckValidator.duplicateDeck), 
  deckController.duplicateDeck
);

export default router;