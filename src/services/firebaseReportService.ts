import { firestore as db } from "../config/firebaseAdmin";
import { storage } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createObjectCsvWriter } from 'csv-writer';

// Definição de tipos para relatórios
export enum FirebaseReportType {
  USER_ACTIVITY = "user_activity",
  PAYMENT = "payment",
  SUBSCRIPTION = "subscription",
  CONTENT_USAGE = "content_usage",
  EXAM_RESULTS = "exam_results",
  CUSTOM = "custom"
}

export enum FirebaseReportFormat {
  JSON = "json",
  CSV = "csv",
  PDF = "pdf"
}

export enum FirebaseReportStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface FirebaseReportSchedule {
  frequency: "daily" | "weekly" | "monthly" | "once";
  dayOfWeek?: number | null; // 0-6, onde 0 é domingo (para weekly)
  dayOfMonth?: number | null; // 1-31 (para monthly)
  hour: number; // 0-23
  minute: number; // 0-59
  nextRun: Timestamp;
  lastRun?: Timestamp | null;
}

export interface FirebaseReport {
  id: string;
  name: string;
  description?: string | null;
  type: FirebaseReportType;
  format: FirebaseReportFormat;
  query: Record<string, any>;
  parameters?: Record<string, any> | null;
  schedule?: FirebaseReportSchedule | null;
  status: FirebaseReportStatus;
  progress?: number | null;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  fileUrl?: string | null;
  error?: string | null;
  recipients?: string[] | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const REPORTS_COLLECTION = "reports";

/**
 * Cria um novo relatório.
 */
export const createReport = async (
  reportData: Omit<FirebaseReport, "id" | "status" | "progress" | "startedAt" | "completedAt" | "fileUrl" | "error" | "createdAt" | "updatedAt">
): Promise<FirebaseReport> => {
  const reportRef = db.collection(REPORTS_COLLECTION).doc();
  const now = Timestamp.now();

  // Se houver uma programação, calcular a próxima execução
  if (reportData.schedule) {
    reportData.schedule.nextRun = calculateNextRun(reportData.schedule);
  }

  const newReport: FirebaseReport = {
    id: reportRef.id,
    ...reportData,
    status: FirebaseReportStatus.PENDING,
    progress: 0,
    startedAt: null,
    completedAt: null,
    fileUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  await reportRef.set(newReport);
  console.log(`Relatório (ID: ${newReport.id}) criado com sucesso.`);
  return newReport;
};

/**
 * Função auxiliar para calcular a próxima execução com base na programação.
 */
const calculateNextRun = (schedule: FirebaseReportSchedule): Timestamp => {
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
 * Busca um relatório pelo ID.
 */
export const getReportById = async (reportId: string): Promise<FirebaseReport | null> => {
  const docRef = db.collection(REPORTS_COLLECTION).doc(reportId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseReport;
  }
  console.warn(`Relatório (ID: ${reportId}) não encontrado.`);
  return null;
};

/**
 * Busca relatórios com opções de filtro.
 */
export const getReports = async (
  options: {
    type?: FirebaseReportType;
    status?: FirebaseReportStatus;
    createdBy?: string;
    scheduled?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderByCreatedAt?: 'asc' | 'desc';
  } = {}
): Promise<{ reports: FirebaseReport[]; total: number }> => {
  try {
    let query = db.collection(REPORTS_COLLECTION);
    
    // Aplicar filtros
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    if (options.status) {
      query = query.where("status", "==", options.status);
    }
    
    if (options.createdBy) {
      query = query.where("createdBy", "==", options.createdBy);
    }
    
    if (options.scheduled !== undefined) {
      query = query.where("schedule", options.scheduled ? "!=" : "==", null);
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
    
    const reports: FirebaseReport[] = [];
    snapshot.forEach(doc => {
      reports.push(doc.data() as FirebaseReport);
    });
    
    return { reports, total };
  } catch (error) {
    console.error(`Erro ao buscar relatórios:`, error);
    throw error;
  }
};

/**
 * Atualiza um relatório existente.
 */
export const updateReport = async (
  reportId: string, 
  updates: Partial<Omit<FirebaseReport, "id" | "createdAt" | "createdBy">>
): Promise<FirebaseReport | null> => {
  const reportRef = db.collection(REPORTS_COLLECTION).doc(reportId);
  const updateData = { ...updates, updatedAt: Timestamp.now() };

  // Se a programação foi atualizada, recalcular a próxima execução
  if (updates.schedule) {
    updateData.schedule = {
      ...updates.schedule,
      nextRun: calculateNextRun(updates.schedule)
    };
  }

  try {
    await reportRef.update(updateData);
    console.log(`Relatório (ID: ${reportId}) atualizado com sucesso.`);
    const updatedDoc = await reportRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseReport : null;
  } catch (error) {
    console.error(`Erro ao atualizar relatório (ID: ${reportId}):`, error);
    throw error;
  }
};

/**
 * Atualiza o status de um relatório.
 */
export const updateReportStatus = async (
  reportId: string,
  status: FirebaseReportStatus,
  updates: {
    progress?: number;
    fileUrl?: string;
    error?: string;
  } = {}
): Promise<FirebaseReport | null> => {
  const reportRef = db.collection(REPORTS_COLLECTION).doc(reportId);
  const now = Timestamp.now();
  
  const updateData: Record<string, any> = {
    status,
    updatedAt: now
  };
  
  if (status === FirebaseReportStatus.PROCESSING && !updates.error) {
    updateData.startedAt = updateData.startedAt || now;
  }
  
  if (status === FirebaseReportStatus.COMPLETED || status === FirebaseReportStatus.FAILED) {
    updateData.completedAt = now;
    
    // Se for um relatório programado, atualizar o lastRun e calcular o nextRun
    const report = await getReportById(reportId);
    if (report?.schedule) {
      updateData["schedule.lastRun"] = now;
      
      // Calcular a próxima execução apenas se não for um relatório único
      if (report.schedule.frequency !== "once") {
        const nextSchedule = { ...report.schedule, lastRun: now };
        updateData["schedule.nextRun"] = calculateNextRun(nextSchedule);
      }
    }
  }
  
  if (updates.progress !== undefined) {
    updateData.progress = updates.progress;
  }
  
  if (updates.fileUrl) {
    updateData.fileUrl = updates.fileUrl;
  }
  
  if (updates.error) {
    updateData.error = updates.error;
  }
  
  try {
    await reportRef.update(updateData);
    console.log(`Status do relatório (ID: ${reportId}) atualizado para ${status}.`);
    const updatedDoc = await reportRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseReport : null;
  } catch (error) {
    console.error(`Erro ao atualizar status do relatório (ID: ${reportId}):`, error);
    throw error;
  }
};

/**
 * Exclui um relatório.
 */
export const deleteReport = async (reportId: string): Promise<void> => {
  const reportRef = db.collection(REPORTS_COLLECTION).doc(reportId);
  try {
    // Verificar se o relatório existe
    const reportDoc = await reportRef.get();
    if (!reportDoc.exists) {
      console.warn(`Relatório (ID: ${reportId}) não encontrado para exclusão.`);
      return;
    }
    
    const report = reportDoc.data() as FirebaseReport;
    
    // Se houver um arquivo de relatório, excluí-lo do storage
    if (report.fileUrl) {
      try {
        const urlPath = new URL(report.fileUrl).pathname;
        const storagePath = decodeURIComponent(urlPath.split('/o/')[1].split('?')[0]);
        await storage.bucket().file(storagePath).delete();
        console.log(`Arquivo de relatório excluído do storage: ${storagePath}`);
      } catch (storageError) {
        console.error(`Erro ao excluir arquivo de relatório do storage:`, storageError);
        // Continuar mesmo se falhar a exclusão do arquivo
      }
    }
    
    // Excluir o relatório
    await reportRef.delete();
    console.log(`Relatório (ID: ${reportId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir relatório (ID: ${reportId}):`, error);
    throw error;
  }
};

/**
 * Busca relatórios programados que devem ser executados.
 */
export const getScheduledReportsToRun = async (): Promise<FirebaseReport[]> => {
  try {
    const now = Timestamp.now();
    
    const snapshot = await db.collection(REPORTS_COLLECTION)
      .where("schedule", "!=", null)
      .where("status", "!=", FirebaseReportStatus.PROCESSING)
      .get();
    
    const reportsToRun: FirebaseReport[] = [];
    
    snapshot.forEach(doc => {
      const report = doc.data() as FirebaseReport;
      
      if (report.schedule && report.schedule.nextRun && report.schedule.nextRun.toMillis() <= now.toMillis()) {
        reportsToRun.push(report);
      }
    });
    
    return reportsToRun;
  } catch (error) {
    console.error(`Erro ao buscar relatórios programados para execução:`, error);
    throw error;
  }
};

/**
 * Executa um relatório.
 */
export const executeReport = async (reportId: string): Promise<void> => {
  try {
    // Obter o relatório
    const report = await getReportById(reportId);
    if (!report) {
      throw new Error(`Relatório (ID: ${reportId}) não encontrado.`);
    }
    
    if (report.status === FirebaseReportStatus.PROCESSING) {
      throw new Error(`Relatório (ID: ${reportId}) já está em processamento.`);
    }
    
    // Atualizar o status para "processando"
    await updateReportStatus(reportId, FirebaseReportStatus.PROCESSING);
    
    // Executar a consulta com base no tipo de relatório
    let data: Record<string, any>[] = [];
    
    switch (report.type) {
      case FirebaseReportType.USER_ACTIVITY:
        data = await generateUserActivityReport(report.query, report.parameters);
        break;
      case FirebaseReportType.PAYMENT:
        data = await generatePaymentReport(report.query, report.parameters);
        break;
      case FirebaseReportType.SUBSCRIPTION:
        data = await generateSubscriptionReport(report.query, report.parameters);
        break;
      case FirebaseReportType.CONTENT_USAGE:
        data = await generateContentUsageReport(report.query, report.parameters);
        break;
      case FirebaseReportType.EXAM_RESULTS:
        data = await generateExamResultsReport(report.query, report.parameters);
        break;
      case FirebaseReportType.CUSTOM:
        data = await generateCustomReport(report.query, report.parameters);
        break;
      default:
        throw new Error(`Tipo de relatório não suportado: ${report.type}`);
    }
    
    if (data.length === 0) {
      throw new Error(`Nenhum dado encontrado para o relatório.`);
    }
    
    // Criar diretório temporário
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let filePath: string;
    let contentType: string;
    
    // Gerar o arquivo no formato especificado
    if (report.format === FirebaseReportFormat.JSON) {
      filePath = path.join(tempDir, `${report.type}_${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      contentType = "application/json";
    } else if (report.format === FirebaseReportFormat.CSV) {
      filePath = path.join(tempDir, `${report.type}_${timestamp}.csv`);
      
      // Determinar os cabeçalhos
      const headers = new Set<string>();
      data.forEach(item => {
        Object.keys(item).forEach(key => headers.add(key));
      });
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: Array.from(headers).map(header => ({
          id: header,
          title: header
        }))
      });
      
      await csvWriter.writeRecords(data);
      contentType = "text/csv";
    } else if (report.format === FirebaseReportFormat.PDF) {
      // Implementação simplificada - em um caso real, você usaria uma biblioteca para gerar PDFs
      filePath = path.join(tempDir, `${report.type}_${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      contentType = "application/json";
      console.warn(`Formato PDF não implementado completamente. Gerando JSON como fallback.`);
    } else {
      throw new Error(`Formato de relatório não suportado: ${report.format}`);
    }
    
    // Fazer upload para o Storage
    const storagePath = `reports/${report.type}/${path.basename(filePath)}`;
    const file = storage.bucket().file(storagePath);
    
    await file.save(fs.readFileSync(filePath), {
      contentType,
      metadata: {
        contentType,
        metadata: {
          reportId,
          reportType: report.type,
          reportFormat: report.format,
          timestamp,
          recordCount: data.length.toString()
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
    
    // Atualizar o status do relatório para "concluído"
    await updateReportStatus(reportId, FirebaseReportStatus.COMPLETED, {
      progress: 100,
      fileUrl
    });
    
    console.log(`Relatório (ID: ${reportId}) concluído com sucesso.`);
    
    // Enviar notificações, se houver destinatários
    if (report.recipients && report.recipients.length > 0) {
      // Implementação simplificada - em um caso real, você enviaria e-mails
      console.log(`Enviando notificação para ${report.recipients.join(", ")}`);
    }
  } catch (error) {
    console.error(`Erro ao executar relatório (ID: ${reportId}):`, error);
    
    // Atualizar o status do relatório para "falha"
    await updateReportStatus(reportId, FirebaseReportStatus.FAILED, {
      error: (error as Error).message
    });
    
    throw error;
  }
};

/**
 * Gera um relatório de atividade de usuários.
 */
const generateUserActivityReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    // Determinar o período do relatório
    const startDate = parameters?.startDate ? new Date(parameters.startDate) : new Date();
    startDate.setDate(startDate.getDate() - (parameters?.days || 30));
    const endDate = parameters?.endDate ? new Date(parameters.endDate) : new Date();
    
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Buscar logs de atividade
    let activityQuery = db.collection("activityLogs")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .orderBy("createdAt", "desc");
    
    // Aplicar filtros adicionais
    if (query.userId) {
      activityQuery = activityQuery.where("userId", "==", query.userId);
    }
    
    if (query.type) {
      activityQuery = activityQuery.where("type", "==", query.type);
    }
    
    const snapshot = await activityQuery.get();
    
    const activities: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const activity = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(activity)) {
        if (value instanceof Timestamp) {
          activity[key] = value.toDate().toISOString();
        }
      }
      
      activities.push({
        id: doc.id,
        ...activity
      });
    });
    
    return activities;
  } catch (error) {
    console.error(`Erro ao gerar relatório de atividade de usuários:`, error);
    throw error;
  }
};

/**
 * Gera um relatório de pagamentos.
 */
const generatePaymentReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    // Determinar o período do relatório
    const startDate = parameters?.startDate ? new Date(parameters.startDate) : new Date();
    startDate.setDate(startDate.getDate() - (parameters?.days || 30));
    const endDate = parameters?.endDate ? new Date(parameters.endDate) : new Date();
    
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Buscar pagamentos
    let paymentQuery = db.collection("payments")
      .orderBy("createdAt", "desc");
    
    // Aplicar filtros de data
    if (query.dateField === "paidAt") {
      paymentQuery = paymentQuery.where("paidAt", ">=", startTimestamp).where("paidAt", "<=", endTimestamp);
    } else {
      paymentQuery = paymentQuery.where("createdAt", ">=", startTimestamp).where("createdAt", "<=", endTimestamp);
    }
    
    // Aplicar filtros adicionais
    if (query.userId) {
      paymentQuery = paymentQuery.where("userId", "==", query.userId);
    }
    
    if (query.status) {
      paymentQuery = paymentQuery.where("status", "==", query.status);
    }
    
    if (query.paymentMethod) {
      paymentQuery = paymentQuery.where("paymentMethod", "==", query.paymentMethod);
    }
    
    const snapshot = await paymentQuery.get();
    
    const payments: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const payment = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(payment)) {
        if (value instanceof Timestamp) {
          payment[key] = value.toDate().toISOString();
        }
      }
      
      payments.push({
        id: doc.id,
        ...payment
      });
    });
    
    return payments;
  } catch (error) {
    console.error(`Erro ao gerar relatório de pagamentos:`, error);
    throw error;
  }
};

/**
 * Gera um relatório de assinaturas.
 */
const generateSubscriptionReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    // Buscar assinaturas (userPlans)
    let subscriptionQuery = db.collection("userPlans");
    
    // Aplicar filtros
    if (query.status) {
      subscriptionQuery = subscriptionQuery.where("status", "==", query.status);
    }
    
    if (query.userId) {
      subscriptionQuery = subscriptionQuery.where("userId", "==", query.userId);
    }
    
    if (query.planId) {
      subscriptionQuery = subscriptionQuery.where("planId", "==", query.planId);
    }
    
    if (query.autoRenew !== undefined) {
      subscriptionQuery = subscriptionQuery.where("autoRenew", "==", query.autoRenew);
    }
    
    // Ordenar por data de criação
    subscriptionQuery = subscriptionQuery.orderBy("createdAt", "desc");
    
    const snapshot = await subscriptionQuery.get();
    
    const subscriptions: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const subscription = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(subscription)) {
        if (value instanceof Timestamp) {
          subscription[key] = value.toDate().toISOString();
        }
      }
      
      subscriptions.push({
        id: doc.id,
        ...subscription
      });
    });
    
    return subscriptions;
  } catch (error) {
    console.error(`Erro ao gerar relatório de assinaturas:`, error);
    throw error;
  }
};

/**
 * Gera um relatório de uso de conteúdo.
 */
const generateContentUsageReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    // Determinar o período do relatório
    const startDate = parameters?.startDate ? new Date(parameters.startDate) : new Date();
    startDate.setDate(startDate.getDate() - (parameters?.days || 30));
    const endDate = parameters?.endDate ? new Date(parameters.endDate) : new Date();
    
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Buscar eventos de visualização de conteúdo
    let contentQuery = db.collection("analyticsEvents")
      .where("type", "==", "content_view")
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .orderBy("timestamp", "desc");
    
    // Aplicar filtros adicionais
    if (query.userId) {
      contentQuery = contentQuery.where("userId", "==", query.userId);
    }
    
    if (query.contentId) {
      contentQuery = contentQuery.where("properties.contentId", "==", query.contentId);
    }
    
    if (query.contentType) {
      contentQuery = contentQuery.where("properties.contentType", "==", query.contentType);
    }
    
    const snapshot = await contentQuery.get();
    
    const contentViews: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const event = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(event)) {
        if (value instanceof Timestamp) {
          event[key] = value.toDate().toISOString();
        }
      }
      
      contentViews.push({
        id: doc.id,
        ...event
      });
    });
    
    return contentViews;
  } catch (error) {
    console.error(`Erro ao gerar relatório de uso de conteúdo:`, error);
    throw error;
  }
};

/**
 * Gera um relatório de resultados de exames.
 */
const generateExamResultsReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    // Determinar o período do relatório
    const startDate = parameters?.startDate ? new Date(parameters.startDate) : new Date();
    startDate.setDate(startDate.getDate() - (parameters?.days || 30));
    const endDate = parameters?.endDate ? new Date(parameters.endDate) : new Date();
    
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Buscar resultados de exames
    let examQuery = db.collection("examResults")
      .where("completedAt", ">=", startTimestamp)
      .where("completedAt", "<=", endTimestamp)
      .orderBy("completedAt", "desc");
    
    // Aplicar filtros adicionais
    if (query.userId) {
      examQuery = examQuery.where("userId", "==", query.userId);
    }
    
    if (query.examId) {
      examQuery = examQuery.where("examId", "==", query.examId);
    }
    
    if (query.passed !== undefined) {
      examQuery = examQuery.where("passed", "==", query.passed);
    }
    
    const snapshot = await examQuery.get();
    
    const examResults: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const result = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(result)) {
        if (value instanceof Timestamp) {
          result[key] = value.toDate().toISOString();
        }
      }
      
      examResults.push({
        id: doc.id,
        ...result
      });
    });
    
    return examResults;
  } catch (error) {
    console.error(`Erro ao gerar relatório de resultados de exames:`, error);
    throw error;
  }
};

/**
 * Gera um relatório personalizado.
 */
const generateCustomReport = async (
  query: Record<string, any>,
  parameters?: Record<string, any> | null
): Promise<Record<string, any>[]> => {
  try {
    if (!query.collection) {
      throw new Error("Coleção não especificada para relatório personalizado.");
    }
    
    // Determinar o período do relatório, se aplicável
    let startTimestamp: Timestamp | undefined;
    let endTimestamp: Timestamp | undefined;
    
    if (parameters?.startDate && parameters?.dateField) {
      const startDate = new Date(parameters.startDate);
      startTimestamp = Timestamp.fromDate(startDate);
    }
    
    if (parameters?.endDate && parameters?.dateField) {
      const endDate = new Date(parameters.endDate);
      endTimestamp = Timestamp.fromDate(endDate);
    }
    
    // Construir a consulta
    let customQuery = db.collection(query.collection);
    
    // Aplicar filtros de data, se aplicável
    if (parameters?.dateField && startTimestamp && endTimestamp) {
      customQuery = customQuery
        .where(parameters.dateField, ">=", startTimestamp)
        .where(parameters.dateField, "<=", endTimestamp)
        .orderBy(parameters.dateField, "desc");
    }
    
    // Aplicar filtros adicionais
    if (query.filters) {
      for (const [field, value] of Object.entries(query.filters)) {
        if (typeof value === 'object' && value !== null) {
          // Suporte para operadores de comparação
          if (value.operator && value.value !== undefined) {
            switch (value.operator) {
              case "==":
                customQuery = customQuery.where(field, "==", value.value);
                break;
              case "!=":
                customQuery = customQuery.where(field, "!=", value.value);
                break;
              case ">":
                customQuery = customQuery.where(field, ">", value.value);
                break;
              case ">=":
                customQuery = customQuery.where(field, ">=", value.value);
                break;
              case "<":
                customQuery = customQuery.where(field, "<", value.value);
                break;
              case "<=":
                customQuery = customQuery.where(field, "<=", value.value);
                break;
              case "array-contains":
                customQuery = customQuery.where(field, "array-contains", value.value);
                break;
              case "array-contains-any":
                customQuery = customQuery.where(field, "array-contains-any", value.value);
                break;
              case "in":
                customQuery = customQuery.where(field, "in", value.value);
                break;
              case "not-in":
                customQuery = customQuery.where(field, "not-in", value.value);
                break;
            }
          }
        } else {
          // Filtro simples de igualdade
          customQuery = customQuery.where(field, "==", value);
        }
      }
    }
    
    // Aplicar limite, se especificado
    if (query.limit) {
      customQuery = customQuery.limit(query.limit);
    }
    
    const snapshot = await customQuery.get();
    
    const results: Record<string, any>[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Converter Timestamps para strings ISO
      for (const [key, value] of Object.entries(data)) {
        if (value instanceof Timestamp) {
          data[key] = value.toDate().toISOString();
        }
      }
      
      results.push({
        id: doc.id,
        ...data
      });
    });
    
    return results;
  } catch (error) {
    console.error(`Erro ao gerar relatório personalizado:`, error);
    throw error;
  }
};