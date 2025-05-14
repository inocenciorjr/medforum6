import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { firestore } from 'firebase-admin';
import logger from './logger';

/**
 * Gera um hash seguro para uma senha
 * 
 * @param {string} password - Senha a ser hasheada
 * @param {string} [salt] - Salt opcional (gerado se não fornecido)
 * @returns {Object} - Objeto contendo hash e salt
 */
export const hashPassword = (password: string, salt?: string): { hash: string; salt: string } => {
  // Gerar salt se não fornecido
  const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
  
  // Gerar hash
  const hash = crypto.pbkdf2Sync(
    password,
    passwordSalt,
    10000, // Número de iterações
    64,    // Comprimento da chave
    'sha512'
  ).toString('hex');
  
  return { hash, salt: passwordSalt };
};

/**
 * Verifica se uma senha corresponde a um hash
 * 
 * @param {string} password - Senha a ser verificada
 * @param {string} hash - Hash armazenado
 * @param {string} salt - Salt usado para gerar o hash
 * @returns {boolean} - True se a senha corresponder ao hash
 */
export const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  const passwordHash = hashPassword(password, salt);
  return passwordHash.hash === hash;
};

/**
 * Gera um token JWT
 * 
 * @param {Object} payload - Dados a serem incluídos no token
 * @param {string} secret - Segredo para assinar o token
 * @param {Object} [options] - Opções do token (expiração, etc.)
 * @returns {string} - Token JWT
 */
export const generateToken = (
  payload: Record<string, any>,
  secret: string,
  options?: jwt.SignOptions
): string => {
  return jwt.sign(payload, secret, options);
};

/**
 * Verifica e decodifica um token JWT
 * 
 * @param {string} token - Token a ser verificado
 * @param {string} secret - Segredo usado para assinar o token
 * @returns {Object|null} - Payload decodificado ou null se inválido
 */
export const verifyToken = (token: string, secret: string): Record<string, any> | null => {
  try {
    return jwt.verify(token, secret) as Record<string, any>;
  } catch (error) {
    logger.error('Erro ao verificar token JWT:', error);
    return null;
  }
};

/**
 * Extrai o token de autorização do cabeçalho da requisição
 * 
 * @param {Request} req - Objeto de requisição
 * @returns {string|null} - Token ou null se não encontrado
 */
export const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remover 'Bearer '
};

/**
 * Gera um ID aleatório seguro
 * 
 * @param {number} [length=16] - Comprimento do ID
 * @returns {string} - ID aleatório
 */
export const generateSecureId = (length: number = 16): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Criptografa dados sensíveis
 * 
 * @param {string} data - Dados a serem criptografados
 * @param {string} key - Chave de criptografia
 * @returns {string} - Dados criptografados
 */
export const encryptData = (data: string, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Descriptografa dados sensíveis
 * 
 * @param {string} encryptedData - Dados criptografados
 * @param {string} key - Chave de criptografia
 * @returns {string} - Dados descriptografados
 */
export const decryptData = (encryptedData: string, key: string): string => {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Registra uma tentativa de login
 * 
 * @param {string} userId - ID do usuário
 * @param {boolean} success - Se a tentativa foi bem-sucedida
 * @param {string} ipAddress - Endereço IP
 * @returns {Promise<void>}
 */
export const logLoginAttempt = async (
  userId: string,
  success: boolean,
  ipAddress: string
): Promise<void> => {
  try {
    const db = firestore();
    
    await db.collection('loginAttempts').add({
      userId,
      success,
      ipAddress,
      timestamp: firestore.FieldValue.serverTimestamp(),
      userAgent: 'API'
    });
    
    // Atualizar último login se bem-sucedido
    if (success) {
      await db.collection('users').doc(userId).update({
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
        lastLoginIp: ipAddress
      });
    }
  } catch (error) {
    logger.error(`Erro ao registrar tentativa de login para usuário ${userId}:`, error);
  }
};

/**
 * Verifica se um usuário está bloqueado por excesso de tentativas de login
 * 
 * @param {string} userId - ID do usuário
 * @param {number} maxAttempts - Número máximo de tentativas
 * @param {number} lockoutMinutes - Duração do bloqueio em minutos
 * @returns {Promise<boolean>} - True se o usuário estiver bloqueado
 */
export const isUserLockedOut = async (
  userId: string,
  maxAttempts: number = 5,
  lockoutMinutes: number = 30
): Promise<boolean> => {
  try {
    const db = firestore();
    const lockoutThreshold = new Date();
    lockoutThreshold.setMinutes(lockoutThreshold.getMinutes() - lockoutMinutes);
    
    const attemptsSnapshot = await db.collection('loginAttempts')
      .where('userId', '==', userId)
      .where('success', '==', false)
      .where('timestamp', '>=', firestore.Timestamp.fromDate(lockoutThreshold))
      .get();
    
    return attemptsSnapshot.size >= maxAttempts;
  } catch (error) {
    logger.error(`Erro ao verificar bloqueio para usuário ${userId}:`, error);
    return false;
  }
};

/**
 * Verifica se um IP está bloqueado por excesso de tentativas de login
 * 
 * @param {string} ipAddress - Endereço IP
 * @param {number} maxAttempts - Número máximo de tentativas
 * @param {number} lockoutMinutes - Duração do bloqueio em minutos
 * @returns {Promise<boolean>} - True se o IP estiver bloqueado
 */
export const isIpLockedOut = async (
  ipAddress: string,
  maxAttempts: number = 10,
  lockoutMinutes: number = 30
): Promise<boolean> => {
  try {
    const db = firestore();
    const lockoutThreshold = new Date();
    lockoutThreshold.setMinutes(lockoutThreshold.getMinutes() - lockoutMinutes);
    
    const attemptsSnapshot = await db.collection('loginAttempts')
      .where('ipAddress', '==', ipAddress)
      .where('success', '==', false)
      .where('timestamp', '>=', firestore.Timestamp.fromDate(lockoutThreshold))
      .get();
    
    return attemptsSnapshot.size >= maxAttempts;
  } catch (error) {
    logger.error(`Erro ao verificar bloqueio para IP ${ipAddress}:`, error);
    return false;
  }
};

/**
 * Registra um evento de segurança
 * 
 * @param {string} eventType - Tipo de evento
 * @param {string} userId - ID do usuário (opcional)
 * @param {Object} details - Detalhes do evento
 * @returns {Promise<void>}
 */
export const logSecurityEvent = async (
  eventType: string,
  userId: string | null,
  details: Record<string, any>
): Promise<void> => {
  try {
    const db = firestore();
    
    await db.collection('securityEvents').add({
      eventType,
      userId,
      details,
      timestamp: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`Erro ao registrar evento de segurança ${eventType}:`, error);
  }
};

/**
 * Sanitiza dados de entrada para prevenir injeção
 * 
 * @param {any} input - Dados a serem sanitizados
 * @returns {any} - Dados sanitizados
 */
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remover caracteres potencialmente perigosos
    return input.replace(/[<>'"\\]/g, '');
  } else if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  } else if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  generateSecureId,
  encryptData,
  decryptData,
  logLoginAttempt,
  isUserLockedOut,
  isIpLockedOut,
  logSecurityEvent,
  sanitizeInput
};