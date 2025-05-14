import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../../../config/firebaseAdmin";
import { 
  firebaseUserQuestionResponseService,
  createUserQuestionResponse,
  getUserQuestionResponseById,
  updateUserQuestionResponse,
  deleteUserQuestionResponse,
  recordUserQuestionReview,
  getUserQuestionResponsesByUserId
} from "../../../services/firebaseUserQuestionResponseService";
import { FirebaseUserQuestionResponse, ReviewQuality } from "../../../types/firebaseTypes";

describe("Firebase User Question Response Service Integration Tests", () => {
  const testUserId = `testUser_UQRS_${Date.now()}`;
  const testQuestionId = `testQuestion_UQRS_${Date.now()}`;
  const testQuestionListId = `testQuestionList_UQRS_${Date.now()}`;
  
  let createdResponseId: string;
  
  // Limpar dados de teste após todos os testes
  afterAll(async () => {
    const querySnapshot = await firestore
      .collection("userQuestionResponses")
      .where("userId", "==", testUserId)
      .get();
    
    const batch = firestore.batch();
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log("Coleção userQuestionResponses limpa (documentos correspondentes à query).");
  });
  
  it("deve criar uma nova resposta de usuário para uma questão", async () => {
    const responseData: Omit<FirebaseUserQuestionResponse, "id" | "createdAt" | "updatedAt"> = {
      userId: testUserId,
      questionId: testQuestionId,
      questionListId: testQuestionListId,
      selectedAlternativeId: "alt123",
      isCorrect: true,
      responseTimeSeconds: 45,
      addedToErrorNotebook: false,
      reviewCount: 0
    };
    
    createdResponseId = await createUserQuestionResponse(responseData);
    expect(createdResponseId).toBeDefined();
    expect(typeof createdResponseId).toBe("string");
    
    const createdResponse = await getUserQuestionResponseById(createdResponseId);
    expect(createdResponse).not.toBeNull();
    expect(createdResponse?.userId).toBe(testUserId);
    expect(createdResponse?.questionId).toBe(testQuestionId);
    expect(createdResponse?.questionListId).toBe(testQuestionListId);
    expect(createdResponse?.selectedAlternativeId).toBe("alt123");
    expect(createdResponse?.isCorrect).toBe(true);
    expect(createdResponse?.responseTimeSeconds).toBe(45);
    expect(createdResponse?.addedToErrorNotebook).toBe(false);
    expect(createdResponse?.reviewCount).toBe(0);
    expect(createdResponse?.createdAt).toBeInstanceOf(Timestamp);
    expect(createdResponse?.updatedAt).toBeInstanceOf(Timestamp);
  });
  
  it("deve obter uma resposta de usuário pelo ID", async () => {
    const response = await getUserQuestionResponseById(createdResponseId);
    expect(response).not.toBeNull();
    expect(response?.id).toBe(createdResponseId);
    expect(response?.userId).toBe(testUserId);
  });
  
  it("deve atualizar uma resposta de usuário", async () => {
    const updateData: Partial<Omit<FirebaseUserQuestionResponse, "id" | "createdAt">> = {
      responseTimeSeconds: 60,
      addedToErrorNotebook: true
    };
    
    const updated = await updateUserQuestionResponse(createdResponseId, updateData);
    expect(updated).toBe(true);
    
    const updatedResponse = await getUserQuestionResponseById(createdResponseId);
    expect(updatedResponse?.responseTimeSeconds).toBe(60);
    expect(updatedResponse?.addedToErrorNotebook).toBe(true);
    expect(updatedResponse?.updatedAt).not.toEqual(updatedResponse?.createdAt);
  });
  
  it("deve obter respostas de usuário por ID de usuário", async () => {
    // Criar uma segunda resposta para o mesmo usuário
    const responseData2: Omit<FirebaseUserQuestionResponse, "id" | "createdAt" | "updatedAt"> = {
      userId: testUserId,
      questionId: `${testQuestionId}_2`,
      isCorrect: false,
      responseTimeSeconds: 30,
      addedToErrorNotebook: false,
      reviewCount: 0
    };
    
    await createUserQuestionResponse(responseData2);
    
    const { responses } = await getUserQuestionResponsesByUserId(testUserId);
    expect(responses.length).toBeGreaterThanOrEqual(2);
    expect(responses.some(r => r.questionId === testQuestionId)).toBe(true);
    expect(responses.some(r => r.questionId === `${testQuestionId}_2`)).toBe(true);
  });
  
  it("deve filtrar respostas de usuário por isCorrect", async () => {
    const { responses: correctResponses } = await getUserQuestionResponsesByUserId(testUserId, {
      isCorrect: true
    });
    
    expect(correctResponses.length).toBeGreaterThanOrEqual(1);
    expect(correctResponses.every(r => r.isCorrect)).toBe(true);
    
    const { responses: incorrectResponses } = await getUserQuestionResponsesByUserId(testUserId, {
      isCorrect: false
    });
    
    expect(incorrectResponses.length).toBeGreaterThanOrEqual(1);
    expect(incorrectResponses.every(r => !r.isCorrect)).toBe(true);
  });
  
  it("deve excluir uma resposta de usuário", async () => {
    // Criar uma resposta para excluir
    const responseData: Omit<FirebaseUserQuestionResponse, "id" | "createdAt" | "updatedAt"> = {
      userId: testUserId,
      questionId: `${testQuestionId}_delete`,
      isCorrect: true,
      responseTimeSeconds: 20,
      addedToErrorNotebook: false,
      reviewCount: 0
    };
    
    const responseToDeleteId = await createUserQuestionResponse(responseData);
    
    // Verificar se foi criada
    const createdResponse = await getUserQuestionResponseById(responseToDeleteId);
    expect(createdResponse).not.toBeNull();
    
    // Excluir
    const deleted = await deleteUserQuestionResponse(responseToDeleteId);
    expect(deleted).toBe(true);
    
    // Verificar se foi excluída
    const deletedResponse = await getUserQuestionResponseById(responseToDeleteId);
    expect(deletedResponse).toBeNull();
  });
  
  it("deve retornar false ao tentar atualizar uma resposta inexistente", async () => {
    const updated = await updateUserQuestionResponse("resposta_inexistente", {
      responseTimeSeconds: 100
    });
    
    expect(updated).toBe(false);
  });
  
  it("deve retornar false ao tentar excluir uma resposta inexistente", async () => {
    const deleted = await deleteUserQuestionResponse("resposta_inexistente");
    expect(deleted).toBe(false);
  });
});