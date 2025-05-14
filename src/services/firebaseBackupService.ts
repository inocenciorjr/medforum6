import { firestore as db } from "../config/firebaseAdmin";
import { storage } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para backups
export enum FirebaseBackupJobStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface FirebaseBackupJob {
  id: string;
  name: string;
  description?: string | null;
  collections: string[];
  status: FirebaseBackupJobStatus;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  error?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseBackupConfig {
  id: string;
  enabled: boolean;
  schedule: {
    frequency: "daily" | "weekly" | "monthly";
    dayOfWeek?: number | null; // 0-6, onde 0 é domingo (para weekly)
    dayOfMonth?: number | null; // 1-31 (para monthly)
    hour: number; // 0-23
    minute: number; // 0-59
  };
  collections: string[];
  retentionDays: number;
  storageLocation: string;
  notifyEmail?: string | null;
  lastRun?: Timestamp | null;
  nextRun?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const BACKUP_JOBS_COLLECTION = "backupJobs";
const BACKUP_CONFIG_COLLECTION = "backupConfig";

/**
 * Cria um novo job de backup.
 */
export const createBackupJob = async (
  jobData: Omit<FirebaseBackupJob, "id" | "status" | "startedAt" | "completedAt" | "fileUrl" | "fileSize" | "error" | "createdAt" | "updatedAt">
): Promise<FirebaseBackupJob> => {
  const jobRef = db.collection(BACKUP_JOBS_COLLECTION).doc();
  const now = Timestamp.now();

  const newJob: FirebaseBackupJob = {
    id: jobRef.id,
    ...jobData,
    status: FirebaseBackupJobStatus.PENDING,
    startedAt: null,
    completedAt: null,
    fileUrl: null,
    fileSize: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  await jobRef.set(newJob);
  console.log(`Job de backup (ID: ${newJob.id}) criado com sucesso.`);
  return newJob;
};

/**
 * Busca um job de backup pelo ID.
 */
export const getBackupJobById = async (jobId: string): Promise<FirebaseBackupJob | null> => {
  const docRef = db.collection(BACKUP_JOBS_COLLECTION).doc(jobId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseBackupJob;
  }
  console.warn(`Job de backup (ID: ${jobId}) não encontrado.`);
  return null;
};

/**
 * Busca jobs de backup com opções de filtro.
 */
export const getBackupJobs = async (
  options: {
    status?: FirebaseBackupJobStatus;
    createdBy?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ jobs: FirebaseBackupJob[]; total: number }> => {
  try {
    let query = db.collection(BACKUP_JOBS_COLLECTION);
    
    // Aplicar filtros
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("createdAt", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("createdAt", "<=", endTimestamp);
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
    
    const jobs: FirebaseBackupJob[] = [];
    snapshot.forEach(doc => {
      jobs.push(doc.data() as FirebaseBackupJob);
    });
    
    return { jobs, total };
  } catch (error) {
    console.error(`Erro ao buscar jobs de backup:`, error);
    throw error;
  }
};

/**
 * Atualiza o status de um job de backup.
 */
export const updateBackupJobStatus = async (
  jobId: string,
  status: FirebaseBackupJobStatus,
  updates: {
    fileUrl?: string;
    fileSize?: number;
    error?: string;
  } = {}
): Promise<FirebaseBackupJob | null> => {
  const jobRef = db.collection(BACKUP_JOBS_COLLECTION).doc(jobId);
  const now = Timestamp.now();
  
  const updateData: Record<string, any> = {
    status,
    updatedAt: now
  };
  
  if (status === FirebaseBackupJobStatus.IN_PROGRESS && !updates.error) {
    updateData.startedAt = now;
  }
  
  if (status === FirebaseBackupJobStatus.COMPLETED || status === FirebaseBackupJobStatus.FAILED) {
    updateData.completedAt = now;
  }
  
  if (updates.fileUrl) {
    updateData.fileUrl = updates.fileUrl;
  }
  
  if (updates.fileSize) {
    updateData.fileSize = updates.fileSize;
  }
  
  if (updates.error) {
    updateData.error = updates.error;
  }
  
  try {
    await jobRef.update(updateData);
    console.log(`Status do job de backup (ID: ${jobId}) atualizado para ${status}.`);
    const updatedDoc = await jobRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseBackupJob : null;
  } catch (error) {
    console.error(`Erro ao atualizar status do job de backup (ID: ${jobId}):`, error);
    throw error;
  }
};

/**
 * Exclui um job de backup.
 */
export const deleteBackupJob = async (jobId: string): Promise<void> => {
  const jobRef = db.collection(BACKUP_JOBS_COLLECTION).doc(jobId);
  try {
    // Verificar se o job existe
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      console.warn(`Job de backup (ID: ${jobId}) não encontrado para exclusão.`);
      return;
    }
    
    const job = jobDoc.data() as FirebaseBackupJob;
    
    // Se houver um arquivo de backup, excluí-lo do storage
    if (job.fileUrl) {
      try {
        const urlPath = new URL(job.fileUrl).pathname;
        const storagePath = decodeURIComponent(urlPath.split('/o/')[1].split('?')[0]);
        await storage.bucket().file(storagePath).delete();
        console.log(`Arquivo de backup excluído do storage: ${storagePath}`);
      } catch (storageError) {
        console.error(`Erro ao excluir arquivo de backup do storage:`, storageError);
        // Continuar mesmo se falhar a exclusão do arquivo
      }
    }
    
    // Excluir o job
    await jobRef.delete();
    console.log(`Job de backup (ID: ${jobId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir job de backup (ID: ${jobId}):`, error);
    throw error;
  }
};

/**
 * Cria ou atualiza a configuração de backup.
 */
export const setBackupConfig = async (
  configData: Omit<FirebaseBackupConfig, "id" | "createdAt" | "updatedAt" | "lastRun" | "nextRun">
): Promise<FirebaseBackupConfig> => {
  const configRef = db.collection(BACKUP_CONFIG_COLLECTION).doc("default");
  const now = Timestamp.now();
  
  // Calcular a próxima execução com base na programação
  const nextRun = calculateNextRun(configData.schedule);
  
  try {
    // Verificar se a configuração já existe
    const configDoc = await configRef.get();
    
    if (configDoc.exists) {
      // Atualizar configuração existente
      const existingConfig = configDoc.data() as FirebaseBackupConfig;
      
      const updatedConfig: FirebaseBackupConfig = {
        ...existingConfig,
        ...configData,
        nextRun,
        updatedAt: now
      };
      
      await configRef.update(updatedConfig);
      console.log(`Configuração de backup atualizada com sucesso.`);
      
      return updatedConfig;
    } else {
      // Criar nova configuração
      const newConfig: FirebaseBackupConfig = {
        id: "default",
        ...configData,
        lastRun: null,
        nextRun,
        createdAt: now,
        updatedAt: now
      };
      
      await configRef.set(newConfig);
      console.log(`Configuração de backup criada com sucesso.`);
      
      return newConfig;
    }
  } catch (error) {
    console.error(`Erro ao definir configuração de backup:`, error);
    throw error;
  }
};

/**
 * Função auxiliar para calcular a próxima execução com base na programação.
 */
const calculateNextRun = (schedule: FirebaseBackupConfig["schedule"]): Timestamp => {
  const now = new Date();
  const nextRun = new Date();
  
  // Definir hora e minuto
  nextRun.setHours(schedule.hour, schedule.minute, 0, 0);
  
  // Se a hora já passou hoje, avançar para o próximo dia/semana/mês
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  // Ajustar com base na frequência
  if (schedule.frequency === "weekly" && schedule.dayOfWeek !== undefined && schedule.dayOfWeek !== null) {
    const currentDay = nextRun.getDay();
    const daysToAdd = (7 + schedule.dayOfWeek - currentDay) % 7;
    
    if (daysToAdd > 0 || (daysToAdd === 0 && nextRun <= now)) {
      nextRun.setDate(nextRun.getDate() + daysToAdd);
    }
  } else if (schedule.frequency === "monthly" && schedule.dayOfMonth !== undefined && schedule.dayOfMonth !== null) {
    const currentDate = nextRun.getDate();
    
    // Resetar para o primeiro dia do mês
    nextRun.setDate(1);
    
    // Se o dia do mês já passou ou é hoje e a hora já passou, avançar para o próximo mês
    if (currentDate > schedule.dayOfMonth || (currentDate === schedule.dayOfMonth && nextRun <= now)) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
    
    // Definir o dia do mês
    const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
    nextRun.setDate(Math.min(schedule.dayOfMonth, lastDayOfMonth));
  }
  
  return Timestamp.fromDate(nextRun);
};

/**
 * Busca a configuração de backup.
 */
export const getBackupConfig = async (): Promise<FirebaseBackupConfig | null> => {
  const configRef = db.collection(BACKUP_CONFIG_COLLECTION).doc("default");
  const configDoc = await configRef.get();
  
  if (configDoc.exists) {
    return configDoc.data() as FirebaseBackupConfig;
  }
  
  return null;
};

/**
 * Atualiza o timestamp da última execução de backup.
 */
export const updateBackupLastRun = async (): Promise<FirebaseBackupConfig | null> => {
  const configRef = db.collection(BACKUP_CONFIG_COLLECTION).doc("default");
  const now = Timestamp.now();
  
  try {
    // Verificar se a configuração existe
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.warn(`Configuração de backup não encontrada.`);
      return null;
    }
    
    const config = configDoc.data() as FirebaseBackupConfig;
    
    // Calcular a próxima execução
    const nextRun = calculateNextRun(config.schedule);
    
    // Atualizar a configuração
    await configRef.update({
      lastRun: now,
      nextRun,
      updatedAt: now
    });
    
    console.log(`Timestamp da última execução de backup atualizado com sucesso.`);
    
    // Retornar a configuração atualizada
    const updatedDoc = await configRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseBackupConfig : null;
  } catch (error) {
    console.error(`Erro ao atualizar timestamp da última execução de backup:`, error);
    throw error;
  }
};

/**
 * Executa um backup das coleções especificadas.
 * Esta função é uma implementação simplificada. Em um ambiente real,
 * você usaria o Firebase Admin SDK para exportar dados para o Cloud Storage.
 */
export const executeBackup = async (
  jobId: string,
  collections: string[]
): Promise<void> => {
  try {
    // Atualizar o status do job para "em andamento"
    await updateBackupJobStatus(jobId, FirebaseBackupJobStatus.IN_PROGRESS);
    
    // Criar um objeto para armazenar os dados do backup
    const backupData: Record<string, any> = {};
    
    // Exportar cada coleção
    for (const collection of collections) {
      console.log(`Exportando coleção: ${collection}`);
      
      const snapshot = await db.collection(collection).get();
      const collectionData: Record<string, any> = {};
      
      snapshot.forEach(doc => {
        collectionData[doc.id] = doc.data();
      });
      
      backupData[collection] = collectionData;
    }
    
    // Converter para JSON
    const backupJson = JSON.stringify(backupData, null, 2);
    
    // Gerar nome de arquivo com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${timestamp}.json`;
    const storagePath = `backups/${fileName}`;
    
    // Fazer upload para o Storage
    const file = storage.bucket().file(storagePath);
    await file.save(backupJson, {
      contentType: "application/json",
      metadata: {
        contentType: "application/json",
        metadata: {
          jobId,
          collections: collections.join(","),
          timestamp
        }
      }
    });
    
    // Tornar o arquivo público (ou use URLs assinadas para maior segurança)
    await file.makePublic();
    
    // Obter a URL do arquivo
    const fileUrl = `https://storage.googleapis.com/${storage.bucket().name}/${storagePath}`;
    
    // Obter o tamanho do arquivo
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size);
    
    // Atualizar o status do job para "concluído"
    await updateBackupJobStatus(jobId, FirebaseBackupJobStatus.COMPLETED, {
      fileUrl,
      fileSize
    });
    
    // Atualizar o timestamp da última execução
    await updateBackupLastRun();
    
    console.log(`Backup (ID: ${jobId}) concluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao executar backup (ID: ${jobId}):`, error);
    
    // Atualizar o status do job para "falha"
    await updateBackupJobStatus(jobId, FirebaseBackupJobStatus.FAILED, {
      error: (error as Error).message
    });
    
    throw error;
  }
};

/**
 * Limpa backups antigos com base na política de retenção.
 */
export const cleanupOldBackups = async (): Promise<number> => {
  try {
    // Obter a configuração de backup
    const config = await getBackupConfig();
    
    if (!config) {
      console.warn(`Configuração de backup não encontrada.`);
      return 0;
    }
    
    // Calcular a data limite com base nos dias de retenção
    const retentionDays = config.retentionDays || 30; // Padrão: 30 dias
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);
    
    // Buscar jobs de backup concluídos antes da data limite
    const { jobs } = await getBackupJobs({
      status: FirebaseBackupJobStatus.COMPLETED,
      endDate: retentionDate
    });
    
    // Excluir cada job e seu arquivo
    let deletedCount = 0;
    
    for (const job of jobs) {
      await deleteBackupJob(job.id);
      deletedCount++;
    }
    
    console.log(`${deletedCount} backups antigos excluídos com sucesso.`);
    return deletedCount;
  } catch (error) {
    console.error(`Erro ao limpar backups antigos:`, error);
    throw error;
  }
};