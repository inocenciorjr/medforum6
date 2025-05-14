import * as admin from 'firebase-admin';
import { firestore } from 'firebase-admin';
import logger from './logger';

/**
 * Inicializa o Firebase Admin SDK
 * 
 * @returns {admin.app.App} Instância do Firebase Admin
 */
export const initializeFirebase = (): admin.app.App => {
  try {
    // Verificar se o Firebase já foi inicializado
    if (admin.apps.length === 0) {
      // Inicializar com credenciais do ambiente ou arquivo de serviço
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
      } else {
        // Inicializar com detecção automática (para ambiente de produção)
        admin.initializeApp();
      }
      
      // Configurar Firestore
      const db = admin.firestore();
      db.settings({
        ignoreUndefinedProperties: true,
      });
      
      logger.info('Firebase Admin SDK inicializado com sucesso');
    }
    
    return admin.app();
  } catch (error) {
    logger.error('Erro ao inicializar Firebase Admin SDK:', error);
    throw error;
  }
};

/**
 * Executa uma operação em lote no Firestore
 * 
 * @param {Array<Function>} operations - Funções que recebem um objeto WriteBatch e executam operações
 * @returns {Promise<void>} Promise que resolve quando o lote é concluído
 */
export const runBatchOperation = async (operations: Array<(batch: firestore.WriteBatch) => void>): Promise<void> => {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    
    // Executar todas as operações no lote
    operations.forEach(operation => operation(batch));
    
    // Confirmar o lote
    await batch.commit();
  } catch (error) {
    logger.error('Erro ao executar operação em lote:', error);
    throw error;
  }
};

/**
 * Executa uma transação no Firestore
 * 
 * @param {Function} transactionFn - Função que recebe um objeto Transaction e executa operações
 * @returns {Promise<any>} Promise que resolve com o resultado da transação
 */
export const runTransaction = async <T>(transactionFn: (transaction: firestore.Transaction) => Promise<T>): Promise<T> => {
  try {
    const db = admin.firestore();
    return await db.runTransaction(transactionFn);
  } catch (error) {
    logger.error('Erro ao executar transação:', error);
    throw error;
  }
};

/**
 * Cria um documento com ID automático
 * 
 * @param {string} collection - Nome da coleção
 * @param {any} data - Dados a serem salvos
 * @returns {Promise<string>} ID do documento criado
 */
export const createDocument = async (collection: string, data: any): Promise<string> => {
  try {
    const db = admin.firestore();
    const docRef = await db.collection(collection).add({
      ...data,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    logger.error(`Erro ao criar documento na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Cria um documento com ID específico
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {any} data - Dados a serem salvos
 * @returns {Promise<void>}
 */
export const createDocumentWithId = async (collection: string, docId: string, data: any): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).set({
      ...data,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao criar documento com ID ${docId} na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Atualiza um documento existente
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {any} data - Dados a serem atualizados
 * @returns {Promise<void>}
 */
export const updateDocument = async (collection: string, docId: string, data: any): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).update({
      ...data,
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao atualizar documento com ID ${docId} na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Exclui um documento
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<void>}
 */
export const deleteDocument = async (collection: string, docId: string): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).delete();
  } catch (error) {
    logger.error(`Erro ao excluir documento com ID ${docId} na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Obtém um documento pelo ID
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<any|null>} Documento ou null se não existir
 */
export const getDocumentById = async (collection: string, docId: string): Promise<any | null> => {
  try {
    const db = admin.firestore();
    const docSnapshot = await db.collection(collection).doc(docId).get();
    
    if (!docSnapshot.exists) {
      return null;
    }
    
    return {
      id: docSnapshot.id,
      ...docSnapshot.data()
    };
  } catch (error) {
    logger.error(`Erro ao obter documento com ID ${docId} na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Verifica se um documento existe
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @returns {Promise<boolean>} True se o documento existir
 */
export const documentExists = async (collection: string, docId: string): Promise<boolean> => {
  try {
    const db = admin.firestore();
    const docSnapshot = await db.collection(collection).doc(docId).get();
    return docSnapshot.exists;
  } catch (error) {
    logger.error(`Erro ao verificar existência do documento com ID ${docId} na coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Obtém documentos com paginação
 * 
 * @param {string} collection - Nome da coleção
 * @param {Object} options - Opções de consulta
 * @returns {Promise<{items: any[], total: number, lastDoc: any}>} Documentos paginados
 */
export const getDocumentsWithPagination = async (
  collection: string,
  options: {
    where?: Array<[string, firestore.WhereFilterOp, any]>,
    orderBy?: [string, 'asc' | 'desc'],
    limit?: number,
    startAfter?: any,
    select?: string[]
  }
): Promise<{ items: any[], total: number, lastDoc: any }> => {
  try {
    const db = admin.firestore();
    let query: firestore.Query = db.collection(collection);
    
    // Aplicar filtros where
    if (options.where && options.where.length > 0) {
      options.where.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    // Aplicar ordenação
    if (options.orderBy) {
      const [field, direction] = options.orderBy;
      query = query.orderBy(field, direction);
    }
    
    // Aplicar cursor de paginação
    if (options.startAfter) {
      query = query.startAfter(options.startAfter);
    }
    
    // Aplicar limite
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    // Aplicar seleção de campos
    if (options.select && options.select.length > 0) {
      query = query.select(...options.select);
    }
    
    // Executar a consulta
    const querySnapshot = await query.get();
    
    // Mapear documentos
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Obter o último documento para paginação
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    
    // Contar total de documentos (sem paginação)
    let countQuery: firestore.Query = db.collection(collection);
    
    if (options.where && options.where.length > 0) {
      options.where.forEach(([field, operator, value]) => {
        countQuery = countQuery.where(field, operator, value);
      });
    }
    
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    return { items, total, lastDoc };
  } catch (error) {
    logger.error(`Erro ao obter documentos paginados da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Incrementa um campo numérico em um documento
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {string} field - Campo a ser incrementado
 * @param {number} value - Valor a ser adicionado (padrão: 1)
 * @returns {Promise<void>}
 */
export const incrementField = async (
  collection: string,
  docId: string,
  field: string,
  value: number = 1
): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).update({
      [field]: firestore.FieldValue.increment(value),
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao incrementar campo ${field} no documento ${docId} da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Adiciona um elemento a um array em um documento
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {string} field - Campo do array
 * @param {any} value - Valor a ser adicionado
 * @returns {Promise<void>}
 */
export const addToArray = async (
  collection: string,
  docId: string,
  field: string,
  value: any
): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).update({
      [field]: firestore.FieldValue.arrayUnion(value),
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao adicionar elemento ao array ${field} no documento ${docId} da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Remove um elemento de um array em um documento
 * 
 * @param {string} collection - Nome da coleção
 * @param {string} docId - ID do documento
 * @param {string} field - Campo do array
 * @param {any} value - Valor a ser removido
 * @returns {Promise<void>}
 */
export const removeFromArray = async (
  collection: string,
  docId: string,
  field: string,
  value: any
): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection(collection).doc(docId).update({
      [field]: firestore.FieldValue.arrayRemove(value),
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao remover elemento do array ${field} no documento ${docId} da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Obtém documentos com base em uma consulta composta
 * 
 * @param {string} collection - Nome da coleção
 * @param {Object} options - Opções de consulta
 * @returns {Promise<any[]>} Documentos encontrados
 */
export const queryDocuments = async (
  collection: string,
  options: {
    where?: Array<[string, firestore.WhereFilterOp, any]>,
    orderBy?: Array<[string, 'asc' | 'desc']>,
    limit?: number,
    offset?: number,
    select?: string[]
  }
): Promise<any[]> => {
  try {
    const db = admin.firestore();
    let query: firestore.Query = db.collection(collection);
    
    // Aplicar filtros where
    if (options.where && options.where.length > 0) {
      options.where.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    // Aplicar ordenação
    if (options.orderBy && options.orderBy.length > 0) {
      options.orderBy.forEach(([field, direction]) => {
        query = query.orderBy(field, direction);
      });
    }
    
    // Aplicar offset
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    // Aplicar limite
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    // Aplicar seleção de campos
    if (options.select && options.select.length > 0) {
      query = query.select(...options.select);
    }
    
    // Executar a consulta
    const querySnapshot = await query.get();
    
    // Mapear documentos
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    logger.error(`Erro ao consultar documentos da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Obtém documentos aleatórios de uma coleção
 * 
 * @param {string} collection - Nome da coleção
 * @param {number} limit - Número de documentos a retornar
 * @param {Array<[string, firestore.WhereFilterOp, any]>} where - Filtros opcionais
 * @returns {Promise<any[]>} Documentos aleatórios
 */
export const getRandomDocuments = async (
  collection: string,
  limit: number,
  where?: Array<[string, firestore.WhereFilterOp, any]>
): Promise<any[]> => {
  try {
    const db = admin.firestore();
    let query: firestore.Query = db.collection(collection);
    
    // Aplicar filtros where
    if (where && where.length > 0) {
      where.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    // Obter todos os documentos que correspondem aos filtros
    const querySnapshot = await query.get();
    
    if (querySnapshot.empty) {
      return [];
    }
    
    // Converter para array
    const allDocs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Embaralhar o array
    const shuffled = [...allDocs].sort(() => 0.5 - Math.random());
    
    // Retornar o número solicitado de documentos
    return shuffled.slice(0, limit);
  } catch (error) {
    logger.error(`Erro ao obter documentos aleatórios da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Obtém o timestamp atual do Firestore
 * 
 * @returns {firestore.Timestamp} Timestamp atual
 */
export const getCurrentTimestamp = (): firestore.Timestamp => {
  return firestore.Timestamp.now();
};

/**
 * Converte um objeto Date para Timestamp do Firestore
 * 
 * @param {Date} date - Data a ser convertida
 * @returns {firestore.Timestamp} Timestamp do Firestore
 */
export const dateToTimestamp = (date: Date): firestore.Timestamp => {
  return firestore.Timestamp.fromDate(date);
};

/**
 * Converte um Timestamp do Firestore para objeto Date
 * 
 * @param {firestore.Timestamp} timestamp - Timestamp a ser convertido
 * @returns {Date} Objeto Date
 */
export const timestampToDate = (timestamp: firestore.Timestamp): Date => {
  return timestamp.toDate();
};

export default {
  initializeFirebase,
  runBatchOperation,
  runTransaction,
  createDocument,
  createDocumentWithId,
  updateDocument,
  deleteDocument,
  getDocumentById,
  documentExists,
  getDocumentsWithPagination,
  incrementField,
  addToArray,
  removeFromArray,
  queryDocuments,
  getRandomDocuments,
  getCurrentTimestamp,
  dateToTimestamp,
  timestampToDate
};