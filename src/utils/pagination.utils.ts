import { firestore } from 'firebase-admin';
import logger from './logger';

/**
 * Interface para opções de paginação
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

/**
 * Interface para resultado paginado
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

/**
 * Aplica paginação baseada em offset a uma consulta do Firestore
 * 
 * @param query - Consulta do Firestore
 * @param options - Opções de paginação
 * @returns Consulta com paginação aplicada
 */
export const applyOffsetPagination = (
  query: firestore.Query,
  options: PaginationOptions
): firestore.Query => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const offset = (page - 1) * limit;
  
  // Aplicar ordenação se especificada
  if (options.sortBy) {
    query = query.orderBy(options.sortBy, options.sortOrder || 'asc');
  }
  
  // Aplicar offset e limite
  return query.offset(offset).limit(limit);
};

/**
 * Aplica paginação baseada em cursor a uma consulta do Firestore
 * 
 * @param query - Consulta do Firestore
 * @param options - Opções de paginação
 * @param lastDoc - Último documento da página anterior (opcional)
 * @returns Consulta com paginação aplicada
 */
export const applyCursorPagination = (
  query: firestore.Query,
  options: PaginationOptions,
  lastDoc?: firestore.DocumentSnapshot
): firestore.Query => {
  const limit = options.limit || 10;
  
  // Aplicar ordenação se especificada
  if (options.sortBy) {
    query = query.orderBy(options.sortBy, options.sortOrder || 'asc');
  }
  
  // Aplicar cursor se fornecido
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  
  // Aplicar limite
  return query.limit(limit);
};

/**
 * Decodifica um cursor de paginação
 * 
 * @param cursor - Cursor codificado em base64
 * @returns Valores decodificados do cursor
 */
export const decodeCursor = (cursor: string): any => {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    logger.error('Erro ao decodificar cursor de paginação:', error);
    throw new Error('Cursor de paginação inválido');
  }
};

/**
 * Codifica valores em um cursor de paginação
 * 
 * @param values - Valores a serem codificados
 * @returns Cursor codificado em base64
 */
export const encodeCursor = (values: any): string => {
  try {
    const encoded = JSON.stringify(values);
    return Buffer.from(encoded).toString('base64');
  } catch (error) {
    logger.error('Erro ao codificar cursor de paginação:', error);
    throw new Error('Não foi possível criar cursor de paginação');
  }
};

/**
 * Formata o resultado de uma consulta paginada
 * 
 * @param items - Itens da página atual
 * @param total - Total de itens
 * @param options - Opções de paginação usadas
 * @param nextCursor - Cursor para a próxima página (opcional)
 * @param prevCursor - Cursor para a página anterior (opcional)
 * @returns Resultado formatado com metadados de paginação
 */
export const formatPaginatedResult = <T>(
  items: T[],
  total: number,
  options: PaginationOptions,
  nextCursor?: string,
  prevCursor?: string
): PaginatedResult<T> => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const totalPages = Math.ceil(total / limit);
  
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextCursor,
      prevCursor
    }
  };
};

/**
 * Executa uma consulta paginada baseada em offset
 * 
 * @param collection - Nome da coleção
 * @param options - Opções de paginação
 * @param whereConditions - Condições de filtro (opcional)
 * @returns Resultado paginado
 */
export const getOffsetPaginatedResults = async <T>(
  collection: string,
  options: PaginationOptions,
  whereConditions?: Array<[string, firestore.WhereFilterOp, any]>
): Promise<PaginatedResult<T>> => {
  try {
    const db = firestore();
    let query: firestore.Query = db.collection(collection);
    
    // Aplicar condições where
    if (whereConditions && whereConditions.length > 0) {
      whereConditions.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    // Obter contagem total
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar paginação
    query = applyOffsetPagination(query, options);
    
    // Executar consulta
    const snapshot = await query.get();
    
    // Mapear resultados
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
    
    // Formatar resultado
    return formatPaginatedResult<T>(
      items,
      total,
      options
    );
  } catch (error) {
    logger.error(`Erro ao obter resultados paginados da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Executa uma consulta paginada baseada em cursor
 * 
 * @param collection - Nome da coleção
 * @param options - Opções de paginação
 * @param whereConditions - Condições de filtro (opcional)
 * @returns Resultado paginado
 */
export const getCursorPaginatedResults = async <T>(
  collection: string,
  options: PaginationOptions,
  whereConditions?: Array<[string, firestore.WhereFilterOp, any]>
): Promise<PaginatedResult<T>> => {
  try {
    const db = firestore();
    let query: firestore.Query = db.collection(collection);
    
    // Aplicar condições where
    if (whereConditions && whereConditions.length > 0) {
      whereConditions.forEach(([field, operator, value]) => {
        query = query.where(field, operator, value);
      });
    }
    
    // Obter contagem total
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Decodificar cursor se fornecido
    let lastDoc: firestore.DocumentSnapshot | undefined;
    let prevLastDoc: firestore.DocumentSnapshot | undefined;
    
    if (options.cursor) {
      const cursorData = decodeCursor(options.cursor);
      if (cursorData.docId) {
        const docRef = db.collection(collection).doc(cursorData.docId);
        const docSnapshot = await docRef.get();
        if (docSnapshot.exists) {
          lastDoc = docSnapshot;
        }
      }
      
      if (cursorData.prevDocId) {
        const docRef = db.collection(collection).doc(cursorData.prevDocId);
        const docSnapshot = await docRef.get();
        if (docSnapshot.exists) {
          prevLastDoc = docSnapshot;
        }
      }
    }
    
    // Aplicar paginação
    query = applyCursorPagination(query, options, lastDoc);
    
    // Executar consulta
    const snapshot = await query.get();
    
    // Mapear resultados
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
    
    // Criar cursores para navegação
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;
    
    if (snapshot.docs.length > 0) {
      const lastDocInPage = snapshot.docs[snapshot.docs.length - 1];
      const firstDocInPage = snapshot.docs[0];
      
      if (items.length === options.limit) {
        nextCursor = encodeCursor({
          docId: lastDocInPage.id,
          prevDocId: firstDocInPage.id
        });
      }
      
      if (lastDoc) {
        prevCursor = encodeCursor({
          docId: prevLastDoc ? prevLastDoc.id : undefined,
          prevDocId: undefined
        });
      }
    }
    
    // Formatar resultado
    return formatPaginatedResult<T>(
      items,
      total,
      options,
      nextCursor,
      prevCursor
    );
  } catch (error) {
    logger.error(`Erro ao obter resultados paginados com cursor da coleção ${collection}:`, error);
    throw error;
  }
};

/**
 * Aplica filtros complexos a uma consulta do Firestore
 * 
 * @param query - Consulta do Firestore
 * @param filters - Objeto com filtros
 * @returns Consulta com filtros aplicados
 */
export const applyFilters = (
  query: firestore.Query,
  filters: Record<string, any>
): firestore.Query => {
  // Filtrar campos vazios
  const validFilters = Object.entries(filters).filter(([_, value]) => 
    value !== undefined && value !== null && value !== ''
  );
  
  for (const [field, value] of validFilters) {
    // Tratar arrays para operador array-contains ou array-contains-any
    if (Array.isArray(value)) {
      if (value.length === 1) {
        query = query.where(field, 'array-contains', value[0]);
      } else if (value.length > 1) {
        query = query.where(field, 'array-contains-any', value.slice(0, 10)); // Limite de 10 valores
      }
    }
    // Tratar objetos para operações especiais
    else if (typeof value === 'object') {
      if (value.operator && value.value !== undefined) {
        query = query.where(field, value.operator as firestore.WhereFilterOp, value.value);
      }
    }
    // Tratar valores simples para igualdade
    else {
      query = query.where(field, '==', value);
    }
  }
  
  return query;
};

export default {
  applyOffsetPagination,
  applyCursorPagination,
  decodeCursor,
  encodeCursor,
  formatPaginatedResult,
  getOffsetPaginatedResults,
  getCursorPaginatedResults,
  applyFilters
};