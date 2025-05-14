import { Request, Response, NextFunction } from "express";
import questionController from "../../controllers/question/questionController";
import * as firebaseQuestionService from "../../services/firebaseQuestionService";
import { AppError } from "../../utils/errors";
import { UserRole } from "../../types/firebaseTypes"; // Import UserRole

// Mock do serviço de questões
jest.mock("../../services/firebaseQuestionService");

// Mock do express-validator
jest.mock("express-validator", () => ({
  validationResult: jest.fn().mockImplementation(() => ({
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([]),
  })),
}));

describe("QuestionController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseObject: any = {};

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock da requisição
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: {
        id: "test-user-id",
        role: UserRole.ADMIN, // Corrected
      },
    };

    // Mock da resposta
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
  });

  describe("createQuestion", () => {
    it("deve criar uma questão com sucesso", async () => {
      // Arrange
      const questionData = {
        statement: "Qual é a capital do Brasil?",
        alternatives: [
          { text: "São Paulo", isCorrect: false },
          { text: "Rio de Janeiro", isCorrect: false },
          { text: "Brasília", isCorrect: true },
          { text: "Salvador", isCorrect: false },
        ],
        difficulty: "MEDIUM",
        filterIds: ["filter1"],
        subFilterIds: ["subfilter1"],
        tags: ["geografia", "capitais"],
      };

      mockRequest.body = questionData;

      const createdQuestion = {
        id: "question-id-1",
        ...questionData,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "test-user-id",
        status: "PUBLISHED",
      };

      (firebaseQuestionService.createQuestion as jest.Mock).mockResolvedValue(
        createdQuestion
      );

      // Act
      await questionController.createQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(firebaseQuestionService.createQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          statement: questionData.statement,
          alternatives: questionData.alternatives,
          createdBy: "test-user-id",
        })
      );
      expect(responseObject.statusCode).toBe(201);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          data: createdQuestion,
        })
      );
    });

    it("deve retornar erro 400 se a validação falhar", async () => {
      // Arrange
      const validationErrors = [
        { param: "statement", msg: "Statement is required" },
      ];

      require("express-validator").validationResult.mockImplementationOnce(() => ({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(validationErrors),
      }));

      // Act
      await questionController.createQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      // Com asyncHandler, o erro é passado para o mockNext
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(400);
      expect(errorPassedToNext.errors).toEqual(validationErrors);
      expect(firebaseQuestionService.createQuestion).not.toHaveBeenCalled();
    });

    it("deve retornar erro 500 se ocorrer um erro no serviço", async () => {
      // Arrange
      mockRequest.body = {
        statement: "Qual é a capital do Brasil?",
        alternatives: [{ text: "Brasília", isCorrect: true }],
      };

      const error = new Error("Database error");
      (firebaseQuestionService.createQuestion as jest.Mock).mockRejectedValue(
        error
      );

      // Act
      await questionController.createQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("getQuestionById", () => {
    it("deve retornar uma questão pelo ID com sucesso", async () => {
      // Arrange
      const questionId = "question-id-1";
      mockRequest.params = { questionId };

      const question = {
        id: questionId,
        statement: "Qual é a capital do Brasil?",
        alternatives: [{ text: "Brasília", isCorrect: true }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(
        question
      );

      // Act
      await questionController.getQuestionById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(firebaseQuestionService.getQuestionById).toHaveBeenCalledWith(
        questionId
      );
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: question,
        })
      );
    });

    it("deve retornar erro 404 se a questão não for encontrada", async () => {
      // Arrange
      const questionId = "non-existent-id";
      mockRequest.params = { questionId };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(null);

      // Act
      await questionController.getQuestionById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(404);
      expect(errorPassedToNext.message).toContain("não encontrada");
    });
  });

  describe("updateQuestion", () => {
    it("deve atualizar uma questão com sucesso", async () => {
      // Arrange
      const questionId = "question-id-1";
      mockRequest.params = { questionId };

      const updateData = {
        statement: "Qual é a capital do Brasil? (atualizado)",
        difficulty: "HARD",
      };
      mockRequest.body = updateData;

      const existingQuestion = {
        id: questionId,
        statement: "Qual é a capital do Brasil?",
        alternatives: [{ text: "Brasília", isCorrect: true }],
        difficulty: "MEDIUM",
        createdBy: "test-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedQuestion = {
        ...existingQuestion,
        ...updateData,
        updatedAt: new Date(),
      };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(
        existingQuestion
      );
      (firebaseQuestionService.updateQuestion as jest.Mock).mockResolvedValue(
        updatedQuestion
      );

      // Act
      await questionController.updateQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(firebaseQuestionService.getQuestionById).toHaveBeenCalledWith(
        questionId
      );
      expect(firebaseQuestionService.updateQuestion).toHaveBeenCalledWith(
        questionId,
        expect.objectContaining(updateData)
      );
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          data: updatedQuestion,
        })
      );
    });

    it("deve retornar erro 404 se a questão não for encontrada", async () => {
      // Arrange
      const questionId = "non-existent-id";
      mockRequest.params = { questionId };
      mockRequest.body = { statement: "Atualizado" };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(null);

      // Act
      await questionController.updateQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(404);
      expect(firebaseQuestionService.updateQuestion).not.toHaveBeenCalled();
    });

    it("deve retornar erro 403 se o usuário não tiver permissão", async () => {
      // Arrange
      const questionId = "question-id-1";
      mockRequest.params = { questionId };
      mockRequest.body = { statement: "Atualizado" };
      mockRequest.user = { id: "different-user-id", role: UserRole.STUDENT }; // Corrected

      const existingQuestion = {
        id: questionId,
        statement: "Qual é a capital do Brasil?",
        createdBy: "original-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(
        existingQuestion
      );

      // Act
      await questionController.updateQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(403);
      expect(firebaseQuestionService.updateQuestion).not.toHaveBeenCalled();
    });
  });

  describe("deleteQuestion", () => {
    it("deve excluir uma questão com sucesso", async () => {
      // Arrange
      const questionId = "question-id-1";
      mockRequest.params = { questionId };

      const existingQuestion = {
        id: questionId,
        statement: "Qual é a capital do Brasil?",
        createdBy: "test-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(
        existingQuestion
      );
      (firebaseQuestionService.deleteQuestion as jest.Mock).mockResolvedValue(true);

      // Act
      await questionController.deleteQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(firebaseQuestionService.getQuestionById).toHaveBeenCalledWith(
        questionId
      );
      expect(firebaseQuestionService.deleteQuestion).toHaveBeenCalledWith(
        questionId
      );
      expect(responseObject.statusCode).toBe(200);
      expect(responseObject.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("excluída"),
        })
      );
    });

    it("deve retornar erro 404 se a questão não for encontrada", async () => {
      // Arrange
      const questionId = "non-existent-id";
      mockRequest.params = { questionId };

      (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(null);

      // Act
      await questionController.deleteQuestion(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      expect(errorPassedToNext.statusCode).toBe(404);
      expect(firebaseQuestionService.deleteQuestion).not.toHaveBeenCalled();
    });
  });

  // describe("reportQuestion", () => {
  //   it("deve reportar um problema em uma questão com sucesso", async () => {
  //     // Arrange
  //     const questionId = "question-id-1";
  //     mockRequest.params = { questionId };
  //     mockRequest.body = {
  //       reason: "incorrect_answer",
  //       description: "A resposta correta deveria ser Rio de Janeiro",
  //     };

  //     const question = {
  //       id: questionId,
  //       statement: "Qual é a capital do Brasil?",
  //       alternatives: [{ text: "Brasília", isCorrect: true }],
  //     };

  //     (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(
  //       question
  //     );
      // Mock da função reportQuestion que não existe mais ou precisa ser implementada
      // (firebaseQuestionService.reportQuestion as jest.Mock).mockResolvedValue({
      //   id: "report-id-1",
      //   questionId,
      //   userId: "test-user-id",
      //   reason: "incorrect_answer",
      //   description: "A resposta correta deveria ser Rio de Janeiro",
      //   status: "PENDING",
      //   createdAt: new Date(),
      // });

  //     // Act
  //     await questionController.reportQuestion(
  //       mockRequest as Request,
  //       mockResponse as Response,
  //       mockNext
  //     );

  //     // Assert
  //     expect(firebaseQuestionService.getQuestionById).toHaveBeenCalledWith(
  //       questionId
  //     );
      // expect(firebaseQuestionService.reportQuestion).toHaveBeenCalledWith(
      //   questionId,
      //   "test-user-id",
      //   "incorrect_answer",
      //   "A resposta correta deveria ser Rio de Janeiro"
      // );
  //     expect(responseObject.statusCode).toBe(200);
  //     expect(responseObject.json).toHaveBeenCalledWith(
  //       expect.objectContaining({
  //         success: true,
  //         message: expect.stringContaining("reportado"),
  //       })
  //     );
  //   });

  //   it("deve retornar erro 404 se a questão não for encontrada para reportar", async () => {
  //     // Arrange
  //     const questionId = "non-existent-id";
  //     mockRequest.params = { questionId };
  //     mockRequest.body = {
  //       reason: "incorrect_answer",
  //       description: "Descrição do problema",
  //     };

  //     (firebaseQuestionService.getQuestionById as jest.Mock).mockResolvedValue(null);

  //     // Act
  //     await questionController.reportQuestion(
  //       mockRequest as Request,
  //       mockResponse as Response,
  //       mockNext
  //     );

  //     // Assert
  //     expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      // const errorPassedToNext = (mockNext as jest.Mock).mock.calls[0][0];
      // expect(errorPassedToNext.statusCode).toBe(404);
      // expect(firebaseQuestionService.reportQuestion).not.toHaveBeenCalled();
  //   });
  // });
});

