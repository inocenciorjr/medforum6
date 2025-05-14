import { initializeAppIfNeeded, firestore, clearCollection } from "../../../config/firebaseAdmin";
import {
  createSimulatedExam,
  getSimulatedExamById,
  deleteSimulatedExam
} from "../../../services/firebaseSimulatedExamService";
import { FirebaseSimulatedExam, FirebaseSimulatedExamStatus } from "../../../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";

// Coleções para limpeza
const SIMULATED_EXAMS_COLLECTION = "simulatedExams";
const SIMULATED_EXAM_QUESTIONS_COLLECTION = "simulatedExamQuestions";
const SIMULATED_EXAM_RESULTS_COLLECTION = "simulatedExamResults";
const USERS_COLLECTION = "users"; // Se usuários forem criados para teste

// Inicializa o Firebase Admin SDK e o serviço
// Firebase Admin SDK já foi inicializado no jest.setup.js
// initSimulatedExamService(firestore); // Removido pois não existe no serviço

describe("FirebaseSimulatedExamService Integration Tests", () => {
  let testUserId = "testUser_SimulatedExamService";
  let createdSimulatedExamId: string;

  // Função auxiliar para criar um usuário de teste (se necessário)
  const ensureTestUser = async (userId: string) => {
    const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({
        id: userId,
        name: "Test User for Simulated Exam",
        email: `${userId}@example.com`,
        createdAt: Timestamp.now(),
      });
    }
  };

  // Função auxiliar para criar questões de simulado de teste
  const createTestSimulatedExamQuestions = async (simulatedExamId: string, count: number) => {
    const batch = firestore.batch();
    for (let i = 0; i < count; i++) {
      const questionRef = firestore.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).doc();
      batch.set(questionRef, {
        id: questionRef.id,
        simulatedExamId: simulatedExamId,
        questionId: `testQuestion_${i}`,
        order: i,
        createdAt: Timestamp.now(),
      });
    }
    await batch.commit();
    return count;
  };

  // Função auxiliar para criar resultados de simulado de teste
  const createTestSimulatedExamResults = async (simulatedExamId: string, userId: string, count: number) => {
    const batch = firestore.batch();
    for (let i = 0; i < count; i++) {
      const resultRef = firestore.collection(SIMULATED_EXAM_RESULTS_COLLECTION).doc();
      batch.set(resultRef, {
        id: resultRef.id,
        simulatedExamId: simulatedExamId,
        userId: userId,
        score: Math.random() * 100,
        completedAt: Timestamp.now(),
        answers: [],
      });
    }
    await batch.commit();
    return count;
  };

  beforeAll(async () => {
    // Garante que o usuário de teste exista
    await ensureTestUser(testUserId);
  });

  afterEach(async () => {
    // Limpa as coleções após cada teste para evitar interferência
    // Cuidado ao usar em produção ou com dados reais
    if (createdSimulatedExamId) {
        // Tenta deletar o simulado criado se o teste falhou antes da deleção
        try {
            await deleteSimulatedExam(createdSimulatedExamId, testUserId);
        } catch (error) {
            // Ignora erros se o simulado já foi deletado ou não existe
        }
    }
    await clearCollection(SIMULATED_EXAM_QUESTIONS_COLLECTION, ref => ref.where("simulatedExamId", "==", createdSimulatedExamId));
    await clearCollection(SIMULATED_EXAM_RESULTS_COLLECTION, ref => ref.where("simulatedExamId", "==", createdSimulatedExamId));
    await clearCollection(SIMULATED_EXAMS_COLLECTION, ref => ref.where("userId", "==", testUserId));
    createdSimulatedExamId = ""; // Reseta o ID
  });

  afterAll(async () => {
    // Limpeza final, remove o usuário de teste
    await clearCollection(USERS_COLLECTION, ref => ref.where("id", "==", testUserId));
    // Fecha a conexão com o Firestore se necessário (geralmente não é preciso em testes)
    // await firestore.terminate();
  });

  describe("createSimulatedExam", () => {
    it("should create a new simulated exam successfully", async () => {
      const examData = {
        userId: testUserId,
        title: "My First Simulated Exam",
        description: "A comprehensive test.",
        questionCount: 50,
        timeLimitMinutes: 120,
        isPublic: false,
        status: FirebaseSimulatedExamStatus.DRAFT,
      };
      const createdExam = await createSimulatedExam(examData);
      createdSimulatedExamId = createdExam.id; // Salva para limpeza

      expect(createdExam).toBeDefined();
      expect(createdExam.id).toBeTruthy();
      expect(createdExam.title).toBe(examData.title);
      expect(createdExam.userId).toBe(testUserId);

      const fetchedExam = await getSimulatedExamById(createdExam.id);
      expect(fetchedExam).toEqual(createdExam);
    });
  });

  describe("deleteSimulatedExam", () => {
    it("should delete a simulated exam and its associated questions and results", async () => {
      // 1. Criar um simulado
      const examData = {
        userId: testUserId,
        title: "Exam to be Deleted",
        questionCount: 5,
        timeLimitMinutes: 30,
        isPublic: false,
      };
      const exam = await createSimulatedExam(examData);
      createdSimulatedExamId = exam.id;
      expect(exam).toBeDefined();

      // 2. Criar questões e resultados associados
      const numQuestions = 3;
      const numResults = 2;
      await createTestSimulatedExamQuestions(exam.id, numQuestions);
      await createTestSimulatedExamResults(exam.id, testUserId, numResults);

      // Verificar se foram criados
      let questionsSnapshot = await firestore.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).where("simulatedExamId", "==", exam.id).get();
      expect(questionsSnapshot.size).toBe(numQuestions);
      let resultsSnapshot = await firestore.collection(SIMULATED_EXAM_RESULTS_COLLECTION).where("simulatedExamId", "==", exam.id).get();
      expect(resultsSnapshot.size).toBe(numResults);

      // 3. Deletar o simulado
      await deleteSimulatedExam(exam.id, testUserId);

      // 4. Verificar se o simulado foi deletado
      const fetchedExam = await getSimulatedExamById(exam.id);
      expect(fetchedExam).toBeNull();

      // 5. Verificar se as questões associadas foram deletadas
      questionsSnapshot = await firestore.collection(SIMULATED_EXAM_QUESTIONS_COLLECTION).where("simulatedExamId", "==", exam.id).get();
      expect(questionsSnapshot.empty).toBe(true);
      expect(questionsSnapshot.size).toBe(0);

      // 6. Verificar se os resultados associados foram deletados
      resultsSnapshot = await firestore.collection(SIMULATED_EXAM_RESULTS_COLLECTION).where("simulatedExamId", "==", exam.id).get();
      expect(resultsSnapshot.empty).toBe(true);
      expect(resultsSnapshot.size).toBe(0);
      
      createdSimulatedExamId = ""; // Já foi deletado, não precisa limpar no afterEach
    });

    it("should throw an error if user is not authorized to delete", async () => {
      const examData = {
        userId: testUserId,
        title: "Protected Exam",
        questionCount: 1,
        timeLimitMinutes: 10,
        isPublic: false,
      };
      const exam = await createSimulatedExam(examData);
      createdSimulatedExamId = exam.id;

      await expect(deleteSimulatedExam(exam.id, "anotherUserId")).rejects.toThrow(
        "Usuário não autorizado a deletar este simulado."
      );
      
      // Verifica se o simulado ainda existe
      const fetchedExam = await getSimulatedExamById(exam.id);
      expect(fetchedExam).not.toBeNull();
    });

    it("should throw an error if exam to delete is not found", async () => {
      await expect(deleteSimulatedExam("nonExistentExamId", testUserId)).rejects.toThrow(
        'Simulado com ID "nonExistentExamId" não encontrado.'
      );
    });
  });
});

