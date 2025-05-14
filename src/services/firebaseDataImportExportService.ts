import { firestore as db } from "../config/firebaseAdmin";
import { storage } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

// Definição de tipos para importação/exportação de dados
export enum FirebaseDataJobType {
  IMPORT = "import",
  EXPORT = "export"
}

export enum FirebaseDataFormat {
  JSON = "json",
  CSV = "csv",
  EXCEL = "excel"
}

export enum FirebaseDataJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface FirebaseDataJob {
  id: string;
  type: FirebaseDataJobType;
  name: string;
  description?: string | null;
  collection: string;
  format: FirebaseDataFormat;
  query?: Record<string, any> | null;
  mappings?: Record<string, string> | null;
  status: FirebaseDataJobStatus;
  progress?: number | null;
  totalRecords?: number | null;
  processedRecords?: number | null;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  sourceUrl?: string | null;
  resultUrl?: string | null;
  error?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DATA_JOBS_COLLECTION = "dataJobs";

/**
 * Cria um novo job de importação/exportação de dados.
 */
export const createDataJob = async (
  jobData: Omit<FirebaseDataJob, "id" | "status" | "progress" | "totalRecords" | "processedRecords" | "startedAt" | "completedAt" | "resultUrl" | "error" | "createdAt" | "updatedAt">
): Promise<FirebaseDataJob> => {
  const jobRef = db.collection(DATA_JOBS_COLLECTION).doc();
  const now = Timestamp.now();

  const newJob: FirebaseDataJob = {
    id: jobRef.id,
    ...jobData,
    status: FirebaseDataJobStatus.PENDING,
    progress: 0,
    totalRecords: null,
    processedRecords: 0,
    startedAt: null,
    completedAt: null,
    resultUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  await jobRef.set(newJob);
  console.log(`Job de ${jobData.type === FirebaseDataJobType.IMPORT ? 'importação' : 'exportação'} (ID: ${newJob.id}) criado com sucesso.`);
  return newJob;
};

/**
 * Busca um job de importação/exportação pelo ID.
 */
export const getDataJobById = async (jobId: string): Promise<FirebaseDataJob | null> => {
  const docRef = db.collection(DATA_JOBS_COLLECTION).doc(jobId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseDataJob;
  }
  console.warn(`Job de importação/exportação (ID: ${jobId}) não encontrado.`);
  return null;
};

/**
 * Busca jobs de importação/exportação com opções de filtro.
 */
export const getDataJobs = async (
  options: {
    type?: FirebaseDataJobType;
    status?: FirebaseDataJobStatus;
    collection?: string;
    createdBy?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ jobs: FirebaseDataJob[]; total: number }> => {
  try {
    let query = db.collection(DATA_JOBS_COLLECTION);
    
    // Aplicar filtros
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.collection) {
      query = query.where("collection", "==", options.collection);
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
    
    const jobs: FirebaseDataJob[] = [];
    snapshot.forEach(doc => {
      jobs.push(doc.data() as FirebaseDataJob);
    });
    
    return { jobs, total };
  } catch (error) {
    console.error(`Erro ao buscar jobs de importação/exportação:`, error);
    throw error;
  }
};

/**
 * Atualiza o status de um job de importação/exportação.
 */
export const updateDataJobStatus = async (
  jobId: string,
  status: FirebaseDataJobStatus,
  updates: {
    progress?: number;
    totalRecords?: number;
    processedRecords?: number;
    resultUrl?: string;
    error?: string;
  } = {}
): Promise<FirebaseDataJob | null> => {
  const jobRef = db.collection(DATA_JOBS_COLLECTION).doc(jobId);
  const now = Timestamp.now();
  
  const updateData: Record<string, any> = {
    status,
    updatedAt: now
  };
  
  if (status === FirebaseDataJobStatus.PROCESSING && !updates.error) {
    updateData.startedAt = updateData.startedAt || now;
  }
  
  if (status === FirebaseDataJobStatus.COMPLETED || status === FirebaseDataJobStatus.FAILED || status === FirebaseDataJobStatus.CANCELLED) {
    updateData.completedAt = now;
  }
  
  if (updates.progress !== undefined) {
    updateData.progress = updates.progress;
  }
  
  if (updates.totalRecords !== undefined) {
    updateData.totalRecords = updates.totalRecords;
  }
  
  if (updates.processedRecords !== undefined) {
    updateData.processedRecords = updates.processedRecords;
  }
  
  if (updates.resultUrl) {
    updateData.resultUrl = updates.resultUrl;
  }
  
  if (updates.error) {
    updateData.error = updates.error;
  }
  
  try {
    await jobRef.update(updateData);
    console.log(`Status do job de importação/exportação (ID: ${jobId}) atualizado para ${status}.`);
    const updatedDoc = await jobRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseDataJob : null;
  } catch (error) {
    console.error(`Erro ao atualizar status do job de importação/exportação (ID: ${jobId}):`, error);
    throw error;
  }
};

/**
 * Cancela um job de importação/exportação.
 */
export const cancelDataJob = async (jobId: string): Promise<FirebaseDataJob | null> => {
  const job = await getDataJobById(jobId);
  if (!job) {
    console.warn(`Job de importação/exportação (ID: ${jobId}) não encontrado.`);
    return null;
  }
  
  if (job.status !== FirebaseDataJobStatus.PENDING && job.status !== FirebaseDataJobStatus.PROCESSING) {
    console.warn(`Não é possível cancelar um job com status ${job.status}.`);
    return job;
  }
  
  return updateDataJobStatus(jobId, FirebaseDataJobStatus.CANCELLED);
};

/**
 * Exclui um job de importação/exportação.
 */
export const deleteDataJob = async (jobId: string): Promise<void> => {
  const jobRef = db.collection(DATA_JOBS_COLLECTION).doc(jobId);
  try {
    // Verificar se o job existe
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      console.warn(`Job de importação/exportação (ID: ${jobId}) não encontrado para exclusão.`);
      return;
    }
    
    const job = jobDoc.data() as FirebaseDataJob;
    
    // Se houver um arquivo de resultado, excluí-lo do storage
    if (job.resultUrl) {
      try {
        const urlPath = new URL(job.resultUrl).pathname;
        const storagePath = decodeURIComponent(urlPath.split('/o/')[1].split('?')[0]);
        await storage.bucket().file(storagePath).delete();
        console.log(`Arquivo de resultado excluído do storage: ${storagePath}`);
      } catch (storageError) {
        console.error(`Erro ao excluir arquivo de resultado do storage:`, storageError);
        // Continuar mesmo se falhar a exclusão do arquivo
      }
    }
    
    // Excluir o job
    await jobRef.delete();
    console.log(`Job de importação/exportação (ID: ${jobId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir job de importação/exportação (ID: ${jobId}):`, error);
    throw error;
  }
};

/**
 * Executa um job de exportação de dados.
 */
export const executeExportJob = async (jobId: string): Promise<void> => {
  try {
    // Obter o job
    const job = await getDataJobById(jobId);
    if (!job) {
      throw new Error(`Job de exportação (ID: ${jobId}) não encontrado.`);
    }
    
    if (job.type !== FirebaseDataJobType.EXPORT) {
      throw new Error(`Job (ID: ${jobId}) não é um job de exportação.`);
    }
    
    if (job.status !== FirebaseDataJobStatus.PENDING) {
      throw new Error(`Job de exportação (ID: ${jobId}) não está pendente (status: ${job.status}).`);
    }
    
    // Atualizar o status para "processando"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.PROCESSING);
    
    // Construir a consulta
    let query = db.collection(job.collection);
    
    // Aplicar filtros, se houver
    if (job.query) {
      for (const [field, value] of Object.entries(job.query)) {
        if (typeof value === 'object' && value !== null) {
          // Suporte para operadores de comparação
          if (value.operator && value.value !== undefined) {
            switch (value.operator) {
              case "==":
                query = query.where(field, "==", value.value);
                break;
              case "!=":
                query = query.where(field, "!=", value.value);
                break;
              case ">":
                query = query.where(field, ">", value.value);
                break;
              case ">=":
                query = query.where(field, ">=", value.value);
                break;
              case "<":
                query = query.where(field, "<", value.value);
                break;
              case "<=":
                query = query.where(field, "<=", value.value);
                break;
              case "array-contains":
                query = query.where(field, "array-contains", value.value);
                break;
              case "array-contains-any":
                query = query.where(field, "array-contains-any", value.value);
                break;
              case "in":
                query = query.where(field, "in", value.value);
                break;
              case "not-in":
                query = query.where(field, "not-in", value.value);
                break;
            }
          }
        } else {
          // Filtro simples de igualdade
          query = query.where(field, "==", value);
        }
      }
    }
    
    // Executar a consulta
    const snapshot = await query.get();
    
    // Atualizar o total de registros
    const totalRecords = snapshot.size;
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.PROCESSING, {
      totalRecords
    });
    
    if (totalRecords === 0) {
      throw new Error(`Nenhum registro encontrado para exportação.`);
    }
    
    // Extrair os dados
    const data: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const docData = doc.data();
      
      // Adicionar o ID do documento
      const item = { id: doc.id, ...docData };
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(item)) {
        if (value instanceof Timestamp) {
          item[key] = value.toDate().toISOString();
        }
      }
      
      data.push(item);
    });
    
    // Criar diretório temporário
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let filePath: string;
    let contentType: string;
    
    // Exportar no formato especificado
    if (job.format === FirebaseDataFormat.JSON) {
      filePath = path.join(tempDir, `${job.collection}_${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      contentType = "application/json";
    } else if (job.format === FirebaseDataFormat.CSV) {
      filePath = path.join(tempDir, `${job.collection}_${timestamp}.csv`);
      
      // Determinar os cabeçalhos
      const headers = new Set<string>();
      data.forEach(item => {
        Object.keys(item).forEach(key => headers.add(key));
      });
      
      // Aplicar mapeamentos, se houver
      const mappings = job.mappings || {};
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: Array.from(headers).map(header => ({
          id: header,
          title: mappings[header] || header
        }))
      });
      
      await csvWriter.writeRecords(data);
      contentType = "text/csv";
    } else {
      throw new Error(`Formato de exportação não suportado: ${job.format}`);
    }
    
    // Fazer upload para o Storage
    const storagePath = `exports/${job.collection}/${path.basename(filePath)}`;
    const file = storage.bucket().file(storagePath);
    
    await file.save(fs.readFileSync(filePath), {
      contentType,
      metadata: {
        contentType,
        metadata: {
          jobId,
          collection: job.collection,
          format: job.format,
          timestamp,
          recordCount: totalRecords.toString()
        }
      }
    });
    
    // Tornar o arquivo público (ou use URLs assinadas para maior segurança)
    await file.makePublic();
    
    // Obter a URL do arquivo
    const fileUrl = `https://storage.googleapis.com/${storage.bucket().name}/${storagePath}`;
    
    // Limpar o diretório temporário
    fs.unlinkSync(filePath);
    fs.rmdirSync(tempDir);
    
    // Atualizar o status do job para "concluído"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.COMPLETED, {
      progress: 100,
      processedRecords: totalRecords,
      resultUrl: fileUrl
    });
    
    console.log(`Job de exportação (ID: ${jobId}) concluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao executar job de exportação (ID: ${jobId}):`, error);
    
    // Atualizar o status do job para "falha"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.FAILED, {
      error: (error as Error).message
    });
    
    throw error;
  }
};

/**
 * Executa um job de importação de dados.
 */
export const executeImportJob = async (jobId: string): Promise<void> => {
  try {
    // Obter o job
    const job = await getDataJobById(jobId);
    if (!job) {
      throw new Error(`Job de importação (ID: ${jobId}) não encontrado.`);
    }
    
    if (job.type !== FirebaseDataJobType.IMPORT) {
      throw new Error(`Job (ID: ${jobId}) não é um job de importação.`);
    }
    
    if (job.status !== FirebaseDataJobStatus.PENDING) {
      throw new Error(`Job de importação (ID: ${jobId}) não está pendente (status: ${job.status}).`);
    }
    
    if (!job.sourceUrl) {
      throw new Error(`URL de origem não especificada para o job de importação (ID: ${jobId}).`);
    }
    
    // Atualizar o status para "processando"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.PROCESSING);
    
    // Baixar o arquivo de origem
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-'));
    const filePath = path.join(tempDir, `import_${Date.now()}`);
    
    // Extrair o caminho do storage da URL
    const urlPath = new URL(job.sourceUrl).pathname;
    const storagePath = decodeURIComponent(urlPath.split('/o/')[1].split('?')[0]);
    
    // Baixar o arquivo do storage
    await storage.bucket().file(storagePath).download({ destination: filePath });
    
    let data: Record<string, any>[] = [];
    
    // Ler o arquivo no formato especificado
    if (job.format === FirebaseDataFormat.JSON) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(fileContent);
    } else if (job.format === FirebaseDataFormat.CSV) {
      const results: Record<string, any>[] = [];
      
      // Ler o CSV
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
      
      data = results;
      
      // Aplicar mapeamentos inversos, se houver
      if (job.mappings) {
        const inverseMappings: Record<string, string> = {};
        for (const [key, value] of Object.entries(job.mappings)) {
          inverseMappings[value] = key;
        }
        
        data = data.map(item => {
          const mappedItem: Record<string, any> = {};
          for (const [key, value] of Object.entries(item)) {
            const mappedKey = inverseMappings[key] || key;
            mappedItem[mappedKey] = value;
          }
          return mappedItem;
        });
      }
    } else {
      throw new Error(`Formato de importação não suportado: ${job.format}`);
    }
    
    // Atualizar o total de registros
    const totalRecords = data.length;
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.PROCESSING, {
      totalRecords
    });
    
    if (totalRecords === 0) {
      throw new Error(`Nenhum registro encontrado para importação.`);
    }
    
    // Importar os dados para o Firestore
    const batch = db.batch();
    let batchCount = 0;
    let processedRecords = 0;
    
    for (const item of data) {
      // Extrair o ID, se houver
      const id = item.id;
      const docData = { ...item };
      delete docData.id;
      
      // Converter strings ISO para Timestamps
      for (const [key, value] of Object.entries(docData)) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              docData[key] = Timestamp.fromDate(date);
            }
          } catch (e) {
            // Manter como string se não for uma data válida
          }
        }
      }
      
      // Adicionar ao lote
      const docRef = id
        ? db.collection(job.collection).doc(id)
        : db.collection(job.collection).doc();
      
      batch.set(docRef, docData);
      batchCount++;
      
      // Commit o lote a cada 500 documentos (limite do Firestore)
      if (batchCount === 500) {
        await batch.commit();
        processedRecords += batchCount;
        batchCount = 0;
        
        // Atualizar o progresso
        const progress = Math.round((processedRecords / totalRecords) * 100);
        await updateDataJobStatus(jobId, FirebaseDataJobStatus.PROCESSING, {
          progress,
          processedRecords
        });
      }
    }
    
    // Commit o lote final
    if (batchCount > 0) {
      await batch.commit();
      processedRecords += batchCount;
    }
    
    // Limpar o diretório temporário
    fs.unlinkSync(filePath);
    fs.rmdirSync(tempDir);
    
    // Atualizar o status do job para "concluído"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.COMPLETED, {
      progress: 100,
      processedRecords
    });
    
    console.log(`Job de importação (ID: ${jobId}) concluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao executar job de importação (ID: ${jobId}):`, error);
    
    // Atualizar o status do job para "falha"
    await updateDataJobStatus(jobId, FirebaseDataJobStatus.FAILED, {
      error: (error as Error).message
    });
    
    throw error;
  }
};