import { Firestore, Timestamp, FieldPath } from "firebase-admin/firestore";
import {
  FirebaseBugReport,
  FirebaseBugReportStatus,
  FirebaseBugReportPriority,
  FirebaseUserProfile
} from "../types/firebaseTypes";

// Função para inicializar o serviço com a instância do Firestore
let db: Firestore;
export const initBugReportService = (firestoreInstance: Firestore) => {
  db = firestoreInstance;
};

/**
 * Cria um novo bug report no Firestore.
 * @param reportData Dados para o novo bug report.
 * @returns O bug report criado.
 */
export const createBugReport = async (reportData: {
  userId: string | null;
  reporterName: string; 
  reporterEmail: string | null;
  title: string;
  description: string;
  stepsToReproduce: string;
  url: string | null;
  userAgent: string | null;
  attachments: string[];
  priority: FirebaseBugReportPriority;
  tags: string[];
  appVersion: string | null;
  platform: string | null;
}): Promise<FirebaseBugReport> => {
  if (!db) throw new Error("BugReportService não inicializado. Chame initBugReportService primeiro.");
  if (!reportData.title || reportData.title.trim() === "") {
    throw new Error("O título do bug report é obrigatório.");
  }
  if (!reportData.description || reportData.description.trim() === "") {
    throw new Error("A descrição do bug report é obrigatória.");
  }

  const newReportRef = db.collection("bugReports").doc();
  const now = Timestamp.now();

  let finalReporterName = reportData.reporterName;
  let finalReporterEmail = reportData.reporterEmail;

  // Se userId for fornecido e reporterName ou reporterEmail não, tenta buscar do perfil do usuário.
  // No entanto, pela regra de obrigatoriedade, reporterName deve vir sempre.
  // reporterEmail pode ser nulo se o usuário não tiver um (improvável) ou se for um report anônimo sem email.
  if (reportData.userId && !finalReporterName) { // reporterName é obrigatório, mas se por acaso vier nulo com userId, tentamos popular
    try {
      const userDoc = await db.collection("users").doc(reportData.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as FirebaseUserProfile;
        finalReporterName = userData.name || "Usuário Anônimo"; // Sobrescreve se estava nulo
        if (!finalReporterEmail) finalReporterEmail = userData.email || null; // Popula email se não veio
      }
    } catch (error) {
      console.warn(`Não foi possível buscar dados do usuário ${reportData.userId} para denormalização do bug report:`, error);
    }
  }
  // Se for um report anônimo (sem userId), reporterName e reporterEmail devem ser os fornecidos (email pode ser null)
  if (!reportData.userId && !finalReporterName) {
      throw new Error("reporterName é obrigatório para reports anônimos.");
  }


  const newBugReport: FirebaseBugReport = {
    id: newReportRef.id,
    userId: reportData.userId || null,
    reporterName: finalReporterName, // Agora obrigatório na entrada ou via userProfile
    reporterEmail: finalReporterEmail, // Pode ser null
    title: reportData.title,
    description: reportData.description,
    stepsToReproduce: reportData.stepsToReproduce || "", // Obrigatório, default para string vazia
    status: FirebaseBugReportStatus.NEW, // Default status
    priority: reportData.priority, // Obrigatório na entrada
    assignedToUserId: null, // Default
    assignedToName: null, // Default
    resolution: null, // Default
    attachments: reportData.attachments || [], // Obrigatório, default para array vazio
    url: reportData.url,
    tags: reportData.tags || [], // Obrigatório, default para array vazio
    appVersion: reportData.appVersion,
    platform: reportData.platform,
    userAgent: reportData.userAgent,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null, // Default
    closedAt: null, // Default
  };

  await newReportRef.set(newBugReport);
  return newBugReport;
};

/**
 * Busca um bug report pelo ID.
 * @param id ID do bug report.
 * @returns O bug report encontrado ou null se não existir.
 */
export const getBugReportById = async (id: string): Promise<FirebaseBugReport | null> => {
  if (!db) throw new Error("BugReportService não inicializado.");
  const docRef = db.collection("bugReports").doc(id);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseBugReport;
  }
  return null;
};

/**
 * Atualiza um bug report existente.
 * @param id ID do bug report a ser atualizado.
 * @param updateData Dados para atualizar.
 * @returns O bug report atualizado.
 */
export const updateBugReport = async (
  id: string,
  updateData: Partial<Omit<FirebaseBugReport, "id" | "createdAt" | "reporterName" | "reporterEmail" | "userId">> // Campos de autoria não devem ser atualizáveis por esta função
): Promise<FirebaseBugReport> => {
  if (!db) throw new Error("BugReportService não inicializado.");
  const reportRef = db.collection("bugReports").doc(id);
  const reportDoc = await reportRef.get();

  if (!reportDoc.exists) {
    throw new Error(`Bug report com ID "${id}" não encontrado.`);
  }
  
  const currentData = reportDoc.data() as FirebaseBugReport;
  const dataToUpdate: Partial<FirebaseBugReport> = { ...updateData, updatedAt: Timestamp.now() };

  // Lógica para assignedToName se assignedToUserId mudar
  if (updateData.assignedToUserId !== undefined) {
    if (updateData.assignedToUserId === null) {
      dataToUpdate.assignedToName = null;
    } else {
      try {
        const userDoc = await db.collection("users").doc(updateData.assignedToUserId).get();
        if (userDoc.exists) {
          dataToUpdate.assignedToName = (userDoc.data() as FirebaseUserProfile).name;
        } else {
          dataToUpdate.assignedToName = null; // Usuário não encontrado, manter null
        }
      } catch (error) {
        console.warn(`Não foi possível buscar nome do usuário ${updateData.assignedToUserId} para denormalização:`, error);
        dataToUpdate.assignedToName = null; // Falha na busca, manter null
      }
    }
  }

  // Lógica para resolvedAt e closedAt baseada no status
  if (updateData.status) {
    if ((updateData.status === FirebaseBugReportStatus.RESOLVED || updateData.status === FirebaseBugReportStatus.CLOSED) && !currentData.resolvedAt) {
      dataToUpdate.resolvedAt = Timestamp.now();
    }
    if (updateData.status === FirebaseBugReportStatus.CLOSED && !currentData.closedAt) {
      dataToUpdate.closedAt = Timestamp.now();
    }
    // Se reabrir um bug, limpar resolvedAt e closedAt
    if (updateData.status !== FirebaseBugReportStatus.RESOLVED && updateData.status !== FirebaseBugReportStatus.CLOSED) {
        dataToUpdate.resolvedAt = null;
        dataToUpdate.closedAt = null;
    }
  }

  await reportRef.update(dataToUpdate);
  const updatedDoc = await reportRef.get();
  return updatedDoc.data() as FirebaseBugReport;
};

/**
 * Deleta um bug report (hard delete).
 * @param id ID do bug report a ser deletado.
 */
export const deleteBugReport = async (id: string): Promise<void> => {
  if (!db) throw new Error("BugReportService não inicializado.");
  const reportRef = db.collection("bugReports").doc(id);
  const reportDoc = await reportRef.get();

  if (!reportDoc.exists) {
    throw new Error(`Bug report com ID "${id}" não encontrado.`);
  }
  await reportRef.delete();
};

/**
 * Lista bug reports com filtros e paginação.
 */
export const listBugReports = async (options?: {
  limit?: number;
  startAfter?: string; // Document ID to start after
  sortBy?: keyof FirebaseBugReport | "id"; // Permitir ordenar por qualquer campo ou id
  sortDirection?: "asc" | "desc";
  status?: FirebaseBugReportStatus;
  priority?: FirebaseBugReportPriority;
  assignedToUserId?: string | null;
  userId?: string; 
  platform?: string;
  appVersion?: string;
  tags?: string[]; // Para 'array-contains'
}): Promise<{ reports: FirebaseBugReport[]; nextCursor?: string }> => {
  if (!db) throw new Error("BugReportService não inicializado.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("bugReports");

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }
  if (options?.priority) {
    query = query.where("priority", "==", options.priority);
  }
  if (options?.assignedToUserId !== undefined) {
    query = query.where("assignedToUserId", "==", options.assignedToUserId);
  }
  if (options?.userId) {
    query = query.where("userId", "==", options.userId);
  }
  if (options?.platform) {
    query = query.where("platform", "==", options.platform);
  }
  if (options?.appVersion) {
    query = query.where("appVersion", "==", options.appVersion);
  }
  if (options?.tags && options.tags.length > 0) {
    // Para consulta com 'array-contains', geralmente se faz para uma tag por vez
    // Se precisar de 'array-contains-any', a lógica de consulta e índice muda.
    // Por simplicidade, vamos assumir que se tags for fornecido, é para UMA tag específica.
    query = query.where("tags", "array-contains", options.tags[0]);
  }

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  
  if (sortBy === "id") {
      query = query.orderBy(FieldPath.documentId(), sortDirection);
  } else {
      query = query.orderBy(sortBy, sortDirection);
  }
  
  // Adicionar desambiguação para cursor se sortBy não for um campo único ou o principal de ordenação
  if (sortBy !== "createdAt" && sortBy !== "updatedAt" && sortBy !== "id") { 
      query = query.orderBy("createdAt", "desc"); 
  }

  if (options?.startAfter) {
    const startAfterDoc = await db.collection("bugReports").doc(options.startAfter).get();
    if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 20;
  query = query.limit(limit);

  const snapshot = await query.get();
  const reports = snapshot.docs.map(doc => doc.data() as FirebaseBugReport);
  
  let nextCursor: string | undefined = undefined;
  if (reports.length === limit && snapshot.docs.length > 0) {
    nextCursor = snapshot.docs[snapshot.docs.length - 1]?.id;
  }

  return { reports, nextCursor };
};

