import { Router } from "express";
import * as articleController from "../controllers/articleController";
import { authenticate } from "../middleware/authMiddleware"; // Supondo que existe um middleware de autenticação
import { isAdminOrAuthor } from "../middleware/authorizationMiddleware"; // Supondo que existe um middleware de autorização

const router = Router();

// Rotas públicas
router.get("/", articleController.listArticles);
router.get("/:id", articleController.getArticleById);

// Rotas autenticadas
router.post("/", authenticate, articleController.createArticle);
router.put("/:id", authenticate, isAdminOrAuthor("article"), articleController.updateArticle); // isAdminOrAuthor verifica se é admin ou autor do artigo
router.delete("/:id", authenticate, isAdminOrAuthor("article"), articleController.deleteArticle);

export default router;

