import { Firestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  FirebaseSimulatedExamQuestion,
  // FirebaseQuestion, // Para o snapshot - REMOVIDO POR NÃO USO
  FirebaseQuestionOption // Para o snapshot
} from "../types/firebaseTypes";
// import { FirebaseSimulatedExam } from "../types/firebaseTypes"; // Para atualizar questionCount - REMOVIDO POR NÃO USO

// Função para inicializar o serviço com a instância do Firestore
let db: Firestore;
export const initSimulatedExamQuestionService = (firestoreInstance: Firestore) => {
  db = firestoreInstance;
};

/**
 * Adiciona uma questão a um simulado existente.
 * @param examId ID do simulado.
 * @param questionId ID da questão a ser adicionada.
 * @param order Ordem da questão no simulado.
 * @param questionSnapshot Opcional: Snapshot da questão (texto e opções) para versionamento.
 * @param points Opcional: Pontuação específica para esta questão neste simulado.
 * @returns A entrada SimulatedExamQuestion criada.
 */
export const addQuestionToSimulatedExam = async (
  examId: string,
  questionId: string,
  order: number,
  questionSnapshot?: {
    text: string;
    options: FirebaseQuestionOption[];
  },
  points?: number
): Promise<FirebaseSimulatedExamQuestion> => {
  if (!db) throw new Error("SimulatedExamQuestionService não inicializado.");
  if (!examId) throw new Error("O ID do simulado é obrigatório.");
  if (!questionId) throw new Error("O ID da questão é obrigatório.");
  if (order === undefined || order < 0) throw new Error("A ordem da questão é obrigatória e não pode ser negativa.");

  const examRef = db.collection("simulatedExams").doc(examId);
  const questionRef = db.collection("questions").doc(questionId);

  // Verificar se o simulado e a questão existem
  const examDoc = await examRef.get();
  if (!examDoc.exists) {
    throw new Error(`Simulado com ID "${examId}" não encontrado.`);
  }
  const questionDoc = await questionRef.get();
  if (!questionDoc.exists) {
    throw new Error(`Questão com ID "${questionId}" não encontrada.`);
  }

  // Verificar se a questão já foi adicionada a este simulado para evitar duplicatas
  const existingEntryQuery = await db.collection("simulatedExamQuestions")
    .where("simulatedExamId", "==", examId)
    .where("questionId", "==", questionId)
    .limit(1)
    .get();

  if (!existingEntryQuery.empty) {
    throw new Error(`A questão "${questionId}" já existe no simulado "${examId}".`);
  }

  const newEntryRef = db.collection("simulatedExamQuestions").doc();
  const now = Timestamp.now();

  const newSimulatedExamQuestion: FirebaseSimulatedExamQuestion = {
    id: newEntryRef.id,
    simulatedExamId: examId,
    questionId: questionId,
    order: order,
    questionTextSnapshot: questionSnapshot?.text || null,
    questionOptionsSnapshot: questionSnapshot?.options || null,
    points: points || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(newEntryRef, newSimulatedExamQuestion);
    // Incrementar o questionCount no simulado
    transaction.update(examRef, {
      questionCount: FieldValue.increment(1),
      updatedAt: now
    });
  });

  return newSimulatedExamQuestion;
};

// Outras funções como getQuestionsForSimulatedExam, updateQuestionOrderInSimulatedExam, removeQuestionFromSimulatedExam serão adicionadas aqui.




/**
 * Lista todas as questões associadas a um simulado, ordenadas pela ordem definida.
 * @param examId ID do simulado.
 * @returns Um array de FirebaseSimulatedExamQuestion.
 */
export const getQuestionsForSimulatedExam = async (examId: string): Promise<FirebaseSimulatedExamQuestion[]> => {
  if (!db) throw new Error("SimulatedExamQuestionService não inicializado.");
  if (!examId) throw new Error("O ID do simulado é obrigatório.");

  const snapshot = await db.collection("simulatedExamQuestions")
    .where("simulatedExamId", "==", examId)
    .orderBy("order", "asc")
    .get();

  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => doc.data() as FirebaseSimulatedExamQuestion);
};

/**
 * Atualiza a ordem de uma questão específica dentro de um simulado.
 * @param entryId ID da entrada SimulatedExamQuestion a ser atualizada.
 * @param newOrder A nova ordem para a questão.
 * @returns A entrada SimulatedExamQuestion atualizada.
 */
export const updateQuestionOrderInSimulatedExam = async (
  entryId: string,
  newOrder: number
): Promise<FirebaseSimulatedExamQuestion> => {
  if (!db) throw new Error("SimulatedExamQuestionService não inicializado.");
  if (!entryId) throw new Error("O ID da entrada é obrigatório.");
  if (newOrder === undefined || newOrder < 0) throw new Error("A nova ordem é obrigatória e não pode ser negativa.");

  const entryRef = db.collection("simulatedExamQuestions").doc(entryId);
  const entryDoc = await entryRef.get();

  if (!entryDoc.exists) {
    throw new Error(`Entrada SimulatedExamQuestion com ID "${entryId}" não encontrada.`);
  }

  // Nota: A lógica para reordenar outras questões (se a ordem mudar e causar conflitos)
  // precisaria ser mais complexa e gerenciada pela aplicação cliente ou por uma Cloud Function
  // que observa mudanças e ajusta as ordens de forma transacional.
  // Esta função apenas atualiza a ordem da entrada especificada.

  await entryRef.update({
    order: newOrder,
    updatedAt: Timestamp.now(),
  });

  const updatedDoc = await entryRef.get();
  return updatedDoc.data() as FirebaseSimulatedExamQuestion;
};

/**
 * Remove uma questão de um simulado.
 * @param entryId ID da entrada SimulatedExamQuestion a ser removida.
 * @returns void
 */
export const removeQuestionFromSimulatedExam = async (entryId: string): Promise<void> => {
  if (!db) throw new Error("SimulatedExamQuestionService não inicializado.");
  if (!entryId) throw new Error("O ID da entrada é obrigatório.");

  const entryRef = db.collection("simulatedExamQuestions").doc(entryId);
  const entryDoc = await entryRef.get();

  if (!entryDoc.exists) {
    throw new Error(`Entrada SimulatedExamQuestion com ID "${entryId}" não encontrada.`);
  }

  const examId = (entryDoc.data() as FirebaseSimulatedExamQuestion).simulatedExamId;
  const examRef = db.collection("simulatedExams").doc(examId);

  await db.runTransaction(async (transaction) => {
    transaction.delete(entryRef);
    // Decrementar o questionCount no simulado
    transaction.update(examRef, {
      questionCount: FieldValue.increment(-1),
      updatedAt: Timestamp.now()
    });
  });
};

/**
 * Remove todas as questões de um simulado (usado ao deletar um simulado, por exemplo).
 * @param examId ID do simulado.
 * @returns void
 */
export const removeAllQuestionsFromSimulatedExam = async (examId: string): Promise<void> => {
  if (!db) throw new Error("SimulatedExamQuestionService não inicializado.");
  if (!examId) throw new Error("O ID do simulado é obrigatório.");

  const snapshot = await db.collection("simulatedExamQuestions")
    .where("simulatedExamId", "==", examId)
    .get();

  if (snapshot.empty) {
    return; // Nenhuma questão para remover
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  // Resetar o questionCount no simulado para 0
  const examRef = db.collection("simulatedExams").doc(examId);
  batch.update(examRef, { questionCount: 0, updatedAt: Timestamp.now() });

  await batch.commit();
};

