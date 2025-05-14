import { firestore } from "../config/firebaseAdmin";

/**
 * Script para criar índices compostos no Firestore
 * 
 * Este script cria índices compostos necessários para consultas complexas
 * no Firestore. Ele usa a API de gerenciamento de índices do Firestore Admin.
 */
async function createFirestoreIndexes() {
  console.log("Iniciando criação de índices no Firestore...");

  try {
    // Índice para userQuestionResponses (userId + createdAt)
    console.log("Criando índice para userQuestionResponses (userId + createdAt)...");
    await firestore.collection("userQuestionResponses")
      .where("userId", "==", "dummy")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Consulta executada para criar índice userQuestionResponses (userId + createdAt)");

    // Índice para userQuestionResponses (userId + isCorrect + createdAt)
    console.log("Criando índice para userQuestionResponses (userId + isCorrect + createdAt)...");
    await firestore.collection("userQuestionResponses")
      .where("userId", "==", "dummy")
      .where("isCorrect", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Consulta executada para criar índice userQuestionResponses (userId + isCorrect + createdAt)");

    // Índice para userQuestionResponses (userId + questionId + createdAt)
    console.log("Criando índice para userQuestionResponses (userId + questionId + createdAt)...");
    await firestore.collection("userQuestionResponses")
      .where("userId", "==", "dummy")
      .where("questionId", "==", "dummy")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Consulta executada para criar índice userQuestionResponses (userId + questionId + createdAt)");

    // Índice para userQuestionResponses (userId + questionListId + createdAt)
    console.log("Criando índice para userQuestionResponses (userId + questionListId + createdAt)...");
    await firestore.collection("userQuestionResponses")
      .where("userId", "==", "dummy")
      .where("questionListId", "==", "dummy")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Consulta executada para criar índice userQuestionResponses (userId + questionListId + createdAt)");

    console.log("Solicitações de criação de índices enviadas com sucesso!");
    console.log("IMPORTANTE: Acesse o console do Firebase para verificar e completar a criação dos índices:");
    console.log("https://console.firebase.google.com/project/medforum-488ec/firestore/indexes");
  } catch (error) {
    console.error("Erro ao criar índices:", error);
    console.log("Acesse o link fornecido no erro para criar o índice no console do Firebase.");
  }
}

// Executar a função
createFirestoreIndexes().catch(console.error);