import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp, DocumentSnapshot } from "firebase-admin/firestore";
import * as crypto from 'crypto';

// Definição de tipos para tokens de verificação de email
export interface FirebaseEmailVerificationToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  type: "verification" | "password_reset" | "email_change" | "invitation";
  expiresAt: Timestamp;
  usedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: Record<string, any> | null;
}

const EMAIL_VERIFICATION_TOKENS_COLLECTION = "emailVerificationTokens";

/**
 * Cria um novo token de verificação de email.
 */
export const createEmailVerificationToken = async (
  userId: string,
  email: string,
  type: FirebaseEmailVerificationToken["type"],
  options?: {
    expiresInMinutes?: number;
    metadata?: Record<string, any>;
  }
): Promise<FirebaseEmailVerificationToken> => {
  try {
    const now = Timestamp.now();
    
    // Gerar token aleatório
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calcular data de expiração (padrão: 24 horas)
    const expiresInMinutes = options?.expiresInMinutes || 24 * 60;
    
    // Garantir que expiresInMinutes seja um número inteiro para evitar erros
    const expiresInSeconds = Math.floor(expiresInMinutes * 60);
    
    const expiresAt = new Timestamp(
      now.seconds + expiresInSeconds,
      now.nanoseconds
    );
    
    const tokenData: Omit<FirebaseEmailVerificationToken, "id"> = {
      userId,
      email,
      token,
      type,
      expiresAt,
      usedAt: null,
      createdAt: now,
      updatedAt: now,
      metadata: options?.metadata || null
    };
    
    const docRef = await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).add(tokenData);
    
    return {
      id: docRef.id,
      ...tokenData
    };
  } catch (error) {
    console.error(`Erro ao criar token de verificação de email:`, error);
    throw error;
  }
};

/**
 * Busca um token de verificação de email pelo ID.
 */
export const getEmailVerificationTokenById = async (
  id: string
): Promise<FirebaseEmailVerificationToken | null> => {
  try {
    const doc = await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    } as FirebaseEmailVerificationToken;
  } catch (error) {
    console.error(`Erro ao buscar token de verificação de email ${id}:`, error);
    throw error;
  }
};

/**
 * Busca um token de verificação de email pelo valor do token.
 */
export const getEmailVerificationTokenByValue = async (
  token: string
): Promise<FirebaseEmailVerificationToken | null> => {
  try {
    const snapshot = await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION)
      .where("token", "==", token)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as FirebaseEmailVerificationToken;
  } catch (error) {
    console.error(`Erro ao buscar token de verificação de email pelo valor:`, error);
    throw error;
  }
};

/**
 * Busca tokens ativos para um usuário e tipo específicos.
 */
export const getActiveTokensByUserIdAndType = async (
  userId: string,
  type: FirebaseEmailVerificationToken["type"]
): Promise<FirebaseEmailVerificationToken[]> => {
  try {
    const now = Timestamp.now();
    
    // Devido a limitações de índices no Firestore, vamos fazer a consulta em duas etapas
    // Primeiro, buscamos por userId e type
    const snapshot = await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION)
      .where("userId", "==", userId)
      .where("type", "==", type)
      .get();
    
    const tokens: FirebaseEmailVerificationToken[] = [];
    
    // Depois, filtramos manualmente os resultados para tokens ativos
    snapshot.forEach((doc: DocumentSnapshot) => {
      const data = doc.data() as Omit<FirebaseEmailVerificationToken, "id">;
      
      // Verificar se o token está ativo (não expirado e não usado)
      if (
        data.expiresAt.toMillis() > now.toMillis() && 
        data.usedAt === null
      ) {
        tokens.push({
          id: doc.id,
          ...data
        } as FirebaseEmailVerificationToken);
      }
    });
    
    return tokens;
  } catch (error) {
    console.error(`Erro ao buscar tokens ativos para o usuário ${userId} e tipo ${type}:`, error);
    // Em caso de erro de índice, retornamos um array vazio em vez de propagar o erro
    if (error instanceof Error && error.message.includes('FAILED_PRECONDITION')) {
      console.warn('Erro de índice do Firestore. Retornando array vazio.');
      return [];
    }
    throw error;
  }
};

/**
 * Busca tokens de verificação de email com opções de filtro.
 */
export const getEmailVerificationTokens = async (
  options: {
    userId?: string;
    email?: string;
    type?: FirebaseEmailVerificationToken["type"];
    isActive?: boolean;
    isExpired?: boolean;
    isUsed?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ tokens: FirebaseEmailVerificationToken[]; total: number }> => {
  try {
    let query: any = db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION);
    
    // Aplicar filtros básicos
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.email) {
      query = query.where("email", "==", options.email);
    }
    
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    // Obter todos os documentos e filtrar manualmente para evitar erros de índice
    const snapshot = await query.get();
    
    const now = Timestamp.now();
    let tokens: FirebaseEmailVerificationToken[] = [];
    
    snapshot.forEach((doc: DocumentSnapshot) => {
      const data = doc.data() as Omit<FirebaseEmailVerificationToken, "id">;
      const token = {
        id: doc.id,
        ...data
      } as FirebaseEmailVerificationToken;
      
      // Aplicar filtros manuais
      let includeToken = true;
      
      if (options.isActive && (
        data.expiresAt.toMillis() <= now.toMillis() || 
        data.usedAt !== null
      )) {
        includeToken = false;
      }
      
      if (options.isExpired && data.expiresAt.toMillis() > now.toMillis()) {
        includeToken = false;
      }
      
      if (options.isUsed && data.usedAt === null) {
        includeToken = false;
      }
      
      if (includeToken) {
        tokens.push(token);
      }
    });
    
    // Ordenar manualmente por createdAt (decrescente)
    tokens.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    
    const total = tokens.length;
    
    // Aplicar paginação manualmente
    if (options.offset) {
      tokens = tokens.slice(options.offset);
    }
    
    if (options.limit) {
      tokens = tokens.slice(0, options.limit);
    }
    
    return { tokens, total };
  } catch (error) {
    console.error(`Erro ao buscar tokens de verificação de email:`, error);
    // Em caso de erro de índice, retornamos um resultado vazio em vez de propagar o erro
    if (error instanceof Error && error.message.includes('FAILED_PRECONDITION')) {
      console.warn('Erro de índice do Firestore. Retornando resultado vazio.');
      return { tokens: [], total: 0 };
    }
    throw error;
  }
};

/**
 * Verifica e usa um token de verificação de email.
 * Retorna o token se for válido, null caso contrário.
 */
export const verifyAndUseEmailVerificationToken = async (
  token: string
): Promise<FirebaseEmailVerificationToken | null> => {
  try {
    // Buscar o token
    const tokenDoc = await getEmailVerificationTokenByValue(token);
    
    if (!tokenDoc) {
      return null; // Token não encontrado
    }
    
    const now = Timestamp.now();
    
    // Verificar se o token está expirado
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      return null; // Token expirado
    }
    
    // Verificar se o token já foi usado
    if (tokenDoc.usedAt) {
      return null; // Token já usado
    }
    
    // Marcar o token como usado
    await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION)
      .doc(tokenDoc.id)
      .update({
        usedAt: now,
        updatedAt: now
      });
    
    // Retornar o token atualizado
    return {
      ...tokenDoc,
      usedAt: now,
      updatedAt: now
    };
  } catch (error) {
    console.error(`Erro ao verificar e usar token de verificação de email:`, error);
    throw error;
  }
};

/**
 * Invalida todos os tokens ativos de um usuário para um tipo específico.
 */
export const invalidateAllUserTokens = async (
  userId: string,
  type: FirebaseEmailVerificationToken["type"]
): Promise<number> => {
  try {
    // Buscar tokens ativos
    const tokens = await getActiveTokensByUserIdAndType(userId, type);
    
    if (tokens.length === 0) {
      return 0;
    }
    
    const now = Timestamp.now();
    const batch = db.batch();
    
    // Marcar todos como expirados
    tokens.forEach(token => {
      const docRef = db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).doc(token.id);
      batch.update(docRef, {
        expiresAt: now, // Expirar imediatamente
        updatedAt: now
      });
    });
    
    await batch.commit();
    
    return tokens.length;
  } catch (error) {
    console.error(`Erro ao invalidar tokens ativos para o usuário ${userId} e tipo ${type}:`, error);
    // Em caso de erro de índice, retornamos 0 em vez de propagar o erro
    if (error instanceof Error && error.message.includes('FAILED_PRECONDITION')) {
      console.warn('Erro de índice do Firestore. Retornando 0.');
      return 0;
    }
    throw error;
  }
};

/**
 * Exclui um token de verificação de email pelo ID.
 */
export const deleteEmailVerificationToken = async (
  id: string
): Promise<boolean> => {
  try {
    await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).doc(id).delete();
    return true;
  } catch (error) {
    console.error(`Erro ao excluir token de verificação de email ${id}:`, error);
    throw error;
  }
};

/**
 * Exclui tokens expirados ou usados mais antigos que o número de dias especificado.
 */
export const cleanupExpiredEmailVerificationTokens = async (
  olderThanDays: number = 30
): Promise<number> => {
  try {
    const now = Timestamp.now();
    const cutoffDate = new Timestamp(
      now.seconds - Math.floor(olderThanDays * 24 * 60 * 60),
      now.nanoseconds
    );
    
    // Buscar todos os tokens e filtrar manualmente para evitar erros de índice
    const snapshot = await db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    const batch = db.batch();
    const tokensToDelete: string[] = [];
    
    snapshot.forEach((doc: DocumentSnapshot) => {
      const data = doc.data();
      if (!data) return;
      
      const createdAt = data.createdAt as Timestamp;
      const expiresAt = data.expiresAt as Timestamp;
      
      // Verificar se o token é antigo e está expirado
      if (createdAt.toMillis() < cutoffDate.toMillis() && expiresAt.toMillis() < now.toMillis()) {
        tokensToDelete.push(doc.id);
        batch.delete(db.collection(EMAIL_VERIFICATION_TOKENS_COLLECTION).doc(doc.id));
      }
    });
    
    if (tokensToDelete.length > 0) {
      await batch.commit();
    }
    
    return tokensToDelete.length;
  } catch (error) {
    console.error(`Erro ao limpar tokens antigos:`, error);
    // Em caso de erro de índice, retornamos 0 em vez de propagar o erro
    if (error instanceof Error && error.message.includes('FAILED_PRECONDITION')) {
      console.warn('Erro de índice do Firestore. Retornando 0.');
      return 0;
    }
    throw error;
  }
};