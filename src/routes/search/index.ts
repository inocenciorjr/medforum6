import { Router } from "express";
import searchController from "../../controllers/search/searchController";
import searchValidator from "../../validators/search.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { rateLimit } from "../../middlewares/rateLimit.middleware";

const router = Router();

/**
 * @route   GET /api/search
 * @desc    Busca global em múltiplas entidades
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  rateLimit("search_global", 100, 60), // 100 por minuto
  validate(searchValidator.searchGlobal),
  searchController.searchGlobal
);

/**
 * @route   GET /api/search/users
 * @desc    Busca usuários
 * @access  Private
 */
router.get(
  "/users",
  authenticate,
  rateLimit("search_users", 100, 60), // 100 por minuto
  validate(searchValidator.searchUsers),
  searchController.searchUsers
);

/**
 * @route   GET /api/search/decks
 * @desc    Busca decks
 * @access  Private
 */
router.get(
  "/decks",
  authenticate,
  rateLimit("search_decks", 100, 60), // 100 por minuto
  validate(searchValidator.searchDecks),
  searchController.searchDecks
);

/**
 * @route   GET /api/search/articles
 * @desc    Busca artigos
 * @access  Private
 */
router.get(
  "/articles",
  authenticate,
  rateLimit("search_articles", 100, 60), // 100 por minuto
  validate(searchValidator.searchArticles),
  searchController.searchArticles
);

/**
 * @route   GET /api/search/questions
 * @desc    Busca questões
 * @access  Private
 */
router.get(
  "/questions",
  authenticate,
  rateLimit("search_questions", 100, 60), // 100 por minuto
  validate(searchValidator.searchQuestions),
  searchController.searchQuestions
);

/**
 * @route   GET /api/search/mentorships
 * @desc    Busca mentorias
 * @access  Private
 */
router.get(
  "/mentorships",
  authenticate,
  rateLimit("search_mentorships", 100, 60), // 100 por minuto
  validate(searchValidator.searchMentorships),
  searchController.searchMentorships
);

/**
 * @route   GET /api/search/suggestions
 * @desc    Obtém sugestões de busca
 * @access  Private
 */
router.get(
  "/suggestions",
  authenticate,
  rateLimit("search_suggestions", 200, 60), // 200 por minuto
  validate(searchValidator.getSearchSuggestions),
  searchController.getSearchSuggestions
);

/**
 * @route   GET /api/search/popular
 * @desc    Obtém buscas populares
 * @access  Private
 */
router.get(
  "/popular",
  authenticate,
  rateLimit("search_popular", 100, 60), // 100 por minuto
  validate(searchValidator.getPopularSearches),
  searchController.getPopularSearches
);

export default router;