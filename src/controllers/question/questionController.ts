import { Request, Response } from "express";
import { AppError, asyncHandler } from "../../utils/errors";
import { logger } from "../../utils/logger"; // Corrected import
import { firestore as adminFirestore } from "firebase-admin";
import { v4 as uuidv4 } from "uuid"; // Import uuid
import { FirebaseQuestion, FirebaseQuestionDifficulty, FirebaseQuestionStatus, UserRole, FirebaseReviewStatus, FirebaseQuestionAlternative } from "../../types/firebaseTypes";
import { CollectionReference, Query, Timestamp, DocumentData, WithFieldValue, FieldValue } from "firebase-admin/firestore";

/**
 * Controlador para gerenciar questões
 */
class QuestionController {
  private questionsCollection: CollectionReference<FirebaseQuestion>;

  constructor() {
    this.questionsCollection = adminFirestore().collection("questions") as CollectionReference<FirebaseQuestion>;
  }
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
   * Obtém o ID do usuário autenticado e verifica se é admin
   */
  private getAuthenticatedAdminId(req: Request): string {
    const userId = this.getAuthenticatedUserId(req);
    if (req.user?.role !== UserRole.ADMIN) {
      throw AppError.forbidden("Acesso negado. Apenas administradores podem realizar esta operação.");
    }
    return userId;
  }

  /**
   * Cria uma nova questão
   * Acesso: Admin
   */
  createQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const questionData = req.body as Partial<FirebaseQuestion>; 

    if (!questionData.statement) {
      throw AppError.badRequest("O enunciado da questão é obrigatório");
    }

    if (!questionData.alternatives || !Array.isArray(questionData.alternatives) || questionData.alternatives.length < 2) {
      throw AppError.badRequest("A questão deve ter pelo menos duas alternativas");
    }

    const hasCorrectAlternative = questionData.alternatives.some(alt => alt.isCorrect);
    if (!hasCorrectAlternative) {
      throw AppError.badRequest("A questão deve ter pelo menos uma alternativa correta");
    }

    const now = Timestamp.now();
    // Ensure alternatives have IDs if not provided
    const alternativesWithIds = (questionData.alternatives || []).map((alt, index) => ({
        ...alt,
        id: alt.id || uuidv4(), // Use uuidv4 for ID generation
        explanation: alt.explanation ?? null, // Ensure explanation is string | null
        order: typeof alt.order === 'number' ? alt.order : index // Add order, using provided or index as fallback
    })) as FirebaseQuestionAlternative[];

    // Gerar ID para a nova questão
    const newQuestionId = uuidv4(); // Use uuidv4 for question ID
    
    const newQuestionData: WithFieldValue<FirebaseQuestion> = {
      id: newQuestionId,
      statement: questionData.statement,
      alternatives: alternativesWithIds,
      difficulty: questionData.difficulty || FirebaseQuestionDifficulty.MEDIUM,
      status: questionData.status || FirebaseQuestionStatus.DRAFT,
      isAnnulled: questionData.isAnnulled !== undefined ? questionData.isAnnulled : false, // Added default
      isActive: questionData.isActive !== undefined ? questionData.isActive : true, // Added default
      filterIds: questionData.filterIds || [],
      subFilterIds: questionData.subFilterIds || [],
      tags: questionData.tags || [],
      explanation: questionData.explanation ?? null,
      source: questionData.source || undefined,
      year: questionData.year || undefined,
      reviewCount: 0,
      averageRating: 0,
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: now,
      updatedAt: now,
      categoryId: questionData.categoryId,
      topicId: questionData.topicId,
      institutionId: questionData.institutionId,
      examId: questionData.examId,
      commentsAllowed: questionData.commentsAllowed !== undefined ? questionData.commentsAllowed : true,
      correctAlternativeId: questionData.correctAlternativeId,
      lastReviewedAt: questionData.lastReviewedAt || null,
      reviewStatus: questionData.reviewStatus || FirebaseReviewStatus.PENDING,
      reviewerId: questionData.reviewerId || null,
      reviewNotes: questionData.reviewNotes || null,
      version: questionData.version || 1,
      relatedQuestionIds: questionData.relatedQuestionIds || [],
      imageUrls: questionData.imageUrls || [],
      videoUrls: questionData.videoUrls || [],
      audioUrls: questionData.audioUrls || [],
      metadata: questionData.metadata || {},
      title: questionData.title || "Questão sem título",
    };

    try {
      // Usar o ID gerado para criar o documento com set em vez de add
      const questionRef = this.questionsCollection.doc(newQuestionId);
      await questionRef.set(newQuestionData);
      const questionSnapshot = await questionRef.get();
      const createdQuestionData = questionSnapshot.data(); 
      
      if (!createdQuestionData) {
        throw AppError.internal("Falha ao obter dados da questão criada.");
      }
      // Destructure to avoid id overwrite, and ensure correct typing
      const { id, ...restOfCreatedData } = createdQuestionData as FirebaseQuestion; 

      const responseQuestion: FirebaseQuestion = {
        id: questionSnapshot.id, // ID comes from the snapshot
        ...restOfCreatedData // Spread the rest of the data, id from here is ignored
      };

      res.status(201).json({
        success: true,
        message: "Questão criada com sucesso",
        data: responseQuestion
      });
    } catch (error) {
      logger.error("Erro ao criar questão:", error);
      if (error instanceof AppError) throw error;
      throw AppError.internal("Erro ao criar questão");
    }
  });

  /**
   * Obtém uma questão pelo ID
   */
  getQuestionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { questionId } = req.params;

    if (!questionId) {
      throw AppError.badRequest("ID da questão não fornecido");
    }

    try {
      const questionDoc = await this.questionsCollection.doc(questionId).get();

      if (!questionDoc.exists) {
        throw AppError.notFound("Questão não encontrada");
      }
      const questionDataFromDoc = questionDoc.data();
      if (!questionDataFromDoc) {
        throw AppError.internal("Falha ao obter dados da questão.");
      }
      // Destructure to avoid id overwrite
      const { id, ...restOfDataFromDoc } = questionDataFromDoc as FirebaseQuestion;

      const responseQuestion: FirebaseQuestion = {
        id: questionDoc.id, // Use ID from the document snapshot
        ...restOfDataFromDoc
      };

      res.status(200).json({
        success: true,
        data: responseQuestion
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`Erro ao buscar questão ${questionId}:`, error);
      throw AppError.internal("Erro ao buscar questão");
    }
  });

  /**
   * Atualiza uma questão existente
   */
  updateQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { questionId } = req.params;
    const updateDataFromRequest = req.body as Partial<FirebaseQuestion>;

    if (!questionId) {
      throw AppError.badRequest("ID da questão não fornecido");
    }

    try {
      const questionRef = this.questionsCollection.doc(questionId);
      const questionDoc = await questionRef.get();

      if (!questionDoc.exists) {
        throw AppError.notFound("Questão não encontrada");
      }

      const now = Timestamp.now();
      // Exclude id from updateDataFromRequest if present to avoid conflicts
      const { id: idFromRequest, ...restOfUpdateData } = updateDataFromRequest;

      const questionUpdate: Partial<FirebaseQuestion> & { updatedAt: Timestamp, updatedBy: string } = {
        ...restOfUpdateData,
        updatedAt: now,
        updatedBy: adminId
      };

      await questionRef.update(questionUpdate);
      const updatedQuestionDoc = await questionRef.get();
      const updatedQuestionDataFromDoc = updatedQuestionDoc.data();

      if (!updatedQuestionDataFromDoc) {
        throw AppError.internal("Falha ao obter dados da questão atualizada.");
      }
      const { id: idFromDoc, ...restOfUpdatedData } = updatedQuestionDataFromDoc as FirebaseQuestion;

      const responseQuestion: FirebaseQuestion = {
        id: updatedQuestionDoc.id, // Use ID from the document snapshot
        ...restOfUpdatedData
      };

      res.status(200).json({
        success: true,
        message: "Questão atualizada com sucesso",
        data: responseQuestion
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`Erro ao atualizar questão ${questionId}:`, error);
      throw AppError.internal("Erro ao atualizar questão");
    }
  });

  /**
   * Exclui uma questão
   */
  deleteQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req); // Ensure admin access
    const { questionId } = req.params;

    if (!questionId) {
      throw AppError.badRequest("ID da questão não fornecido");
    }

    try {
      const questionDoc = await this.questionsCollection.doc(questionId).get();
      if (!questionDoc.exists) {
        throw AppError.notFound("Questão não encontrada");
      }
      await this.questionsCollection.doc(questionId).delete();
      res.status(200).json({
        success: true,
        message: "Questão excluída com sucesso"
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`Erro ao excluir questão ${questionId}:`, error);
      throw AppError.internal("Erro ao excluir questão");
    }
  });

  /**
   * Lista questões com filtros e paginação
   */
  getQuestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      status,
      difficulty,
      category,
      filterId,
      subFilterId,
      // search, // Search not implemented yet
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    try {
      let query: Query<FirebaseQuestion> = this.questionsCollection;

      if (status) {
        query = query.where("status", "==", status as string);
      } else {
        query = query.where("status", "==", FirebaseQuestionStatus.PUBLISHED);
      }
      if (difficulty) {
        query = query.where("difficulty", "==", difficulty as string);
      }
      if (category) {
        query = query.where("categoryId", "==", category as string);
      }
      if (filterId) {
        query = query.where("filterIds", "array-contains", filterId as string);
      }
      if (subFilterId) {
        query = query.where("subFilterIds", "array-contains", subFilterId as string);
      }

      query = query.orderBy(sortBy as string, sortOrder === "asc" ? "asc" : "desc");

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      const snapshot = await query.limit(limitNum).offset(offset).get();
      const questions: FirebaseQuestion[] = snapshot.docs.map(doc => {
        const dataFromDoc = doc.data();
        const { id, ...restOfData } = dataFromDoc as FirebaseQuestion;
        return {
            id: doc.id, // Use ID from the document snapshot
            ...restOfData
        };
      });

      // Count total for pagination (apply same filters without limit/offset)
      let countQuery: Query<FirebaseQuestion> = this.questionsCollection;
      if (status) countQuery = countQuery.where("status", "==", status as string);
      else countQuery = countQuery.where("status", "==", FirebaseQuestionStatus.PUBLISHED);
      if (difficulty) countQuery = countQuery.where("difficulty", "==", difficulty as string);
      if (category) countQuery = countQuery.where("categoryId", "==", category as string);
      if (filterId) countQuery = countQuery.where("filterIds", "array-contains", filterId as string);
      if (subFilterId) countQuery = countQuery.where("subFilterIds", "array-contains", subFilterId as string);
      
      const totalSnapshot = await countQuery.count().get();
      const total = totalSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          questions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao buscar questões:", error);
      if (error instanceof AppError) throw error;
      throw AppError.internal("Erro ao buscar questões");
    }
  });

  /**
   * Obtém questões por categoria
   */
  getQuestionsByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!categoryId) {
      throw AppError.badRequest("ID da categoria não fornecido");
    }

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let query: Query<FirebaseQuestion> = this.questionsCollection
        .where("categoryId", "==", categoryId)
        .where("status", "==", FirebaseQuestionStatus.PUBLISHED)
        .orderBy("createdAt", "desc");
      
      query = query.limit(limitNum).offset(offset);

      const snapshot = await query.get();
      const questions: FirebaseQuestion[] = snapshot.docs.map(doc => {
        const dataFromDoc = doc.data();
        const { id, ...restOfData } = dataFromDoc as FirebaseQuestion;
        return {
            id: doc.id, // Use ID from the document snapshot
            ...restOfData
        };
      });

      let countQuery: Query<FirebaseQuestion> = this.questionsCollection
        .where("categoryId", "==", categoryId)
        .where("status", "==", FirebaseQuestionStatus.PUBLISHED);
      
      const totalSnapshot = await countQuery.count().get();
      const total = totalSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          questions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error(`Erro ao buscar questões da categoria ${categoryId}:`, error);
      if (error instanceof AppError) throw error;
      throw AppError.internal("Erro ao buscar questões da categoria");
    }
  });

  /**
   * Obtém questões aleatórias
   */
  getRandomQuestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { count = 10, categoryId, difficulty, filterId } = req.query;
    const countNum = parseInt(count as string, 10);

    if (countNum <= 0 || countNum > 50) {
      throw AppError.badRequest("O número de questões deve estar entre 1 e 50");
    }

    try {
      let query: Query<FirebaseQuestion> = this.questionsCollection
        .where("status", "==", FirebaseQuestionStatus.PUBLISHED);

      if (categoryId) {
        query = query.where("categoryId", "==", categoryId as string);
      }
      if (difficulty) {
        query = query.where("difficulty", "==", difficulty as string);
      }
      if (filterId) {
        query = query.where("filterIds", "array-contains", filterId as string);
      }

      const snapshot = await query.get();
      const allQuestions: FirebaseQuestion[] = snapshot.docs.map(doc => {
        const dataFromDoc = doc.data();
        const { id, ...restOfData } = dataFromDoc as FirebaseQuestion;
        return {
            id: doc.id, // Use ID from the document snapshot
            ...restOfData
        };
      });

      const randomQuestions: FirebaseQuestion[] = [];
      const totalQuestions = allQuestions.length;
      
      if (totalQuestions === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const selectedIndices = new Set<number>();
      const maxAttempts = Math.min(countNum * 3, totalQuestions * 3);
      let attempts = 0;

      while (selectedIndices.size < Math.min(countNum, totalQuestions) && attempts < maxAttempts) {
        const randomIndex = Math.floor(Math.random() * totalQuestions);
        selectedIndices.add(randomIndex);
        attempts++;
      }

      selectedIndices.forEach(index => {
        randomQuestions.push(allQuestions[index]);
      });

      res.status(200).json({
        success: true,
        data: randomQuestions
      });
    } catch (error) {
      logger.error("Erro ao buscar questões aleatórias:", error);
      if (error instanceof AppError) throw error;
      throw AppError.internal("Erro ao buscar questões aleatórias");
    }
  });

  /**
   * Adiciona uma alternativa a uma questão existente
   * Acesso: Admin
   */
  addAlternative = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { questionId } = req.params;
    const alternativeData = req.body as { text: string; isCorrect: boolean; explanation?: string; order?: number }; 

    if (!questionId) {
      throw AppError.badRequest("ID da questão não fornecido");
    }
    if (!alternativeData || !alternativeData.text) {
        throw AppError.badRequest("Dados da alternativa inválidos ou texto não fornecido.");
    }

    try {
        const questionRef = this.questionsCollection.doc(questionId);
        const questionDoc = await questionRef.get();

        if (!questionDoc.exists) {
            throw AppError.notFound("Questão não encontrada para adicionar alternativa.");
        }

        const newAlternative: FirebaseQuestionAlternative = {
            id: adminFirestore().collection("_placeholder_ids").doc().id, // Generate new ID for the alternative
            text: alternativeData.text,
            isCorrect: alternativeData.isCorrect || false,
            explanation: alternativeData.explanation ?? null, // Usar ?? null para garantir que seja string | null
            order: alternativeData.order || 0, // Usar o valor fornecido ou 0 como padrão
        };

        await questionRef.update({
            alternatives: FieldValue.arrayUnion(newAlternative),
            updatedAt: Timestamp.now(),
            updatedBy: adminId
        });

        const updatedQuestionDoc = await questionRef.get();
        const updatedQuestionData = updatedQuestionDoc.data();

        if (!updatedQuestionData) {
            throw AppError.internal("Falha ao obter dados da questão após adicionar alternativa.");
        }
        
        const { id, ...restOfUpdatedData } = updatedQuestionData as FirebaseQuestion;

        res.status(200).json({
            success: true,
            message: "Alternativa adicionada com sucesso",
            data: {
                id: updatedQuestionDoc.id,
                ...restOfUpdatedData
            }
        });
    } catch (error) {
        logger.error(`Erro ao adicionar alternativa à questão ${questionId}:`, error);
        if (error instanceof AppError) throw error;
        throw AppError.internal("Erro ao adicionar alternativa");
    }
  });

  /**
   * Atualiza uma alternativa existente em uma questão
   * Acesso: Admin
   */
  updateAlternative = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { questionId, alternativeId } = req.params;
    const updateData = req.body as Partial<Omit<FirebaseQuestionAlternative, "id">>;

    if (!questionId || !alternativeId) {
        throw AppError.badRequest("ID da questão ou da alternativa não fornecido.");
    }

    try {
        const questionRef = this.questionsCollection.doc(questionId);
        const questionDoc = await questionRef.get();

        if (!questionDoc.exists) {
            throw AppError.notFound("Questão não encontrada para atualizar alternativa.");
        }

        const question = questionDoc.data() as FirebaseQuestion;
        const alternatives = question.alternatives || [];
        const alternativeIndex = alternatives.findIndex(alt => alt.id === alternativeId);

        if (alternativeIndex === -1) {
            throw AppError.notFound("Alternativa não encontrada na questão.");
        }

        // Update the specific alternative
        const updatedAlternative = { ...alternatives[alternativeIndex], ...updateData };
        alternatives[alternativeIndex] = updatedAlternative;

        await questionRef.update({
            alternatives: alternatives,
            updatedAt: Timestamp.now(),
            updatedBy: adminId
        });

        const updatedQuestionDoc = await questionRef.get();
        const updatedQuestionData = updatedQuestionDoc.data();
        if (!updatedQuestionData) {
            throw AppError.internal("Falha ao obter dados da questão após atualizar alternativa.");
        }
        const { id, ...restOfUpdatedData } = updatedQuestionData as FirebaseQuestion;

        res.status(200).json({
            success: true,
            message: "Alternativa atualizada com sucesso",
            data: {
                id: updatedQuestionDoc.id,
                ...restOfUpdatedData
            }
        });
    } catch (error) {
        logger.error(`Erro ao atualizar alternativa ${alternativeId} na questão ${questionId}:`, error);
        if (error instanceof AppError) throw error;
        throw AppError.internal("Erro ao atualizar alternativa");
    }
  });

  /**
   * Remove uma alternativa de uma questão
   * Acesso: Admin
   */
  removeAlternative = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { questionId, alternativeId } = req.params;

    if (!questionId || !alternativeId) {
        throw AppError.badRequest("ID da questão ou da alternativa não fornecido.");
    }

    try {
        const questionRef = this.questionsCollection.doc(questionId);
        const questionDoc = await questionRef.get();

        if (!questionDoc.exists) {
            throw AppError.notFound("Questão não encontrada para remover alternativa.");
        }

        const question = questionDoc.data() as FirebaseQuestion;
        const alternatives = question.alternatives || [];
        const updatedAlternatives = alternatives.filter(alt => alt.id !== alternativeId);

        if (alternatives.length === updatedAlternatives.length) {
            throw AppError.notFound("Alternativa não encontrada para remover.");
        }

        await questionRef.update({
            alternatives: updatedAlternatives,
            updatedAt: Timestamp.now(),
            updatedBy: adminId
        });

        const updatedQuestionDoc = await questionRef.get();
        const updatedQuestionData = updatedQuestionDoc.data();
        if (!updatedQuestionData) {
            throw AppError.internal("Falha ao obter dados da questão após remover alternativa.");
        }
        const { id, ...restOfUpdatedData } = updatedQuestionData as FirebaseQuestion;

        res.status(200).json({
            success: true,
            message: "Alternativa removida com sucesso",
            data: {
                id: updatedQuestionDoc.id,
                ...restOfUpdatedData
            }
        });
    } catch (error) {
        logger.error(`Erro ao remover alternativa ${alternativeId} da questão ${questionId}:`, error);
        if (error instanceof AppError) throw error;
        throw AppError.internal("Erro ao remover alternativa");
    }
  });

}

export default new QuestionController();

