import { Router } from 'express';
import mediaController from '../../controllers/media/mediaController';
import { validate } from '../../middlewares/validation.middleware';
import mediaValidator from '../../validators/media.validator';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload.middleware';

const router = Router();

/**
 * @route POST /api/media/upload
 * @desc Faz upload de um arquivo
 * @access Private
 */
router.post('/upload', 
  authenticate, 
  upload.single('file'),
  validate(mediaValidator.uploadFile), 
  mediaController.uploadFile
);

/**
 * @route GET /api/media/:fileId
 * @desc Obtém um arquivo pelo ID
 * @access Public/Private (depende se o arquivo é público)
 */
router.get('/:fileId', 
  optionalAuthenticate,
  validate(mediaValidator.getFileById), 
  mediaController.getFileById
);

/**
 * @route GET /api/media/:fileId/download
 * @desc Faz download de um arquivo
 * @access Public/Private (depende se o arquivo é público)
 */
router.get('/:fileId/download', 
  optionalAuthenticate,
  validate(mediaValidator.downloadFile), 
  mediaController.downloadFile
);

/**
 * @route DELETE /api/media/:fileId
 * @desc Exclui um arquivo
 * @access Private (proprietário ou admin)
 */
router.delete('/:fileId', 
  authenticate, 
  validate(mediaValidator.deleteFile), 
  mediaController.deleteFile
);

/**
 * @route PUT /api/media/:fileId/metadata
 * @desc Atualiza metadados de um arquivo
 * @access Private (proprietário ou admin)
 */
router.put('/:fileId/metadata', 
  authenticate, 
  validate(mediaValidator.updateFileMetadata), 
  mediaController.updateFileMetadata
);

/**
 * @route GET /api/media/user/files
 * @desc Lista arquivos do usuário
 * @access Private
 */
router.get('/user/files', 
  authenticate, 
  validate(mediaValidator.getUserFiles), 
  mediaController.getUserFiles
);

/**
 * @route GET /api/media/user/folders
 * @desc Lista pastas do usuário
 * @access Private
 */
router.get('/user/folders', 
  authenticate, 
  mediaController.getUserFolders
);

/**
 * @route POST /api/media/folders
 * @desc Cria uma nova pasta
 * @access Private
 */
router.post('/folders', 
  authenticate, 
  validate(mediaValidator.createFolder), 
  mediaController.createFolder
);

/**
 * @route DELETE /api/media/folders/:folderId
 * @desc Exclui uma pasta
 * @access Private (proprietário ou admin)
 */
router.delete('/folders/:folderId', 
  authenticate, 
  validate(mediaValidator.deleteFolder), 
  mediaController.deleteFolder
);

export default router;