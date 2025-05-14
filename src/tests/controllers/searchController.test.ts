import { Request, Response, NextFunction } from 'express';
import searchController from '../../controllers/search/searchController';
import { firestore as adminFirestore } from 'firebase-admin'; // Use an alias to avoid conflict with the mock
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes'; // Import UserRole

// Mock do Firebase Admin SDK
jest.mock('firebase-admin', () => {
  // Mock para CollectionReference e Query
  const mockQuery = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    startAt: jest.fn().mockReturnThis(),
    endAt: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [
        { id: 'doc1', data: () => ({ name: 'Test Document 1' }), exists: true },
        { id: 'doc2', data: () => ({ name: 'Test Document 2' }), exists: true },
      ],
    }),
    count: jest.fn().mockReturnThis(), // count() itself returns a Query/AggregateQuery like object
    doc: jest.fn((id) => ({
      id: id || 'some-doc-id',
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ id: id || 'some-doc' }) }),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    })),
    add: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  };
  // Mock para o get do count()
  (mockQuery.count().get as jest.Mock) = jest.fn().mockResolvedValue({ data: () => ({ count: 10 }) });


  const mockFirestoreInstance = {
    collection: jest.fn(() => mockQuery), // collection() retorna o mockQuery
    doc: jest.fn((path) => ({
      id: path ? path.split('/').pop() : 'some-doc-id',
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ id: path ? path.split('/').pop() : 'some-doc' }) }),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    })),
    batch: jest.fn(() => ({
      commit: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    })),
    settings: jest.fn(), // Add settings if it's called during initialization
  };

  return {
    // Retorna a instância mockada do Firestore quando firestore() é chamado
    firestore: jest.fn(() => mockFirestoreInstance),
    // Mock para FieldValue e Timestamp, se necessário
    credential: {
        cert: jest.fn(), // Mock para admin.credential.cert
    },
    initializeApp: jest.fn(), // Mock para admin.initializeApp
    apps: [], // Mock para admin.apps
    FieldValue: {
      increment: jest.fn(val => val),
      serverTimestamp: jest.fn(() => new Date()),
      arrayUnion: jest.fn(val => val),
      arrayRemove: jest.fn(val => val),
    },
    Timestamp: {
      now: jest.fn(() => new Date()),
      fromDate: jest.fn(date => date),
    },
  };
});

// Mock do express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn().mockImplementation(() => ({
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([]),
  })),
}));

describe('SearchController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseObject: any = {};
  let firestoreMock: any; // Para acessar os mocks internos do firestore

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Acessa o mock do firestore para uso nos testes
    firestoreMock = adminFirestore(); // Chama a função mockada para obter a instância mockada

    mockRequest = {
      params: {},
      query: {
        query: 'test search',
      },
      body: {},
      user: {
        id: 'test-user-id',
        role: UserRole.STUDENT, // Corrected to use UserRole enum
      },
    };
    
    responseObject = {
      statusCode: 0,
      json: jest.fn(),
    };
    mockResponse = {
      status: jest.fn().mockImplementation((code) => {
        responseObject.statusCode = code;
        return responseObject;
      }),
      json: responseObject.json,
    };
    mockNext = jest.fn();

    // Configura o mock para count().get() que agora está dentro do mockQuery
    // Acessamos através da instância mockada retornada por firestore().collection()
    (firestoreMock.collection().count().get as jest.Mock).mockResolvedValue({ data: () => ({ count: 10 }) });
  });

  describe('searchGlobal', () => {
    it('deve realizar uma busca global com sucesso', async () => {
      mockRequest.query = {
        query: 'test search',
        types: 'users,decks',
      };
      
      await searchController.searchGlobal(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(firestoreMock.collection).toHaveBeenCalledWith('decks');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });

    it('deve chamar next com erro 400 se o termo de busca for muito curto', async () => {
      mockRequest.query = {
        query: 'a',
      };
      
      await searchController.searchGlobal(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(400);
    });
  });

  describe('searchUsers', () => {
    it('deve buscar usuários com sucesso', async () => {
      mockRequest.query = {
        query: 'test user',
        page: '1',
        limit: '10',
      };
      
      await searchController.searchUsers(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.any(Array),
            total: 10, // Espera o total mockado
            page: 1,
            limit: 10,
          }),
        })
      );
    });
  });

  describe('searchDecks', () => {
    it('deve buscar decks com sucesso', async () => {
      mockRequest.query = {
        query: 'test deck',
        page: '1',
        limit: '10',
        isPublic: 'true',
      };
      
      await searchController.searchDecks(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('decks');
      // Verifica se 'where' foi chamado no objeto retornado por collection()
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('isPublic', '==', true);
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.any(Array),
            total: 10,
          }),
        })
      );
    });
  });

  describe('searchArticles', () => {
    it('deve buscar artigos com sucesso', async () => {
      mockRequest.query = {
        query: 'test article',
        page: '1',
        limit: '10',
        categoryId: 'category1',
      };
      
      await searchController.searchArticles(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('articles');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('status', '==', 'PUBLISHED');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('categoryId', '==', 'category1');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.any(Array),
            total: 10,
          }),
        })
      );
    });
  });

  describe('searchQuestions', () => {
    it('deve buscar questões com sucesso', async () => {
      mockRequest.query = {
        query: 'test question',
        page: '1',
        limit: '10',
        difficulty: 'MEDIUM',
        filterId: 'filter1',
      };
      
      await searchController.searchQuestions(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('questions');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('status', '==', 'PUBLISHED');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('difficulty', '==', 'MEDIUM');
      expect(firestoreMock.collection().where).toHaveBeenCalledWith('filterIds', 'array-contains', 'filter1');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.any(Array),
            total: 10,
          }),
        })
      );
    });
  });

  describe('getSearchSuggestions', () => {
    it('deve obter sugestões de busca com sucesso', async () => {
      mockRequest.query = {
        query: 'test',
        limit: '5',
      };
      
      await searchController.getSearchSuggestions(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('searchTerms');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });
  });

  describe('getPopularSearches', () => {
    it('deve obter buscas populares com sucesso', async () => {
      mockRequest.query = {
        limit: '10',
      };
      
      await searchController.getPopularSearches(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(firestoreMock.collection).toHaveBeenCalledWith('searchTerms');
      expect(firestoreMock.collection().orderBy).toHaveBeenCalledWith('count', 'desc');
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });
  });
});

