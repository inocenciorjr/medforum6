import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para testes A/B
export enum FirebaseABTestStatus {
  DRAFT = "draft",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  ARCHIVED = "archived"
}

export interface FirebaseABTestVariant {
  id: string;
  name: string;
  description?: string | null;
  weight: number; // Peso para distribuição (0-100)
  config: Record<string, any>;
}

export interface FirebaseABTest {
  id: string;
  name: string;
  description?: string | null;
  status: FirebaseABTestStatus;
  targetAudience?: {
    userRoles?: string[] | null;
    userIds?: string[] | null;
    userPercentage?: number | null;
    filters?: Record<string, any> | null;
  } | null;
  variants: FirebaseABTestVariant[];
  startDate?: Timestamp | null;
  endDate?: Timestamp | null;
  metrics: string[]; // Métricas a serem rastreadas
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseABTestAssignment {
  id: string;
  testId: string;
  userId: string;
  variantId: string;
  assignedAt: Timestamp;
}

export interface FirebaseABTestEvent {
  id: string;
  testId: string;
  variantId: string;
  userId?: string | null;
  sessionId?: string | null;
  metric: string;
  value: any;
  metadata?: Record<string, any> | null;
  timestamp: Timestamp;
}

export interface FirebaseABTestResult {
  id: string;
  testId: string;
  generatedAt: Timestamp;
  status: FirebaseABTestStatus;
  totalParticipants: number;
  variantResults: Array<{
    variantId: string;
    variantName: string;
    participants: number;
    metrics: Record<string, {
      count: number;
      sum?: number | null;
      avg?: number | null;
      min?: number | null;
      max?: number | null;
      conversionRate?: number | null;
    }>;
  }>;
  winningVariantId?: string | null;
  confidenceLevel?: number | null;
  metadata?: Record<string, any> | null;
}

const AB_TESTS_COLLECTION = "abTests";
const AB_TEST_ASSIGNMENTS_COLLECTION = "abTestAssignments";
const AB_TEST_EVENTS_COLLECTION = "abTestEvents";
const AB_TEST_RESULTS_COLLECTION = "abTestResults";

/**
 * Cria um novo teste A/B.
 */
export const createABTest = async (
  testData: Omit<FirebaseABTest, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseABTest> => {
  const testRef = db.collection(AB_TESTS_COLLECTION).doc();
  const now = Timestamp.now();

  // Validar que os pesos das variantes somam 100
  const totalWeight = testData.variants.reduce((sum, variant) => sum + variant.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Os pesos das variantes devem somar 100, mas somam ${totalWeight}.`);
  }

  const newTest: FirebaseABTest = {
    id: testRef.id,
    ...testData,
    createdAt: now,
    updatedAt: now,
  };

  await testRef.set(newTest);
  console.log(`Teste A/B (ID: ${newTest.id}) criado com sucesso.`);
  return newTest;
};

/**
 * Busca um teste A/B pelo ID.
 */
export const getABTestById = async (testId: string): Promise<FirebaseABTest | null> => {
  const docRef = db.collection(AB_TESTS_COLLECTION).doc(testId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseABTest;
  }
  console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
  return null;
};

/**
 * Busca testes A/B com opções de filtro.
 */
export const getABTests = async (
  options: {
    status?: FirebaseABTestStatus;
    createdBy?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'createdAt' | 'startDate' | 'endDate';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ tests: FirebaseABTest[]; total: number }> => {
  try {
    let query = db.collection(AB_TESTS_COLLECTION);
    
    // Aplicar filtros
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'createdAt';
    const orderDirection = options.orderDirection || 'desc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let tests: FirebaseABTest[] = [];
    snapshot.forEach(doc => {
      tests.push(doc.data() as FirebaseABTest);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTermLower = options.searchTerm.toLowerCase();
      tests = tests.filter(test => 
        test.name.toLowerCase().includes(searchTermLower) ||
        (test.description && test.description.toLowerCase().includes(searchTermLower))
      );
    }
    
    return { tests, total };
  } catch (error) {
    console.error(`Erro ao buscar testes A/B:`, error);
    throw error;
  }
};

/**
 * Atualiza um teste A/B existente.
 */
export const updateABTest = async (
  testId: string, 
  updates: Partial<Omit<FirebaseABTest, "id" | "createdAt" | "createdBy">>
): Promise<FirebaseABTest | null> => {
  const testRef = db.collection(AB_TESTS_COLLECTION).doc(testId);
  
  // Se as variantes estiverem sendo atualizadas, validar que os pesos somam 100
  if (updates.variants) {
    const totalWeight = updates.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Os pesos das variantes devem somar 100, mas somam ${totalWeight}.`);
    }
  }
  
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await testRef.update(updateData);
    console.log(`Teste A/B (ID: ${testId}) atualizado com sucesso.`);
    const updatedDoc = await testRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseABTest : null;
  } catch (error) {
    console.error(`Erro ao atualizar teste A/B (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Inicia um teste A/B.
 */
export const startABTest = async (testId: string): Promise<FirebaseABTest | null> => {
  const test = await getABTestById(testId);
  if (!test) {
    console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
    return null;
  }
  
  if (test.status !== FirebaseABTestStatus.DRAFT && test.status !== FirebaseABTestStatus.PAUSED) {
    throw new Error(`Não é possível iniciar um teste com status ${test.status}.`);
  }
  
  const now = Timestamp.now();
  
  return updateABTest(testId, {
    status: FirebaseABTestStatus.RUNNING,
    startDate: test.startDate || now
  });
};

/**
 * Pausa um teste A/B.
 */
export const pauseABTest = async (testId: string): Promise<FirebaseABTest | null> => {
  const test = await getABTestById(testId);
  if (!test) {
    console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
    return null;
  }
  
  if (test.status !== FirebaseABTestStatus.RUNNING) {
    throw new Error(`Não é possível pausar um teste com status ${test.status}.`);
  }
  
  return updateABTest(testId, {
    status: FirebaseABTestStatus.PAUSED
  });
};

/**
 * Finaliza um teste A/B.
 */
export const completeABTest = async (
  testId: string,
  winningVariantId?: string
): Promise<FirebaseABTest | null> => {
  const test = await getABTestById(testId);
  if (!test) {
    console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
    return null;
  }
  
  if (test.status !== FirebaseABTestStatus.RUNNING && test.status !== FirebaseABTestStatus.PAUSED) {
    throw new Error(`Não é possível finalizar um teste com status ${test.status}.`);
  }
  
  const now = Timestamp.now();
  
  // Gerar resultados finais do teste
  await generateABTestResults(testId, winningVariantId);
  
  return updateABTest(testId, {
    status: FirebaseABTestStatus.COMPLETED,
    endDate: now
  });
};

/**
 * Arquiva um teste A/B.
 */
export const archiveABTest = async (testId: string): Promise<FirebaseABTest | null> => {
  const test = await getABTestById(testId);
  if (!test) {
    console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
    return null;
  }
  
  if (test.status !== FirebaseABTestStatus.COMPLETED) {
    throw new Error(`Não é possível arquivar um teste com status ${test.status}.`);
  }
  
  return updateABTest(testId, {
    status: FirebaseABTestStatus.ARCHIVED
  });
};

/**
 * Exclui um teste A/B.
 */
export const deleteABTest = async (testId: string): Promise<void> => {
  const test = await getABTestById(testId);
  if (!test) {
    console.warn(`Teste A/B (ID: ${testId}) não encontrado para exclusão.`);
    return;
  }
  
  if (test.status !== FirebaseABTestStatus.DRAFT && test.status !== FirebaseABTestStatus.ARCHIVED) {
    throw new Error(`Não é possível excluir um teste com status ${test.status}.`);
  }
  
  try {
    // Excluir atribuições
    const assignmentsSnapshot = await db.collection(AB_TEST_ASSIGNMENTS_COLLECTION)
      .where("testId", "==", testId)
      .get();
    
    const assignmentBatch = db.batch();
    assignmentsSnapshot.forEach(doc => {
      assignmentBatch.delete(doc.ref);
    });
    await assignmentBatch.commit();
    
    // Excluir eventos
    const eventsSnapshot = await db.collection(AB_TEST_EVENTS_COLLECTION)
      .where("testId", "==", testId)
      .get();
    
    // Excluir eventos em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    const totalEvents = eventsSnapshot.size;
    let processedEvents = 0;
    
    while (processedEvents < totalEvents) {
      const eventBatch = db.batch();
      const currentBatch = eventsSnapshot.docs.slice(processedEvents, processedEvents + batchSize);
      
      currentBatch.forEach(doc => {
        eventBatch.delete(doc.ref);
      });
      
      await eventBatch.commit();
      processedEvents += currentBatch.length;
    }
    
    // Excluir resultados
    const resultsSnapshot = await db.collection(AB_TEST_RESULTS_COLLECTION)
      .where("testId", "==", testId)
      .get();
    
    const resultBatch = db.batch();
    resultsSnapshot.forEach(doc => {
      resultBatch.delete(doc.ref);
    });
    await resultBatch.commit();
    
    // Excluir o teste
    const testRef = db.collection(AB_TESTS_COLLECTION).doc(testId);
    await testRef.delete();
    
    console.log(`Teste A/B (ID: ${testId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir teste A/B (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Atribui um usuário a uma variante de um teste A/B.
 */
export const assignUserToVariant = async (
  testId: string,
  userId: string
): Promise<FirebaseABTestAssignment | null> => {
  try {
    // Verificar se o usuário já está atribuído a este teste
    const existingAssignment = await getUserTestAssignment(testId, userId);
    if (existingAssignment) {
      return existingAssignment;
    }
    
    // Obter o teste
    const test = await getABTestById(testId);
    if (!test) {
      console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
      return null;
    }
    
    // Verificar se o teste está em execução
    if (test.status !== FirebaseABTestStatus.RUNNING) {
      console.warn(`Teste A/B (ID: ${testId}) não está em execução (status: ${test.status}).`);
      return null;
    }
    
    // Verificar se o usuário está no público-alvo
    if (test.targetAudience) {
      // Verificar userIds específicos
      if (test.targetAudience.userIds && test.targetAudience.userIds.length > 0) {
        if (!test.targetAudience.userIds.includes(userId)) {
          console.warn(`Usuário (ID: ${userId}) não está no público-alvo do teste (ID: ${testId}).`);
          return null;
        }
      }
      
      // Verificar roles (requer consulta adicional ao usuário)
      // Implementação simplificada - em um caso real, você consultaria o usuário
      if (test.targetAudience.userRoles && test.targetAudience.userRoles.length > 0) {
        // Verificar se o usuário tem uma das roles alvo
        // ...
      }
      
      // Verificar porcentagem de usuários
      if (test.targetAudience.userPercentage !== null && test.targetAudience.userPercentage !== undefined) {
        // Usar hash determinístico para garantir consistência
        const hash = hashString(userId + testId);
        const userPercentile = hash % 100;
        
        if (userPercentile >= test.targetAudience.userPercentage) {
          console.warn(`Usuário (ID: ${userId}) não está no percentil alvo do teste (ID: ${testId}).`);
          return null;
        }
      }
      
      // Verificar filtros adicionais
      if (test.targetAudience.filters) {
        // Implementar lógica de filtros personalizados
        // ...
      }
    }
    
    // Selecionar uma variante com base nos pesos
    const variantId = selectVariantByWeight(test.variants);
    
    // Criar a atribuição
    const assignmentRef = db.collection(AB_TEST_ASSIGNMENTS_COLLECTION).doc();
    const now = Timestamp.now();
    
    const assignment: FirebaseABTestAssignment = {
      id: assignmentRef.id,
      testId,
      userId,
      variantId,
      assignedAt: now
    };
    
    await assignmentRef.set(assignment);
    console.log(`Usuário (ID: ${userId}) atribuído à variante (ID: ${variantId}) do teste (ID: ${testId}).`);
    
    return assignment;
  } catch (error) {
    console.error(`Erro ao atribuir usuário (ID: ${userId}) ao teste (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Função auxiliar para selecionar uma variante com base nos pesos.
 */
const selectVariantByWeight = (variants: FirebaseABTestVariant[]): string => {
  // Calcular o peso total (deve ser 100, mas por segurança)
  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  
  // Gerar um número aleatório entre 0 e o peso total
  const random = Math.random() * totalWeight;
  
  // Selecionar a variante com base no número aleatório
  let cumulativeWeight = 0;
  
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (random <= cumulativeWeight) {
      return variant.id;
    }
  }
  
  // Fallback para a última variante (não deveria acontecer)
  return variants[variants.length - 1].id;
};

/**
 * Busca a atribuição de um usuário a um teste A/B.
 */
export const getUserTestAssignment = async (
  testId: string,
  userId: string
): Promise<FirebaseABTestAssignment | null> => {
  try {
    const snapshot = await db.collection(AB_TEST_ASSIGNMENTS_COLLECTION)
      .where("testId", "==", testId)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseABTestAssignment;
  } catch (error) {
    console.error(`Erro ao buscar atribuição do usuário (ID: ${userId}) ao teste (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Obtém a variante atribuída a um usuário para um teste A/B.
 * Se o usuário ainda não estiver atribuído, atribui automaticamente.
 */
export const getTestVariantForUser = async (
  testId: string,
  userId: string
): Promise<FirebaseABTestVariant | null> => {
  try {
    // Verificar se o usuário já está atribuído
    let assignment = await getUserTestAssignment(testId, userId);
    
    // Se não estiver atribuído, atribuir agora
    if (!assignment) {
      assignment = await assignUserToVariant(testId, userId);
    }
    
    if (!assignment) {
      console.warn(`Não foi possível atribuir o usuário (ID: ${userId}) ao teste (ID: ${testId}).`);
      return null;
    }
    
    // Obter o teste para acessar a variante
    const test = await getABTestById(testId);
    if (!test) {
      console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
      return null;
    }
    
    // Encontrar a variante atribuída
    const variant = test.variants.find(v => v.id === assignment!.variantId);
    
    if (!variant) {
      console.warn(`Variante (ID: ${assignment.variantId}) não encontrada no teste (ID: ${testId}).`);
      return null;
    }
    
    return variant;
  } catch (error) {
    console.error(`Erro ao obter variante para o usuário (ID: ${userId}) no teste (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Registra um evento de teste A/B.
 */
export const trackABTestEvent = async (
  testId: string,
  metric: string,
  value: any,
  userId?: string,
  sessionId?: string,
  metadata?: Record<string, any>
): Promise<FirebaseABTestEvent | null> => {
  try {
    // Verificar se o teste existe
    const test = await getABTestById(testId);
    if (!test) {
      console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
      return null;
    }
    
    // Verificar se a métrica está sendo rastreada neste teste
    if (!test.metrics.includes(metric)) {
      console.warn(`Métrica '${metric}' não está sendo rastreada no teste (ID: ${testId}).`);
      return null;
    }
    
    // Verificar se o teste está em execução
    if (test.status !== FirebaseABTestStatus.RUNNING) {
      console.warn(`Teste A/B (ID: ${testId}) não está em execução (status: ${test.status}).`);
      return null;
    }
    
    // Obter a variante atribuída ao usuário
    let variantId: string | null = null;
    
    if (userId) {
      const assignment = await getUserTestAssignment(testId, userId);
      if (assignment) {
        variantId = assignment.variantId;
      }
    }
    
    if (!variantId) {
      console.warn(`Não foi possível determinar a variante para o evento.`);
      return null;
    }
    
    // Criar o evento
    const eventRef = db.collection(AB_TEST_EVENTS_COLLECTION).doc();
    const now = Timestamp.now();
    
    const event: FirebaseABTestEvent = {
      id: eventRef.id,
      testId,
      variantId,
      userId: userId || null,
      sessionId: sessionId || null,
      metric,
      value,
      metadata: metadata || null,
      timestamp: now
    };
    
    await eventRef.set(event);
    console.log(`Evento de teste A/B registrado: ${metric} = ${value} para variante (ID: ${variantId}) do teste (ID: ${testId}).`);
    
    return event;
  } catch (error) {
    console.error(`Erro ao registrar evento de teste A/B:`, error);
    throw error;
  }
};

/**
 * Gera resultados para um teste A/B.
 */
export const generateABTestResults = async (
  testId: string,
  winningVariantId?: string
): Promise<FirebaseABTestResult | null> => {
  try {
    // Obter o teste
    const test = await getABTestById(testId);
    if (!test) {
      console.warn(`Teste A/B (ID: ${testId}) não encontrado.`);
      return null;
    }
    
    // Obter todas as atribuições para este teste
    const assignmentsSnapshot = await db.collection(AB_TEST_ASSIGNMENTS_COLLECTION)
      .where("testId", "==", testId)
      .get();
    
    // Contar participantes por variante
    const participantsByVariant = new Map<string, number>();
    test.variants.forEach(variant => {
      participantsByVariant.set(variant.id, 0);
    });
    
    assignmentsSnapshot.forEach(doc => {
      const assignment = doc.data() as FirebaseABTestAssignment;
      const count = participantsByVariant.get(assignment.variantId) || 0;
      participantsByVariant.set(assignment.variantId, count + 1);
    });
    
    // Obter todos os eventos para este teste
    const eventsSnapshot = await db.collection(AB_TEST_EVENTS_COLLECTION)
      .where("testId", "==", testId)
      .get();
    
    // Processar eventos por variante e métrica
    const metricsByVariant = new Map<string, Map<string, {
      count: number;
      sum: number;
      min: number;
      max: number;
      values: number[];
    }>>();
    
    // Inicializar estrutura de dados
    test.variants.forEach(variant => {
      const metricMap = new Map<string, {
        count: number;
        sum: number;
        min: number;
        max: number;
        values: number[];
      }>();
      
      test.metrics.forEach(metric => {
        metricMap.set(metric, {
          count: 0,
          sum: 0,
          min: Number.MAX_VALUE,
          max: Number.MIN_VALUE,
          values: []
        });
      });
      
      metricsByVariant.set(variant.id, metricMap);
    });
    
    // Processar eventos
    eventsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseABTestEvent;
      const metricMap = metricsByVariant.get(event.variantId);
      
      if (metricMap) {
        const metricData = metricMap.get(event.metric);
        
        if (metricData) {
          metricData.count++;
          
          // Processar valor numérico, se aplicável
          if (typeof event.value === 'number') {
            metricData.sum += event.value;
            metricData.min = Math.min(metricData.min, event.value);
            metricData.max = Math.max(metricData.max, event.value);
            metricData.values.push(event.value);
          }
        }
      }
    });
    
    // Calcular resultados por variante
    const variantResults = test.variants.map(variant => {
      const participants = participantsByVariant.get(variant.id) || 0;
      const metricMap = metricsByVariant.get(variant.id);
      const metrics: Record<string, {
        count: number;
        sum?: number | null;
        avg?: number | null;
        min?: number | null;
        max?: number | null;
        conversionRate?: number | null;
      }> = {};
      
      if (metricMap) {
        metricMap.forEach((data, metric) => {
          metrics[metric] = {
            count: data.count,
            sum: data.sum || null,
            avg: data.count > 0 ? data.sum / data.count : null,
            min: data.min !== Number.MAX_VALUE ? data.min : null,
            max: data.max !== Number.MIN_VALUE ? data.max : null,
            conversionRate: participants > 0 ? (data.count / participants) * 100 : null
          };
        });
      }
      
      return {
        variantId: variant.id,
        variantName: variant.name,
        participants,
        metrics
      };
    });
    
    // Criar o resultado
    const resultRef = db.collection(AB_TEST_RESULTS_COLLECTION).doc();
    const now = Timestamp.now();
    
    const result: FirebaseABTestResult = {
      id: resultRef.id,
      testId,
      generatedAt: now,
      status: test.status,
      totalParticipants: assignmentsSnapshot.size,
      variantResults,
      winningVariantId: winningVariantId || null,
      confidenceLevel: null, // Cálculo de nível de confiança requer análise estatística mais complexa
      metadata: null
    };
    
    await resultRef.set(result);
    console.log(`Resultados do teste A/B (ID: ${testId}) gerados com sucesso.`);
    
    return result;
  } catch (error) {
    console.error(`Erro ao gerar resultados do teste A/B (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Busca os resultados mais recentes de um teste A/B.
 */
export const getLatestABTestResults = async (testId: string): Promise<FirebaseABTestResult | null> => {
  try {
    const snapshot = await db.collection(AB_TEST_RESULTS_COLLECTION)
      .where("testId", "==", testId)
      .orderBy("generatedAt", "desc")
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseABTestResult;
  } catch (error) {
    console.error(`Erro ao buscar resultados do teste A/B (ID: ${testId}):`, error);
    throw error;
  }
};

/**
 * Função auxiliar para gerar um hash numérico de uma string.
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para inteiro de 32 bits
  }
  return Math.abs(hash);
};