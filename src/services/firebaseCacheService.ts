import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para cache
export interface FirebaseCacheEntry {
  id: string;
  key: string;
  value: any;
  ttl: number; // Tempo de vida em segundos
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const CACHE_COLLECTION = "cache";

/**
 * Define um valor no cache.
 */
export const setCacheValue = async <T>(
  key: string,
  value: T,
  ttl: number = 3600 // Padrão: 1 hora
): Promise<FirebaseCacheEntry> => {
  try {
    // Verificar se já existe uma entrada com a mesma chave
    const existingEntry = await getCacheEntryByKey(key);
    
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(new Date(now.toMillis() + ttl * 1000));
    
    if (existingEntry) {
      // Atualizar entrada existente
      const entryRef = db.collection(CACHE_COLLECTION).doc(existingEntry.id);
      
      const updatedEntry: FirebaseCacheEntry = {
        ...existingEntry,
        value,
        ttl,
        expiresAt,
        updatedAt: now
      };
      
      await entryRef.update(updatedEntry);
      console.log(`Entrada de cache (Chave: ${key}) atualizada com sucesso.`);
      
      return updatedEntry;
    } else {
      // Criar nova entrada
      const entryRef = db.collection(CACHE_COLLECTION).doc();
      
      const newEntry: FirebaseCacheEntry = {
        id: entryRef.id,
        key,
        value,
        ttl,
        expiresAt,
        createdAt: now,
        updatedAt: now
      };
      
      await entryRef.set(newEntry);
      console.log(`Entrada de cache (Chave: ${key}) criada com sucesso.`);
      
      return newEntry;
    }
  } catch (error) {
    console.error(`Erro ao definir valor no cache (Chave: ${key}):`, error);
    throw error;
  }
};

/**
 * Busca uma entrada de cache pela chave.
 */
const getCacheEntryByKey = async (key: string): Promise<FirebaseCacheEntry | null> => {
  try {
    const snapshot = await db.collection(CACHE_COLLECTION)
      .where("key", "==", key)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseCacheEntry;
  } catch (error) {
    console.error(`Erro ao buscar entrada de cache pela chave '${key}':`, error);
    throw error;
  }
};

/**
 * Obtém um valor do cache.
 * Retorna null se a chave não existir ou estiver expirada.
 */
export const getCacheValue = async <T>(key: string): Promise<T | null> => {
  try {
    const entry = await getCacheEntryByKey(key);
    
    if (!entry) {
      return null;
    }
    
    // Verificar se a entrada expirou
    const now = Timestamp.now();
    if (entry.expiresAt.toMillis() < now.toMillis()) {
      console.log(`Entrada de cache (Chave: ${key}) expirada.`);
      
      // Excluir a entrada expirada em background
      deleteCacheEntry(entry.id).catch(error => {
        console.error(`Erro ao excluir entrada de cache expirada (ID: ${entry.id}):`, error);
      });
      
      return null;
    }
    
    return entry.value as T;
  } catch (error) {
    console.error(`Erro ao obter valor do cache (Chave: ${key}):`, error);
    return null;
  }
};

/**
 * Exclui uma entrada de cache.
 */
export const deleteCacheEntry = async (entryId: string): Promise<void> => {
  const entryRef = db.collection(CACHE_COLLECTION).doc(entryId);
  try {
    await entryRef.delete();
    console.log(`Entrada de cache (ID: ${entryId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir entrada de cache (ID: ${entryId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma entrada de cache pela chave.
 */
export const deleteCacheByKey = async (key: string): Promise<void> => {
  try {
    const entry = await getCacheEntryByKey(key);
    
    if (entry) {
      await deleteCacheEntry(entry.id);
      console.log(`Entrada de cache (Chave: ${key}) excluída com sucesso.`);
    } else {
      console.warn(`Entrada de cache (Chave: ${key}) não encontrada para exclusão.`);
    }
  } catch (error) {
    console.error(`Erro ao excluir entrada de cache pela chave '${key}':`, error);
    throw error;
  }
};

/**
 * Limpa todas as entradas de cache expiradas.
 * Esta função deve ser executada periodicamente.
 */
export const cleanupExpiredCache = async (): Promise<number> => {
  try {
    const now = Timestamp.now();
    
    const snapshot = await db.collection(CACHE_COLLECTION)
      .where("expiresAt", "<", now)
      .get();
    
    if (snapshot.empty) {
      console.log("Nenhuma entrada de cache expirada encontrada.");
      return 0;
    }
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`${snapshot.size} entradas de cache expiradas excluídas.`);
    
    return snapshot.size;
  } catch (error) {
    console.error("Erro ao limpar entradas de cache expiradas:", error);
    throw error;
  }
};

/**
 * Limpa todo o cache.
 */
export const clearAllCache = async (): Promise<number> => {
  try {
    const snapshot = await db.collection(CACHE_COLLECTION).get();
    
    if (snapshot.empty) {
      console.log("Cache já está vazio.");
      return 0;
    }
    
    // Excluir em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    const totalEntries = snapshot.size;
    let processedEntries = 0;
    
    while (processedEntries < totalEntries) {
      const batch = db.batch();
      const currentBatch = snapshot.docs.slice(processedEntries, processedEntries + batchSize);
      
      currentBatch.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      processedEntries += currentBatch.length;
    }
    
    console.log(`${totalEntries} entradas de cache excluídas.`);
    return totalEntries;
  } catch (error) {
    console.error("Erro ao limpar todo o cache:", error);
    throw error;
  }
};

/**
 * Função de cache para resultados de funções.
 * Retorna o resultado em cache se disponível, ou executa a função e armazena o resultado.
 */
export const cachedResult = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 3600
): Promise<T> => {
  try {
    // Tentar obter do cache
    const cachedValue = await getCacheValue<T>(key);
    
    if (cachedValue !== null) {
      console.log(`Valor obtido do cache (Chave: ${key}).`);
      return cachedValue;
    }
    
    // Executar a função
    console.log(`Valor não encontrado no cache (Chave: ${key}). Executando função.`);
    const result = await fn();
    
    // Armazenar no cache
    await setCacheValue(key, result, ttl);
    
    return result;
  } catch (error) {
    console.error(`Erro ao obter resultado em cache (Chave: ${key}):`, error);
    throw error;
  }
};