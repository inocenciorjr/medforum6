import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para analytics
export enum FirebaseEventType {
  PAGE_VIEW = "page_view",
  CONTENT_VIEW = "content_view",
  SEARCH = "search",
  CLICK = "click",
  FORM_SUBMIT = "form_submit",
  SIGN_UP = "sign_up",
  LOGIN = "login",
  PURCHASE = "purchase",
  SUBSCRIPTION = "subscription",
  EXAM_START = "exam_start",
  EXAM_COMPLETE = "exam_complete",
  VIDEO_START = "video_start",
  VIDEO_COMPLETE = "video_complete",
  DOWNLOAD = "download",
  SHARE = "share",
  CUSTOM = "custom"
}

export interface FirebaseAnalyticsEvent {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  type: FirebaseEventType;
  name: string;
  properties?: Record<string, any> | null;
  url?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceInfo?: Record<string, any> | null;
  geoInfo?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  timestamp: Timestamp;
}

export interface FirebaseUserSession {
  id: string;
  userId?: string | null;
  startTime: Timestamp;
  endTime?: Timestamp | null;
  duration?: number | null; // em segundos
  deviceInfo?: Record<string, any> | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  exitPage?: string | null;
  pageViews?: number | null;
  isActive: boolean;
  geoInfo?: {
    country?: string;
    region?: string;
    city?: string;
  } | null;
}

export interface FirebaseAnalyticsDailyStats {
  id: string;
  date: string; // formato: YYYY-MM-DD
  uniqueUsers: number;
  newUsers: number;
  totalSessions: number;
  totalPageViews: number;
  totalEvents: number;
  avgSessionDuration: number; // em segundos
  bounceRate: number; // porcentagem
  topPages: Array<{ url: string; views: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  topDevices: Array<{ device: string; count: number }>;
  topBrowsers: Array<{ browser: string; count: number }>;
  updatedAt: Timestamp;
}

const ANALYTICS_EVENTS_COLLECTION = "analyticsEvents";
const USER_SESSIONS_COLLECTION = "userSessions";
const DAILY_STATS_COLLECTION = "analyticsDailyStats";

/**
 * Registra um evento de analytics.
 */
export const trackEvent = async (
  eventData: Omit<FirebaseAnalyticsEvent, "id" | "timestamp">
): Promise<FirebaseAnalyticsEvent> => {
  const eventRef = db.collection(ANALYTICS_EVENTS_COLLECTION).doc();
  const now = Timestamp.now();

  const newEvent: FirebaseAnalyticsEvent = {
    id: eventRef.id,
    ...eventData,
    timestamp: now,
  };

  await eventRef.set(newEvent);
  return newEvent;
};

/**
 * Registra um evento de visualização de página.
 */
export const trackPageView = async (
  url: string,
  userId?: string,
  sessionId?: string,
  referrer?: string,
  userAgent?: string,
  ipAddress?: string,
  deviceInfo?: Record<string, any>,
  geoInfo?: FirebaseAnalyticsEvent["geoInfo"]
): Promise<FirebaseAnalyticsEvent> => {
  return trackEvent({
    userId,
    sessionId,
    type: FirebaseEventType.PAGE_VIEW,
    name: "page_view",
    properties: { path: url },
    url,
    referrer,
    userAgent,
    ipAddress,
    deviceInfo,
    geoInfo
  });
};

/**
 * Inicia uma nova sessão de usuário.
 */
export const startUserSession = async (
  sessionData: Omit<FirebaseUserSession, "id" | "startTime" | "isActive">
): Promise<FirebaseUserSession> => {
  const sessionRef = db.collection(USER_SESSIONS_COLLECTION).doc();
  const now = Timestamp.now();

  const newSession: FirebaseUserSession = {
    id: sessionRef.id,
    ...sessionData,
    startTime: now,
    isActive: true,
    pageViews: 1 // Iniciar com 1 visualização de página
  };

  await sessionRef.set(newSession);
  return newSession;
};

/**
 * Finaliza uma sessão de usuário.
 */
export const endUserSession = async (
  sessionId: string,
  exitPage?: string,
  pageViews?: number
): Promise<FirebaseUserSession | null> => {
  const sessionRef = db.collection(USER_SESSIONS_COLLECTION).doc(sessionId);
  const now = Timestamp.now();
  
  try {
    // Obter a sessão atual
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      console.warn(`Sessão (ID: ${sessionId}) não encontrada.`);
      return null;
    }
    
    const session = sessionDoc.data() as FirebaseUserSession;
    
    // Calcular a duração da sessão
    const duration = Math.floor((now.toMillis() - session.startTime.toMillis()) / 1000);
    
    // Atualizar a sessão
    const updates: Partial<FirebaseUserSession> = {
      endTime: now,
      duration,
      isActive: false
    };
    
    if (exitPage) {
      updates.exitPage = exitPage;
    }
    
    if (pageViews !== undefined) {
      updates.pageViews = pageViews;
    }
    
    await sessionRef.update(updates);
    
    // Retornar a sessão atualizada
    const updatedDoc = await sessionRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseUserSession : null;
  } catch (error) {
    console.error(`Erro ao finalizar sessão (ID: ${sessionId}):`, error);
    throw error;
  }
};

/**
 * Atualiza uma sessão de usuário existente.
 */
export const updateUserSession = async (
  sessionId: string,
  updates: Partial<Omit<FirebaseUserSession, "id" | "startTime">>
): Promise<FirebaseUserSession | null> => {
  const sessionRef = db.collection(USER_SESSIONS_COLLECTION).doc(sessionId);
  
  try {
    await sessionRef.update(updates);
    
    // Retornar a sessão atualizada
    const updatedDoc = await sessionRef.get();
    return updatedDoc.exists ? updatedDoc.data() as FirebaseUserSession : null;
  } catch (error) {
    console.error(`Erro ao atualizar sessão (ID: ${sessionId}):`, error);
    throw error;
  }
};

/**
 * Incrementa o contador de visualizações de página de uma sessão.
 */
export const incrementSessionPageViews = async (sessionId: string): Promise<number> => {
  const sessionRef = db.collection(USER_SESSIONS_COLLECTION).doc(sessionId);
  
  try {
    // Usar transação para garantir atomicidade
    const result = await db.runTransaction(async (transaction) => {
      const sessionDoc = await transaction.get(sessionRef);
      
      if (!sessionDoc.exists) {
        throw new Error(`Sessão (ID: ${sessionId}) não encontrada.`);
      }
      
      const session = sessionDoc.data() as FirebaseUserSession;
      const currentPageViews = session.pageViews || 0;
      const newPageViews = currentPageViews + 1;
      
      transaction.update(sessionRef, { pageViews: newPageViews });
      
      return newPageViews;
    });
    
    return result;
  } catch (error) {
    console.error(`Erro ao incrementar visualizações de página da sessão (ID: ${sessionId}):`, error);
    throw error;
  }
};

/**
 * Busca eventos de analytics com opções de filtro.
 */
export const getAnalyticsEvents = async (
  options: {
    userId?: string;
    sessionId?: string;
    type?: FirebaseEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ events: FirebaseAnalyticsEvent[]; total: number }> => {
  try {
    let query = db.collection(ANALYTICS_EVENTS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.sessionId) {
      query = query.where("sessionId", "==", options.sessionId);
    }
    
    if (options.type) {
      query = query.where("type", "==", options.type);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("timestamp", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("timestamp", "<=", endTimestamp);
    }
    
    // Ordenar por timestamp (mais recentes primeiro)
    query = query.orderBy("timestamp", "desc");
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const events: FirebaseAnalyticsEvent[] = [];
    snapshot.forEach(doc => {
      events.push(doc.data() as FirebaseAnalyticsEvent);
    });
    
    return { events, total };
  } catch (error) {
    console.error(`Erro ao buscar eventos de analytics:`, error);
    throw error;
  }
};

/**
 * Busca sessões de usuário com opções de filtro.
 */
export const getUserSessions = async (
  options: {
    userId?: string;
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ sessions: FirebaseUserSession[]; total: number }> => {
  try {
    let query = db.collection(USER_SESSIONS_COLLECTION);
    
    // Aplicar filtros
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }
    
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    // Filtrar por intervalo de datas
    if (options.startDate) {
      const startTimestamp = Timestamp.fromDate(options.startDate);
      query = query.where("startTime", ">=", startTimestamp);
    }
    
    if (options.endDate) {
      const endTimestamp = Timestamp.fromDate(options.endDate);
      query = query.where("startTime", "<=", endTimestamp);
    }
    
    // Ordenar por startTime (mais recentes primeiro)
    query = query.orderBy("startTime", "desc");
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    const sessions: FirebaseUserSession[] = [];
    snapshot.forEach(doc => {
      sessions.push(doc.data() as FirebaseUserSession);
    });
    
    return { sessions, total };
  } catch (error) {
    console.error(`Erro ao buscar sessões de usuário:`, error);
    throw error;
  }
};

/**
 * Gera ou atualiza estatísticas diárias de analytics.
 * Esta função deve ser executada periodicamente (por exemplo, uma vez por dia).
 */
export const generateDailyStats = async (date: Date): Promise<FirebaseAnalyticsDailyStats> => {
  try {
    // Formatar a data como YYYY-MM-DD
    const dateString = date.toISOString().split('T')[0];
    
    // Definir o intervalo de tempo para o dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);
    
    // 1. Contar usuários únicos e novos
    const usersSnapshot = await db.collection(USER_SESSIONS_COLLECTION)
      .where("startTime", ">=", startTimestamp)
      .where("startTime", "<=", endTimestamp)
      .get();
    
    const uniqueUserIds = new Set<string>();
    usersSnapshot.forEach(doc => {
      const session = doc.data() as FirebaseUserSession;
      if (session.userId) {
        uniqueUserIds.add(session.userId);
      }
    });
    
    // Para novos usuários, precisaríamos verificar se é a primeira sessão do usuário
    // Esta é uma simplificação
    const newUsersCount = 0; // Implementação completa requer consulta adicional
    
    // 2. Contar sessões totais
    const totalSessions = usersSnapshot.size;
    
    // 3. Contar visualizações de página
    const pageViewsSnapshot = await db.collection(ANALYTICS_EVENTS_COLLECTION)
      .where("type", "==", FirebaseEventType.PAGE_VIEW)
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .get();
    
    const totalPageViews = pageViewsSnapshot.size;
    
    // 4. Contar eventos totais
    const eventsSnapshot = await db.collection(ANALYTICS_EVENTS_COLLECTION)
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .get();
    
    const totalEvents = eventsSnapshot.size;
    
    // 5. Calcular duração média da sessão
    let totalDuration = 0;
    let sessionsWithDuration = 0;
    
    usersSnapshot.forEach(doc => {
      const session = doc.data() as FirebaseUserSession;
      if (session.duration) {
        totalDuration += session.duration;
        sessionsWithDuration++;
      }
    });
    
    const avgSessionDuration = sessionsWithDuration > 0 ? totalDuration / sessionsWithDuration : 0;
    
    // 6. Calcular taxa de rejeição (sessões com apenas 1 visualização de página)
    let bounceSessions = 0;
    
    usersSnapshot.forEach(doc => {
      const session = doc.data() as FirebaseUserSession;
      if (session.pageViews === 1) {
        bounceSessions++;
      }
    });
    
    const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;
    
    // 7. Calcular páginas mais visitadas
    const pageCountMap = new Map<string, number>();
    
    pageViewsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseAnalyticsEvent;
      if (event.url) {
        const count = pageCountMap.get(event.url) || 0;
        pageCountMap.set(event.url, count + 1);
      }
    });
    
    const topPages = Array.from(pageCountMap.entries())
      .map(([url, views]) => ({ url, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
    
    // 8. Calcular principais referenciadores
    const referrerCountMap = new Map<string, number>();
    
    pageViewsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseAnalyticsEvent;
      if (event.referrer) {
        const count = referrerCountMap.get(event.referrer) || 0;
        referrerCountMap.set(event.referrer, count + 1);
      }
    });
    
    const topReferrers = Array.from(referrerCountMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 9. Calcular principais países
    const countryCountMap = new Map<string, number>();
    
    eventsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseAnalyticsEvent;
      if (event.geoInfo?.country) {
        const count = countryCountMap.get(event.geoInfo.country) || 0;
        countryCountMap.set(event.geoInfo.country, count + 1);
      }
    });
    
    const topCountries = Array.from(countryCountMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 10. Calcular principais dispositivos
    const deviceCountMap = new Map<string, number>();
    
    eventsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseAnalyticsEvent;
      if (event.deviceInfo?.deviceType) {
        const count = deviceCountMap.get(event.deviceInfo.deviceType) || 0;
        deviceCountMap.set(event.deviceInfo.deviceType, count + 1);
      }
    });
    
    const topDevices = Array.from(deviceCountMap.entries())
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 11. Calcular principais navegadores
    const browserCountMap = new Map<string, number>();
    
    eventsSnapshot.forEach(doc => {
      const event = doc.data() as FirebaseAnalyticsEvent;
      if (event.deviceInfo?.browser) {
        const count = browserCountMap.get(event.deviceInfo.browser) || 0;
        browserCountMap.set(event.deviceInfo.browser, count + 1);
      }
    });
    
    const topBrowsers = Array.from(browserCountMap.entries())
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 12. Criar ou atualizar o documento de estatísticas diárias
    const statsRef = db.collection(DAILY_STATS_COLLECTION).doc(dateString);
    const now = Timestamp.now();
    
    const stats: FirebaseAnalyticsDailyStats = {
      id: dateString,
      date: dateString,
      uniqueUsers: uniqueUserIds.size,
      newUsers: newUsersCount,
      totalSessions,
      totalPageViews,
      totalEvents,
      avgSessionDuration,
      bounceRate,
      topPages,
      topReferrers,
      topCountries,
      topDevices,
      topBrowsers,
      updatedAt: now
    };
    
    await statsRef.set(stats);
    console.log(`Estatísticas diárias para ${dateString} geradas com sucesso.`);
    
    return stats;
  } catch (error) {
    console.error(`Erro ao gerar estatísticas diárias:`, error);
    throw error;
  }
};

/**
 * Busca estatísticas diárias de analytics.
 */
export const getDailyStats = async (
  startDate: string,
  endDate: string
): Promise<FirebaseAnalyticsDailyStats[]> => {
  try {
    const snapshot = await db.collection(DAILY_STATS_COLLECTION)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .orderBy("date", "asc")
      .get();
    
    const stats: FirebaseAnalyticsDailyStats[] = [];
    snapshot.forEach(doc => {
      stats.push(doc.data() as FirebaseAnalyticsDailyStats);
    });
    
    return stats;
  } catch (error) {
    console.error(`Erro ao buscar estatísticas diárias:`, error);
    throw error;
  }
};

/**
 * Limpa eventos de analytics antigos.
 * Esta função deve ser executada periodicamente para manter o tamanho do banco de dados sob controle.
 */
export const cleanupOldAnalyticsEvents = async (olderThan: Date): Promise<number> => {
  try {
    const olderThanTimestamp = Timestamp.fromDate(olderThan);
    
    // Devido a limitações do Firestore, precisamos buscar todos os documentos primeiro
    const snapshot = await db.collection(ANALYTICS_EVENTS_COLLECTION)
      .where("timestamp", "<", olderThanTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log(`Nenhum evento de analytics encontrado anterior a ${olderThan.toISOString()}.`);
      return 0;
    }
    
    // Excluir em lotes de 500 (limite do Firestore)
    const batchSize = 500;
    const totalEvents = snapshot.size;
    let processedEvents = 0;
    
    while (processedEvents < totalEvents) {
      const batch = db.batch();
      const currentBatch = snapshot.docs.slice(processedEvents, processedEvents + batchSize);
      
      currentBatch.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      processedEvents += currentBatch.length;
      console.log(`Processados ${processedEvents}/${totalEvents} eventos de analytics antigos.`);
    }
    
    console.log(`${totalEvents} eventos de analytics anteriores a ${olderThan.toISOString()} excluídos.`);
    return totalEvents;
  } catch (error) {
    console.error(`Erro ao limpar eventos de analytics antigos:`, error);
    throw error;
  }
};