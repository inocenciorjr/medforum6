import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { AppError } from '../utils/errors';
import { firebaseMediaService } from '../services/firebaseMediaService';
import { logger } from './logger.middleware';

// Define allowed file types and field names
const allowedPdfTypes = ['.pdf'];
const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif'];
const allowedDocTypes = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
const allowedFieldNames = ['file', 'image', 'document', 'profileImage', 'proofPdf', 'answerKeyPdf'];

// Define storage location and filename strategy
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.resolve(process.cwd(), 'tmp/uploads');
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      logger.error('Failed to create upload directory:', { path: uploadPath, error });
      // Pass the error to Multer's callback
      cb(error instanceof Error ? error : new Error("Failed to create upload directory"), '');
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Define file filter function with field name validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const fieldName = file.fieldname;
  
  // Determine allowed types based on field name or request path
  let allowedTypes: string[] = [];
  
  if (fieldName === 'profileImage' || req.path.includes('/profile') || req.path.includes('/avatar')) {
    allowedTypes = allowedImageTypes;
  } else if (fieldName === 'proofPdf' || fieldName === 'answerKeyPdf' || req.path.includes('/pdf')) {
    allowedTypes = allowedPdfTypes;
  } else if (fieldName === 'document' || req.path.includes('/document')) {
    allowedTypes = [...allowedPdfTypes, ...allowedDocTypes];
  } else {
    // Default: allow all supported types
    allowedTypes = [...allowedPdfTypes, ...allowedImageTypes, ...allowedDocTypes];
  }

  if (allowedTypes.includes(ext) && allowedFieldNames.includes(fieldName)) {
    // Accept file
    cb(null, true);
  } else {
    let errorMessage = 'Invalid upload attempt.';
    if (!allowedTypes.includes(ext)) {
      errorMessage = `Invalid file type. Only ${allowedTypes.join(', ')} are allowed for this field.`;
    } else if (!allowedFieldNames.includes(fieldName)) {
      errorMessage = `Invalid upload field name. Only ${allowedFieldNames.join(', ')} are allowed.`;
    }
    // Reject file
    cb(new AppError(errorMessage, 400));
  }
};

// Configure Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

/**
 * Middleware para fazer upload de arquivos para o Firebase Storage
 * após o upload local com Multer
 */
export const uploadToFirebase = (fieldName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Verificar se há arquivo para upload
    if (!req.file) {
      return next();
    }

    try {
      // Fazer upload do arquivo para o Firebase Storage
      const file = req.file;
      const userId = req.user?.id || 'anonymous';
      const folder = fieldName === 'profileImage' ? 'profile-images' : 
                    fieldName === 'proofPdf' ? 'proof-pdfs' : 
                    fieldName === 'answerKeyPdf' ? 'answer-keys' : 'uploads';
      
      const uploadResult = await firebaseMediaService.uploadFile({
        filePath: file.path,
        fileName: file.filename,
        mimeType: file.mimetype,
        folder: `${folder}/${userId}`,
        metadata: {
          originalName: file.originalname,
          size: file.size,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      });

      // Adicionar URL do arquivo ao objeto req para uso posterior
      req.firebaseFile = {
        url: uploadResult.url,
        path: uploadResult.path,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      };

      // Remover arquivo local após upload para o Firebase
      fs.unlink(file.path, (err) => {
        if (err) {
          logger.warn('Failed to delete local file after Firebase upload:', { path: file.path, error: err });
        }
      });

      next();
    } catch (error) {
      logger.error('Failed to upload file to Firebase:', { error });
      return res.status(500).json({
        success: false,
        message: 'Falha ao fazer upload do arquivo para o servidor'
      });
    }
  };
};

// Adicionar tipo para o arquivo do Firebase
declare global {
  namespace Express {
    interface Request {
      firebaseFile?: {
        url: string;
        path: string;
        filename: string;
        originalname: string;
        mimetype: string;
        size: number;
      };
    }
  }
}

export default upload;