import { body, param, query } from 'express-validator';

// Validation rules for uploading a file
export const uploadFile = [
  body('folder')
    .optional()
    .isString().withMessage('A pasta deve ser uma string.')
    .isLength({ max: 100 }).withMessage('O nome da pasta não pode exceder 100 caracteres.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('isPublic')
    .optional()
    .isBoolean().withMessage('O campo isPublic deve ser um booleano.')
];

// Validation rules for getting a file by ID
export const getFileById = [
  param('fileId')
    .isString().withMessage('ID do arquivo inválido.')
];

// Validation rules for downloading a file
export const downloadFile = [
  param('fileId')
    .isString().withMessage('ID do arquivo inválido.')
];

// Validation rules for deleting a file
export const deleteFile = [
  param('fileId')
    .isString().withMessage('ID do arquivo inválido.')
];

// Validation rules for updating file metadata
export const updateFileMetadata = [
  param('fileId')
    .isString().withMessage('ID do arquivo inválido.'),
  body('description')
    .optional()
    .isString().withMessage('A descrição deve ser uma string.')
    .isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres.'),
  body('folder')
    .optional()
    .isString().withMessage('A pasta deve ser uma string.')
    .isLength({ max: 100 }).withMessage('O nome da pasta não pode exceder 100 caracteres.'),
  body('isPublic')
    .optional()
    .isBoolean().withMessage('O campo isPublic deve ser um booleano.')
];

// Validation rules for getting user files
export const getUserFiles = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.'),
  query('folder')
    .optional()
    .isString().withMessage('A pasta deve ser uma string.'),
  query('type')
    .optional()
    .isIn(['image', 'document', 'audio', 'video', 'other'])
    .withMessage('Tipo inválido. Use "image", "document", "audio", "video" ou "other".')
];

// Validation rules for creating a folder
export const createFolder = [
  body('name')
    .notEmpty().withMessage('O nome da pasta é obrigatório.')
    .isString().withMessage('O nome da pasta deve ser uma string.')
    .isLength({ min: 1, max: 100 }).withMessage('O nome da pasta deve ter entre 1 e 100 caracteres.')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('O nome da pasta deve conter apenas letras, números, espaços, hífens e sublinhados.'),
  body('parentFolder')
    .optional()
    .isString().withMessage('O ID da pasta pai deve ser uma string.')
];

// Validation rules for deleting a folder
export const deleteFolder = [
  param('folderId')
    .isString().withMessage('ID da pasta inválido.')
];

// Export all validators
export default {
  uploadFile,
  getFileById,
  downloadFile,
  deleteFile,
  updateFileMetadata,
  getUserFiles,
  createFolder,
  deleteFolder
};