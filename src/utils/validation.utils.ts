import { Request } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { AppError } from './errors';

/**
 * Verifica se uma string é um UUID válido
 * 
 * @param {string} str - String a ser validada
 * @returns {boolean} - True se for um UUID válido
 */
export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Verifica se uma string é um email válido
 * 
 * @param {string} str - String a ser validada
 * @returns {boolean} - True se for um email válido
 */
export const isEmail = (str: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(str);
};

/**
 * Verifica se uma string é uma URL válida
 * 
 * @param {string} str - String a ser validada
 * @returns {boolean} - True se for uma URL válida
 */
export const isURL = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Verifica se uma string é uma data válida no formato ISO
 * 
 * @param {string} str - String a ser validada
 * @returns {boolean} - True se for uma data válida
 */
export const isISODate = (str: string): boolean => {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!isoDateRegex.test(str)) {
    return false;
  }
  
  const date = new Date(str);
  return !isNaN(date.getTime());
};

/**
 * Verifica se um valor é um número inteiro
 * 
 * @param {any} value - Valor a ser validado
 * @returns {boolean} - True se for um número inteiro
 */
export const isInteger = (value: any): boolean => {
  return Number.isInteger(Number(value));
};

/**
 * Verifica se um valor é um número
 * 
 * @param {any} value - Valor a ser validado
 * @returns {boolean} - True se for um número
 */
export const isNumber = (value: any): boolean => {
  return !isNaN(Number(value));
};

/**
 * Verifica se um valor está dentro de um intervalo
 * 
 * @param {number} value - Valor a ser validado
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean} - True se estiver dentro do intervalo
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Verifica se um valor está em um conjunto de valores permitidos
 * 
 * @param {any} value - Valor a ser validado
 * @param {any[]} allowedValues - Valores permitidos
 * @returns {boolean} - True se estiver no conjunto
 */
export const isInEnum = (value: any, allowedValues: any[]): boolean => {
  return allowedValues.includes(value);
};

/**
 * Sanitiza uma string removendo caracteres especiais
 * 
 * @param {string} str - String a ser sanitizada
 * @returns {string} - String sanitizada
 */
export const sanitizeString = (str: string): string => {
  return str.replace(/[^\w\s.-]/g, '');
};

/**
 * Sanitiza um nome de arquivo
 * 
 * @param {string} filename - Nome do arquivo a ser sanitizado
 * @returns {string} - Nome do arquivo sanitizado
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^\w\s.-]/g, '_');
};

/**
 * Sanitiza HTML removendo tags
 * 
 * @param {string} html - HTML a ser sanitizado
 * @returns {string} - Texto sem tags HTML
 */
export const sanitizeHTML = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Sanitiza uma consulta SQL
 * 
 * @param {string} query - Consulta a ser sanitizada
 * @returns {string} - Consulta sanitizada
 */
export const sanitizeSQL = (query: string): string => {
  return query.replace(/['";\\]/g, '');
};

/**
 * Valida um objeto com base em um esquema
 * 
 * @param {any} obj - Objeto a ser validado
 * @param {Record<string, (value: any) => boolean>} schema - Esquema de validação
 * @returns {string[]} - Array de erros (vazio se válido)
 */
export const validateObject = (
  obj: any,
  schema: Record<string, (value: any) => boolean>
): string[] => {
  const errors: string[] = [];
  
  for (const [field, validator] of Object.entries(schema)) {
    if (obj[field] !== undefined && !validator(obj[field])) {
      errors.push(`Campo '${field}' inválido`);
    }
  }
  
  return errors;
};

/**
 * Valida os resultados de express-validator e lança erro se inválido
 * 
 * @param {Request} req - Objeto de requisição
 * @throws {AppError} - Erro com detalhes de validação
 */
export const validateRequest = (req: Request): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Erro de validação', 400, errors.array());
  }
};

/**
 * Middleware para validar requisições com express-validator
 * 
 * @param {ValidationChain[]} validations - Validações a serem aplicadas
 * @returns {Function} - Middleware de validação
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: any, next: any) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    res.status(400).json({
      success: false,
      errors: errors.array()
    });
  };
};

/**
 * Formata mensagens de erro de validação
 * 
 * @param {any[]} errors - Erros de validação
 * @returns {Record<string, string>} - Objeto com campos e mensagens
 */
export const formatValidationErrors = (errors: any[]): Record<string, string> => {
  const formatted: Record<string, string> = {};
  
  errors.forEach(error => {
    formatted[error.param] = error.msg;
  });
  
  return formatted;
};

export default {
  isUUID,
  isEmail,
  isURL,
  isISODate,
  isInteger,
  isNumber,
  isInRange,
  isInEnum,
  sanitizeString,
  sanitizeFilename,
  sanitizeHTML,
  sanitizeSQL,
  validateObject,
  validateRequest,
  validate,
  formatValidationErrors
};