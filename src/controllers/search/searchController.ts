import { Request, Response } from "express";
import { AppError, asyncHandler } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { admin } from "../../config/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

/**
 * Controlador para funcionalidades de busca global na plataforma
 */
class SearchController {
  /**
   * Obtém o ID do usuário autenticado
   */
  private getAuthenticatedUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized("Usuário não autenticado");
    }
    return userId;
  }

  /**
   * Realiza uma busca global em múltiplas entidades
   * Acesso: Autenticado
   */
  searchGlobal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = this.getAuthenticatedUserId(req);
    const { query, page = 1, limit = 10, types } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const searchTypes = types ? (types as string).split(',') : ['users', 'decks', 'articles', 'questions', 'mentorships'];
      
      // Normalizar o termo de busca
      const searchTerm = query.trim().toLowerCase();
      
      // Registrar a busca para análise de tendências
      await this.logSearch(userId, searchTerm);

      // Resultados para cada tipo
      const results: any = {};
      const promises = [];

      // Buscar usuários
      if (searchTypes.includes('users')) {
        promises.push(
          this._searchUsers({ query: searchTerm, page: pageNum, limit: limitNum })
            .then(data => { results.users = data; })
        );
      }

      // Buscar decks
      if (searchTypes.includes('decks')) {
        promises.push(
          this._searchDecks({ query: searchTerm, page: pageNum, limit: limitNum })
            .then(data => { results.decks = data; })
        );
      }

      // Buscar artigos
      if (searchTypes.includes('articles')) {
        promises.push(
          this._searchArticles({ query: searchTerm, page: pageNum, limit: limitNum })
            .then(data => { results.articles = data; })
        );
      }

      // Buscar questões
      if (searchTypes.includes('questions')) {
        promises.push(
          this._searchQuestions({ query: searchTerm, page: pageNum, limit: limitNum })
            .then(data => { results.questions = data; })
        );
      }

      // Buscar mentorias
      if (searchTypes.includes('mentorships')) {
        promises.push(
          this._searchMentorships({ query: searchTerm, page: pageNum, limit: limitNum })
            .then(data => { results.mentorships = data; })
        );
      }

      // Aguardar todas as buscas
      await Promise.all(promises);

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca global por "${query}":`, error);
      throw AppError.internal("Erro ao realizar busca global");
    }
  });

  /**
   * Busca usuários
   * Acesso: Autenticado
   */
  searchUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, page = 1, limit = 10 } = req.query;
    const searchParams = {
      query: typeof query === 'string' ? query : '',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    if (!searchParams.query || searchParams.query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const results = await this._searchUsers(searchParams);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca de usuários por "${query}":`, error);
      throw AppError.internal("Erro ao buscar usuários");
    }
  });

  /**
   * Implementação interna da busca de usuários
   */
  private async _searchUsers({ query, page, limit }: { query: string, page: number, limit: number }): Promise<any> {
    const searchTerm = query.trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Buscar usuários pelo nome ou email
    const usersQuery = admin.firestore()
      .collection('users')
      .where('isActive', '==', true)
      .orderBy('displayName')
      .startAt(searchTerm)
      .endAt(searchTerm + '\uf8ff')
      .limit(limit)
      .offset(offset);

    const usersSnapshot = await usersQuery.get();
    
    // Buscar usuários pelo email
    const emailQuery = admin.firestore()
      .collection('users')
      .where('isActive', '==', true)
      .where('email', '>=', searchTerm)
      .where('email', '<=', searchTerm + '\uf8ff')
      .limit(limit)
      .offset(offset);

    const emailSnapshot = await emailQuery.get();

    // Combinar resultados e remover duplicatas
    const userIds = new Set();
    const users: any[] = [];

    if (!usersSnapshot.empty) {
      usersSnapshot.docs.forEach(doc => {
        if (!userIds.has(doc.id)) {
          userIds.add(doc.id);
          users.push({
            id: doc.id,
            displayName: doc.data().displayName,
            email: doc.data().email,
            profileImage: doc.data().profileImage,
            role: doc.data().role
          });
        }
      });

    if (!emailSnapshot.empty) {
      emailSnapshot.docs.forEach(doc => {
        if (!userIds.has(doc.id)) {
          userIds.add(doc.id);
          users.push({
            id: doc.id,
            displayName: doc.data().displayName,
            email: doc.data().email,
            profileImage: doc.data().profileImage,
            role: doc.data().role
          });
        }
      });

    // Contar total para paginação
    const countQuery = admin.firestore()
      .collection('users')
      .where('isActive', '==', true);

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    return {
      items: users,
      total,
      page,
      limit
    };
  }

  /**
   * Busca decks
   * Acesso: Autenticado
   */
  searchDecks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, page = 1, limit = 10, isPublic } = req.query;
    const searchParams = {
      query: typeof query === 'string' ? query : '',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      isPublic: isPublic === 'true'
    };

    if (!searchParams.query || searchParams.query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const results = await this._searchDecks(searchParams);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca de decks por "${query}":`, error);
      throw AppError.internal("Erro ao buscar decks");
    }
  });

  /**
   * Implementação interna da busca de decks
   */
  private async _searchDecks({ query, page, limit, isPublic }: { query: string, page: number, limit: number, isPublic?: boolean }) {
    const searchTerm = query.trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Iniciar a consulta
    let decksQuery: any = admin.firestore().collection('decks');

    // Filtrar por visibilidade se especificado
    if (isPublic !== undefined) {
      decksQuery = decksQuery.where('isPublic', '==', isPublic);
    }

    // Buscar por título
    decksQuery = decksQuery
      .orderBy('title')
      .where('title', '>=', searchTerm)
      .where('title', '<=', searchTerm + '\uf8ff')
      .limit(limit)
      .offset(offset);

    const decksSnapshot = await decksQuery.get();
    
    const decks = decksSnapshot.empty ? [] : decksSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      id: doc.id,
      title: doc.data().title,
      description: doc.data().description,
      flashcardCount: doc.data().flashcardCount || 0,
      isPublic: doc.data().isPublic,
      createdBy: doc.data().createdBy,
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Contar total para paginação
    let countQuery: any = admin.firestore().collection('decks');
    
    if (isPublic !== undefined) {
      countQuery = countQuery.where('isPublic', '==', isPublic);
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    return {
      items: decks,
      total,
      page,
      limit
    };
  }

  /**
   * Busca artigos
   * Acesso: Autenticado
   */
  searchArticles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, page = 1, limit = 10, categoryId } = req.query;
    const searchParams = {
      query: typeof query === 'string' ? query : '',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      categoryId: categoryId as string
    };

    if (!searchParams.query || searchParams.query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const results = await this._searchArticles(searchParams);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca de artigos por "${query}":`, error);
      throw AppError.internal("Erro ao buscar artigos");
    }
  });

  /**
   * Implementação interna da busca de artigos
   */
  private async _searchArticles({ query, page, limit, categoryId }: { query: string, page: number, limit: number, categoryId?: string }) {
    const searchTerm = query.trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Iniciar a consulta
    let articlesQuery = admin.firestore()
      .collection('articles')
      .where('status', '==', 'PUBLISHED');

    // Filtrar por categoria se especificado
    if (categoryId) {
      articlesQuery = articlesQuery.where('categoryId', '==', categoryId);
    }

    // Buscar por título
    articlesQuery = articlesQuery
      .where('title', '>=', searchTerm)
      .where('title', '<=', searchTerm + '\uf8ff')
      .limit(limit);

    const articlesSnapshot = await articlesQuery.get();
    
    const articles = articlesSnapshot.empty ? [] : articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      excerpt: doc.data().excerpt,
      authorId: doc.data().authorId,
      authorName: doc.data().authorName,
      categoryId: doc.data().categoryId,
      categoryName: doc.data().categoryName,
      featuredImage: doc.data().featuredImage,
      publishedAt: doc.data().publishedAt?.toDate(),
      viewCount: doc.data().viewCount || 0
    }));

    // Contar total para paginação
    let countQuery = admin.firestore()
      .collection('articles')
      .where('status', '==', 'PUBLISHED');
    
    if (categoryId) {
      countQuery = countQuery.where('categoryId', '==', categoryId);
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    return {
      items: articles,
      total,
      page,
      limit
    };
  }

  /**
   * Busca questões
   * Acesso: Autenticado
   */
  searchQuestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, page = 1, limit = 10, difficulty, filterId } = req.query;
    const searchParams = {
      query: typeof query === 'string' ? query : '',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      difficulty: difficulty as string,
      filterId: filterId as string
    };

    if (!searchParams.query || searchParams.query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const results = await this._searchQuestions(searchParams);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca de questões por "${query}":`, error);
      throw AppError.internal("Erro ao buscar questões");
    }
  });

  /**
   * Implementação interna da busca de questões
   */
  private async _searchQuestions({ query, page, limit, difficulty, filterId }: { query: string, page: number, limit: number, difficulty?: string, filterId?: string }) {
    const searchTerm = query.trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Iniciar a consulta
    let questionsQuery = admin.firestore()
      .collection('questions')
      .where('status', '==', 'PUBLISHED');

    // Filtrar por dificuldade se especificado
    if (difficulty) {
      questionsQuery = questionsQuery.where('difficulty', '==', difficulty);
    }

    // Filtrar por filtro se especificado
    if (filterId) {
      questionsQuery = questionsQuery.where('filterIds', 'array-contains', filterId);
    }

    // Buscar por texto da questão
    questionsQuery = questionsQuery
      .where('statement', '>=', searchTerm)
      .where('statement', '<=', searchTerm + '\uf8ff')
      .limit(limit);

    const questionsSnapshot = await questionsQuery.get();
    
    const questions = questionsSnapshot.empty ? [] : questionsSnapshot.docs.map(doc => ({
      id: doc.id,
      statement: doc.data().statement,
      difficulty: doc.data().difficulty,
      filterIds: doc.data().filterIds,
      subFilterIds: doc.data().subFilterIds,
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Contar total para paginação
    let countQuery = admin.firestore()
      .collection('questions')
      .where('status', '==', 'PUBLISHED');
    
    if (difficulty) {
      countQuery = countQuery.where('difficulty', '==', difficulty);
    }

    if (filterId) {
      countQuery = countQuery.where('filterIds', 'array-contains', filterId);
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    return {
      items: questions,
      total,
      page,
      limit
    };
  }

  /**
   * Busca mentorias
   * Acesso: Autenticado
   */
  searchMentorships = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, page = 1, limit = 10, status } = req.query;
    const searchParams = {
      query: typeof query === 'string' ? query : '',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string
    };

    if (!searchParams.query || searchParams.query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const results = await this._searchMentorships(searchParams);
      
      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error(`Erro na busca de mentorias por "${query}":`, error);
      throw AppError.internal("Erro ao buscar mentorias");
    }
  });

  /**
   * Implementação interna da busca de mentorias
   */
  private async _searchMentorships({ query, page, limit, status }: { query: string, page: number, limit: number, status?: string }) {
    const searchTerm = query.trim().toLowerCase();
    const offset = (page - 1) * limit;

    // Iniciar a consulta
    let mentorshipsQuery: any = admin.firestore().collection('mentorships');

    // Filtrar por status se especificado
    if (status) {
      mentorshipsQuery = mentorshipsQuery.where('status', '==', status);
    }

    // Buscar por título ou descrição
    mentorshipsQuery = mentorshipsQuery
      .where('title', '>=', searchTerm)
      .where('title', '<=', searchTerm + '\uf8ff')
      .limit(limit);

    const mentorshipsSnapshot = await mentorshipsQuery.get();
    
    const mentorships = mentorshipsSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      id: doc.id,
      title: doc.data().title,
      description: doc.data().description,
      mentorId: doc.data().mentorId,
      mentorName: doc.data().mentorName,
      studentId: doc.data().studentId,
      studentName: doc.data().studentName,
      status: doc.data().status,
      startDate: doc.data().startDate?.toDate(),
      endDate: doc.data().endDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Contar total para paginação
    let countQuery: any = admin.firestore().collection('mentorships');
    
    if (status) {
      countQuery = countQuery.where('status', '==', status);
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    return {
      items: mentorships,
      total,
      page,
      limit
    };
  };

  /**
   * Obtém sugestões de busca com base no termo digitado
   * Acesso: Autenticado
   */
  getSearchSuggestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, limit = 5 } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      throw AppError.badRequest("Termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const searchTerm = query.trim().toLowerCase();
      const limitNum = parseInt(limit as string, 10);
      
      // Buscar termos de busca populares que começam com o termo digitado
      const db = admin.firestore();
      const suggestionsSnapshot = await db
        .collection('searchTerms')
        .where('term', '>=', searchTerm)
        .where('term', '<=', searchTerm + '\uf8ff')
        .orderBy('term')
        .orderBy('count', 'desc')
        .limit(limitNum)
        .get();
      
      const suggestions = suggestionsSnapshot.empty ? [] : suggestionsSnapshot.docs.map(doc => doc.data().term);

      res.status(200).json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error(`Erro ao obter sugestões de busca para "${query}":`, error);
      throw AppError.internal("Erro ao obter sugestões de busca");
    }
  });

  /**
   * Obtém as buscas mais populares
   * Acesso: Autenticado
   */
  getPopularSearches = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = 10 } = req.query;

    try {
      const limitNum = parseInt(limit as string, 10);
      
      // Buscar termos de busca mais populares
      const db = admin.firestore();
      const popularSearchesSnapshot = await db
        .collection('searchTerms')
        .orderBy('count', 'desc')
        .limit(limitNum)
        .get();
      
      const popularSearches = popularSearchesSnapshot.empty ? [] : popularSearchesSnapshot.docs.map(doc => ({
        term: doc.data().term,
        count: doc.data().count
      }));

      res.status(200).json({
        success: true,
        data: popularSearches
      });
    } catch (error) {
      logger.error("Erro ao obter buscas populares:", error);
      throw AppError.internal("Erro ao obter buscas populares");
    }
  });

  /**
   * Registra um termo de busca para análise de tendências
   */
  private async logSearch(userId: string, searchTerm: string): Promise<void> {
    try {
      const db = admin.firestore();
      const termRef = db.collection('searchTerms').doc(searchTerm.toLowerCase());
      const termDoc = await termRef.get();
      
      if (termDoc.exists) {
        // Incrementar contador se o termo já existe
        await termRef.update({
          count: FieldValue.increment(1),
          lastSearchedAt: Timestamp.now()
        });
      } else {
        // Criar novo documento se o termo não existe
        await termRef.set({
          term: searchTerm,
          count: 1,
          createdAt: Timestamp.now(),
          lastSearchedAt: Timestamp.now()
        });
      }
      
      // Registrar a busca do usuário
      await db.collection('userSearches').add({
        userId,
        term: searchTerm,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      logger.error(`Erro ao registrar busca "${searchTerm}" para usuário ${userId}:`, error);
      // Não lançar erro para não interromper a busca
    }
  }
}

export default new SearchController();