import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// Inicializar o Firebase Admin SDK
const serviceAccountPath = path.resolve(__dirname, '../firebase-credentials.json');

// Verificar se o Firebase já foi inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = getFirestore();

/**
 * Função para criar índices compostos no Firestore
 */
async function createIndexes() {
  console.log('Iniciando criação de índices no Firestore...');

  try {
    // Lista de índices a serem criados
    const indexes = [
      // Índice para userQuestionResponses (usado em firebaseUserQuestionResponseService)
      {
        collectionGroup: 'userQuestionResponses',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'nextReviewAt', order: 'ASCENDING' }
        ]
      },
      // Índice para userQuestionResponses (usado em firebaseUserQuestionResponseService)
      {
        collectionGroup: 'userQuestionResponses',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'questionId', order: 'ASCENDING' }
        ]
      },
      // Índice para payments (usado em firebasePaymentService)
      {
        collectionGroup: 'payments',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      // Índice para userPlans (usado em firebaseUserPlanService)
      {
        collectionGroup: 'userPlans',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' }
        ]
      },
      // Índice para flashcards (usado em firebaseFlashcardService)
      {
        collectionGroup: 'flashcards',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' }
        ]
      },
      // Índice para userQuestionHistory (usado em firebaseUserQuestionHistoryService)
      {
        collectionGroup: 'userQuestionHistory',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'attemptedAt', order: 'DESCENDING' }
        ]
      },
      // Índice para simulatedExams (usado em firebaseSimulatedExamService)
      {
        collectionGroup: 'simulatedExams',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      // Índice para simulatedExamResults (usado em firebaseSimulatedExamResultService)
      {
        collectionGroup: 'simulatedExamResults',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'completedAt', order: 'DESCENDING' }
        ]
      },
      // Índice para comments (usado em firebaseCommentService)
      {
        collectionGroup: 'comments',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'postId', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'ASCENDING' }
        ]
      },
      // Índice para mentorships (usado em firebaseMentorshipService)
      {
        collectionGroup: 'mentorships',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'mentorId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' }
        ]
      },
      // Índice para mentorships (usado em firebaseMentorshipService)
      {
        collectionGroup: 'mentorships',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'studentId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' }
        ]
      },
      // Índice para questionLists (usado em firebaseQuestionListService)
      {
        collectionGroup: 'questionLists',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'updatedAt', order: 'DESCENDING' }
        ]
      },
      // Índice para backupJobs (usado em firebaseBackupService)
      {
        collectionGroup: 'backupJobs',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      }
    ];

    // Criar cada índice
    for (const indexConfig of indexes) {
      try {
        console.log(`Criando índice para ${indexConfig.collectionGroup}...`);
        
        // Aqui usamos a API de Admin do Firestore para criar índices
        // Na prática, você precisaria usar a API do Firebase Admin para gerenciar índices
        // ou criar manualmente no console do Firebase
        console.log(`Configuração do índice:`, JSON.stringify(indexConfig, null, 2));
        
        // Nota: A criação real de índices requer acesso à API do Firebase Admin
        // que não está disponível diretamente aqui. Este script serve como um guia
        // para quais índices precisam ser criados manualmente no console do Firebase.
      } catch (error) {
        console.error(`Erro ao criar índice para ${indexConfig.collectionGroup}:`, error);
      }
    }

    console.log('Processo de criação de índices concluído.');
    console.log('IMPORTANTE: Para criar os índices reais, acesse o console do Firebase e crie-os manualmente.');
    console.log('URL: https://console.firebase.google.com/project/[SEU-PROJETO]/firestore/indexes');
  } catch (error) {
    console.error('Erro ao criar índices:', error);
  }
}

// Executar a função
createIndexes()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro ao executar script:', error);
    process.exit(1);
  });