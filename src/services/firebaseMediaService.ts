import { firestore as db } from "../config/firebaseAdmin";
import { storage } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para mídia
export enum FirebaseMediaType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  DOCUMENT = "document",
  OTHER = "other"
}

export enum FirebaseMediaStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  ACTIVE = "active",
  INACTIVE = "inactive",
  DELETED = "deleted"
}

export interface FirebaseMediaFile {
  id: string;
  userId: string;
  folderId?: string | null;
  filename: string;
  originalFilename: string;
  type: FirebaseMediaType;
  mimeType: string;
  size: number; // em bytes
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null; // para imagens e vídeos
  height?: number | null; // para imagens e vídeos
  duration?: number | null; // para áudios e vídeos, em segundos
  status: FirebaseMediaStatus;
  metadata?: Record<string, any> | null;
  tags?: string[] | null;
  alt?: string | null;
  caption?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseMediaFolder {
  id: string;
  userId: string;
  parentId?: string | null;
  name: string;
  path: string;
  isPublic: boolean;
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const MEDIA_FILES_COLLECTION = "mediaFiles";
const MEDIA_FOLDERS_COLLECTION = "mediaFolders";

/**
 * Cria um novo registro de arquivo de mídia.
 */
export const createMediaFile = async (
  fileData: Omit<FirebaseMediaFile, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseMediaFile> => {
  const fileRef = db.collection(MEDIA_FILES_COLLECTION).doc();
  const now = Timestamp.now();

  const newFile: FirebaseMediaFile = {
    id: fileRef.id,
    ...fileData,
    createdAt: now,
    updatedAt: now,
  };

  await fileRef.set(newFile);
  console.log(`Arquivo de mídia (ID: ${newFile.id}) criado com sucesso.`);
  return newFile;
};

/**
 * Busca um arquivo de mídia pelo ID.
 */
export const getMediaFileById = async (fileId: string): Promise<FirebaseMediaFile | null> => {
  const docRef = db.collection(MEDIA_FILES_COLLECTION).doc(fileId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseMediaFile;
  }
  console.warn(`Arquivo de mídia (ID: ${fileId}) não encontrado.`);
  return null;
};

/**
 * Busca arquivos de mídia com opções de filtro.
 */
export const getMediaFiles = async (
  options: {
    userId?: string;
    folderId?: string;
    type?: FirebaseMediaType;
    status?: FirebaseMediaStatus;
    tags?: string[];
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ files: FirebaseMediaFile[]; total: number }> => {
  try {
    let query = db.collection(MEDIA_FILES_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.folderId) {
      query = query.where("folderId", "==", options.folderId);
    } else if (options.folderId === null) {
      // Buscar arquivos na raiz (sem pasta)
      query = query.where("folderId", "==", null);
    }
    
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.tags && options.tags.length > 0) {
      // Firestore suporta apenas um array-contains por consulta
      query = query.where("tags", "array-contains", options.tags[0]);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    if (options.orderByCreatedAt) {
      query = query.orderBy("createdAt", options.orderByCreatedAt);
    } else {
      query = query.orderBy("createdAt", "desc"); // Padrão: mais recentes primeiro
    }
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let files: FirebaseMediaFile[] = [];
    snapshot.forEach(doc => {
      files.push(doc.data() as FirebaseMediaFile);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTermLower = options.searchTerm.toLowerCase();
      files = files.filter(file => 
        file.filename.toLowerCase().includes(searchTermLower) ||
        file.originalFilename.toLowerCase().includes(searchTermLower) ||
        (file.alt && file.alt.toLowerCase().includes(searchTermLower)) ||
        (file.caption && file.caption.toLowerCase().includes(searchTermLower))
      );
    }
    
    // Filtrar por múltiplas tags (client-side)
    if (options.tags && options.tags.length > 1) {
      files = files.filter(file => 
        file.tags && options.tags!.every(tag => file.tags!.includes(tag))
      );
    }
    
    return { files, total };
  } catch (error) {
    console.error(`Erro ao buscar arquivos de mídia:`, error);
    throw error;
  }
};

/**
 * Atualiza um arquivo de mídia existente.
 */
export const updateMediaFile = async (
  fileId: string, 
  updates: Partial<Omit<FirebaseMediaFile, "id" | "createdAt">>
): Promise<FirebaseMediaFile | null> => {
  const fileRef = db.collection(MEDIA_FILES_COLLECTION).doc(fileId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await fileRef.update(updateData);
    console.log(`Arquivo de mídia (ID: ${fileId}) atualizado com sucesso.`);
    const updatedDoc = await fileRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseMediaFile : null;
  } catch (error) {
    console.error(`Erro ao atualizar arquivo de mídia (ID: ${fileId}):`, error);
    throw error;
  }
};

/**
 * Marca um arquivo de mídia como excluído (soft delete).
 */
export const softDeleteMediaFile = async (fileId: string): Promise<FirebaseMediaFile | null> => {
  return updateMediaFile(fileId, { status: FirebaseMediaStatus.DELETED });
};

/**
 * Exclui permanentemente um arquivo de mídia.
 */
export const deleteMediaFile = async (fileId: string): Promise<void> => {
  try {
    // Primeiro, obter o arquivo para saber o caminho no storage
    const file = await getMediaFileById(fileId);
    if (!file) {
      console.warn(`Arquivo de mídia (ID: ${fileId}) não encontrado para exclusão.`);
      return;
    }
    
    // Extrair o caminho do storage da URL
    const urlPath = new URL(file.url).pathname;
    const storagePath = decodeURIComponent(urlPath.split('/o/')[1].split('?')[0]);
    
    // Excluir o arquivo do storage
    try {
      await storage.bucket().file(storagePath).delete();
      console.log(`Arquivo excluído do storage: ${storagePath}`);
    } catch (storageError) {
      console.error(`Erro ao excluir arquivo do storage: ${storagePath}`, storageError);
      // Continuar mesmo se falhar a exclusão do storage
    }
    
    // Excluir o thumbnail, se existir
    if (file.thumbnailUrl) {
      try {
        const thumbnailUrlPath = new URL(file.thumbnailUrl).pathname;
        const thumbnailStoragePath = decodeURIComponent(thumbnailUrlPath.split('/o/')[1].split('?')[0]);
        await storage.bucket().file(thumbnailStoragePath).delete();
        console.log(`Thumbnail excluído do storage: ${thumbnailStoragePath}`);
      } catch (thumbnailError) {
        console.error(`Erro ao excluir thumbnail do storage`, thumbnailError);
        // Continuar mesmo se falhar a exclusão do thumbnail
      }
    }
    
    // Excluir o registro do Firestore
    const fileRef = db.collection(MEDIA_FILES_COLLECTION).doc(fileId);
    await fileRef.delete();
    console.log(`Registro de arquivo de mídia (ID: ${fileId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir arquivo de mídia (ID: ${fileId}):`, error);
    throw error;
  }
};

/**
 * Cria uma nova pasta de mídia.
 */
export const createMediaFolder = async (
  folderData: Omit<FirebaseMediaFolder, "id" | "createdAt" | "updatedAt">
): Promise<FirebaseMediaFolder> => {
  const folderRef = db.collection(MEDIA_FOLDERS_COLLECTION).doc();
  const now = Timestamp.now();

  const newFolder: FirebaseMediaFolder = {
    id: folderRef.id,
    ...folderData,
    createdAt: now,
    updatedAt: now,
  };

  await folderRef.set(newFolder);
  console.log(`Pasta de mídia (ID: ${newFolder.id}) criada com sucesso.`);
  return newFolder;
};

/**
 * Busca uma pasta de mídia pelo ID.
 */
export const getMediaFolderById = async (folderId: string): Promise<FirebaseMediaFolder | null> => {
  const docRef = db.collection(MEDIA_FOLDERS_COLLECTION).doc(folderId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseMediaFolder;
  }
  console.warn(`Pasta de mídia (ID: ${folderId}) não encontrada.`);
  return null;
};

/**
 * Busca pastas de mídia com opções de filtro.
 */
export const getMediaFolders = async (
  options: {
    userId?: string;
    parentId?: string | null;
    isPublic?: boolean;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ folders: FirebaseMediaFolder[]; total: number }> => {
  try {
    let query = db.collection(MEDIA_FOLDERS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.parentId !== undefined) {
      query = query.where("parentId", "==", options.parentId);
    }
    
    if (options.isPublic !== undefined) {
      query = query.where("isPublic", "==", options.isPublic);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'name';
    const orderDirection = options.orderDirection || 'asc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let folders: FirebaseMediaFolder[] = [];
    snapshot.forEach(doc => {
      folders.push(doc.data() as FirebaseMediaFolder);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTermLower = options.searchTerm.toLowerCase();
      folders = folders.filter(folder => 
        folder.name.toLowerCase().includes(searchTermLower) ||
        folder.path.toLowerCase().includes(searchTermLower)
      );
    }
    
    return { folders, total };
  } catch (error) {
    console.error(`Erro ao buscar pastas de mídia:`, error);
    throw error;
  }
};

/**
 * Atualiza uma pasta de mídia existente.
 */
export const updateMediaFolder = async (
  folderId: string, 
  updates: Partial<Omit<FirebaseMediaFolder, "id" | "createdAt">>
): Promise<FirebaseMediaFolder | null> => {
  const folderRef = db.collection(MEDIA_FOLDERS_COLLECTION).doc(folderId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  try {
    await folderRef.update(updateData);
    console.log(`Pasta de mídia (ID: ${folderId}) atualizada com sucesso.`);
    const updatedDoc = await folderRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseMediaFolder : null;
  } catch (error) {
    console.error(`Erro ao atualizar pasta de mídia (ID: ${folderId}):`, error);
    throw error;
  }
};

/**
 * Exclui uma pasta de mídia e, opcionalmente, seu conteúdo.
 */
export const deleteMediaFolder = async (
  folderId: string,
  deleteContents: boolean = false
): Promise<void> => {
  try {
    // Verificar se a pasta existe
    const folder = await getMediaFolderById(folderId);
    if (!folder) {
      console.warn(`Pasta de mídia (ID: ${folderId}) não encontrada para exclusão.`);
      return;
    }
    
    if (deleteContents) {
      // Excluir arquivos na pasta
      const { files } = await getMediaFiles({ folderId });
      for (const file of files) {
        await deleteMediaFile(file.id);
      }
      
      // Excluir subpastas recursivamente
      const { folders } = await getMediaFolders({ parentId: folderId });
      for (const subfolder of folders) {
        await deleteMediaFolder(subfolder.id, true);
      }
    } else {
      // Verificar se a pasta está vazia
      const { total: fileCount } = await getMediaFiles({ folderId, limit: 1 });
      const { total: folderCount } = await getMediaFolders({ parentId: folderId, limit: 1 });
      
      if (fileCount > 0 || folderCount > 0) {
        throw new Error(`Não é possível excluir a pasta (ID: ${folderId}) porque ela não está vazia. Use deleteContents=true para excluir o conteúdo.`);
      }
    }
    
    // Excluir a pasta
    const folderRef = db.collection(MEDIA_FOLDERS_COLLECTION).doc(folderId);
    await folderRef.delete();
    console.log(`Pasta de mídia (ID: ${folderId}) excluída com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir pasta de mídia (ID: ${folderId}):`, error);
    throw error;
  }
};

/**
 * Move um arquivo para outra pasta.
 */
export const moveMediaFile = async (
  fileId: string,
  targetFolderId: string | null
): Promise<FirebaseMediaFile | null> => {
  try {
    // Verificar se o arquivo existe
    const file = await getMediaFileById(fileId);
    if (!file) {
      console.warn(`Arquivo de mídia (ID: ${fileId}) não encontrado para mover.`);
      return null;
    }
    
    // Verificar se a pasta de destino existe (se não for null)
    if (targetFolderId !== null) {
      const targetFolder = await getMediaFolderById(targetFolderId);
      if (!targetFolder) {
        throw new Error(`Pasta de destino (ID: ${targetFolderId}) não encontrada.`);
      }
    }
    
    // Atualizar a pasta do arquivo
    return updateMediaFile(fileId, { folderId: targetFolderId });
  } catch (error) {
    console.error(`Erro ao mover arquivo de mídia (ID: ${fileId}):`, error);
    throw error;
  }
};

/**
 * Move uma pasta para outra pasta.
 */
export const moveMediaFolder = async (
  folderId: string,
  targetParentId: string | null
): Promise<FirebaseMediaFolder | null> => {
  try {
    // Verificar se a pasta existe
    const folder = await getMediaFolderById(folderId);
    if (!folder) {
      console.warn(`Pasta de mídia (ID: ${folderId}) não encontrada para mover.`);
      return null;
    }
    
    // Verificar se a pasta de destino existe (se não for null)
    if (targetParentId !== null) {
      const targetFolder = await getMediaFolderById(targetParentId);
      if (!targetFolder) {
        throw new Error(`Pasta de destino (ID: ${targetParentId}) não encontrada.`);
      }
      
      // Verificar se não está tentando mover para uma subpasta de si mesma
      if (targetParentId === folderId) {
        throw new Error(`Não é possível mover uma pasta para dentro dela mesma.`);
      }
      
      // Verificar se não está tentando mover para uma subpasta
      let currentParentId = targetFolder.parentId;
      while (currentParentId) {
        if (currentParentId === folderId) {
          throw new Error(`Não é possível mover uma pasta para uma de suas subpastas.`);
        }
        
        const parentFolder = await getMediaFolderById(currentParentId);
        if (!parentFolder) break;
        
        currentParentId = parentFolder.parentId;
      }
    }
    
    // Atualizar o caminho da pasta e de todas as subpastas
    const oldPath = folder.path;
    let newPath: string;
    
    if (targetParentId === null) {
      // Movendo para a raiz
      newPath = `/${folder.name}`;
    } else {
      const targetFolder = await getMediaFolderById(targetParentId);
      newPath = `${targetFolder!.path}/${folder.name}`;
    }
    
    // Atualizar a pasta atual
    const updatedFolder = await updateMediaFolder(folderId, {
      parentId: targetParentId,
      path: newPath
    });
    
    // Atualizar os caminhos de todas as subpastas
    await updateSubfolderPaths(folderId, oldPath, newPath);
    
    return updatedFolder;
  } catch (error) {
    console.error(`Erro ao mover pasta de mídia (ID: ${folderId}):`, error);
    throw error;
  }
};

/**
 * Função auxiliar para atualizar os caminhos de todas as subpastas recursivamente.
 */
const updateSubfolderPaths = async (
  parentId: string,
  oldParentPath: string,
  newParentPath: string
): Promise<void> => {
  try {
    const { folders } = await getMediaFolders({ parentId });
    
    for (const folder of folders) {
      // Atualizar o caminho da subpasta
      const newPath = folder.path.replace(oldParentPath, newParentPath);
      await updateMediaFolder(folder.id, { path: newPath });
      
      // Atualizar recursivamente as subpastas desta subpasta
      await updateSubfolderPaths(folder.id, folder.path, newPath);
    }
  } catch (error) {
    console.error(`Erro ao atualizar caminhos de subpastas:`, error);
    throw error;
  }
};

/**
 * Gera uma URL assinada para upload direto para o Storage.
 * Retorna a URL e o caminho onde o arquivo será armazenado.
 */
export const generateUploadUrl = async (
  userId: string,
  filename: string,
  mimeType: string,
  folderId?: string | null
): Promise<{ uploadUrl: string; storagePath: string; fileId: string }> => {
  try {
    // Gerar um ID único para o arquivo
    const fileId = db.collection(MEDIA_FILES_COLLECTION).doc().id;
    
    // Determinar o caminho de armazenamento
    let folderPath = "";
    if (folderId) {
      const folder = await getMediaFolderById(folderId);
      if (folder) {
        folderPath = folder.path.replace(/^\//, ''); // Remover a barra inicial
      }
    }
    
    // Sanitizar o nome do arquivo
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Substituir caracteres não alfanuméricos por underscore
      .toLowerCase();
    
    // Criar um caminho único para o arquivo
    const timestamp = Date.now();
    const storagePath = `media/${userId}/${folderPath ? folderPath + '/' : ''}${fileId}_${timestamp}_${sanitizedFilename}`;
    
    // Gerar URL assinada para upload
    const file = storage.bucket().file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType: mimeType,
    });
    
    return { uploadUrl, storagePath, fileId };
  } catch (error) {
    console.error(`Erro ao gerar URL de upload:`, error);
    throw error;
  }
};

/**
 * Finaliza o processo de upload, criando o registro do arquivo no Firestore.
 */
export const finalizeUpload = async (
  fileId: string,
  userId: string,
  storagePath: string,
  originalFilename: string,
  mimeType: string,
  size: number,
  folderId?: string | null,
  metadata?: Record<string, any>
): Promise<FirebaseMediaFile> => {
  try {
    // Determinar o tipo de mídia com base no MIME type
    let type = FirebaseMediaType.OTHER;
    if (mimeType.startsWith('image/')) {
      type = FirebaseMediaType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      type = FirebaseMediaType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      type = FirebaseMediaType.AUDIO;
    } else if (
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation')
    ) {
      type = FirebaseMediaType.DOCUMENT;
    }
    
    // Gerar URL pública para o arquivo
    const file = storage.bucket().file(storagePath);
    const [fileExists] = await file.exists();
    
    if (!fileExists) {
      throw new Error(`Arquivo não encontrado no storage: ${storagePath}`);
    }
    
    // Tornar o arquivo público
    await file.makePublic();
    
    // Obter a URL pública
    const url = `https://storage.googleapis.com/${storage.bucket().name}/${storagePath}`;
    
    // Extrair o nome do arquivo do caminho
    const filename = storagePath.split('/').pop() || originalFilename;
    
    // Criar o registro do arquivo
    const fileData: Omit<FirebaseMediaFile, "id" | "createdAt" | "updatedAt"> = {
      userId,
      folderId: folderId || null,
      filename,
      originalFilename,
      type,
      mimeType,
      size,
      url,
      thumbnailUrl: null, // Será gerado posteriormente, se aplicável
      status: FirebaseMediaStatus.ACTIVE,
      metadata: metadata || null,
      tags: [],
      alt: null,
      caption: null
    };
    
    // Adicionar dimensões para imagens e vídeos, se disponíveis no metadata
    if (metadata) {
      if (metadata.width) fileData.width = metadata.width;
      if (metadata.height) fileData.height = metadata.height;
      if (metadata.duration) fileData.duration = metadata.duration;
    }
    
    // Criar o registro no Firestore com o ID pré-definido
    const fileRef = db.collection(MEDIA_FILES_COLLECTION).doc(fileId);
    const now = Timestamp.now();
    
    const newFile: FirebaseMediaFile = {
      id: fileId,
      ...fileData,
      createdAt: now,
      updatedAt: now,
    };
    
    await fileRef.set(newFile);
    console.log(`Arquivo de mídia (ID: ${fileId}) finalizado com sucesso.`);
    
    return newFile;
  } catch (error) {
    console.error(`Erro ao finalizar upload (ID: ${fileId}):`, error);
    throw error;
  }
};