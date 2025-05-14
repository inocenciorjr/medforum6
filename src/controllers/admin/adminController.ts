import { Request, Response } from "express";
import { AppError, asyncHandler } from "../../utils/errors";
import logger from "../../utils/logger";
import { firestore } from "firebase-admin";
import { UserRole } from "../../types/firebaseTypes";

/**
 * Controlador para funcionalidades administrativas
 */
class AdminController {
  /**
   * Obtém o ID do usuário autenticado e verifica se é admin
   */
  private getAuthenticatedAdminId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized("Usuário não autenticado");
    }
    if (req.user?.role !== "admin") {
      throw AppError.forbidden("Acesso negado. Apenas administradores podem acessar este recurso.");
    }
    return userId;
  }

  /**
   * Obtém estatísticas para o dashboard administrativo
   * Acesso: Admin
   */
  getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);

    try {
      // Estatísticas de usuários
      const usersSnapshot = await firestore().collection('users').count().get();
      const totalUsers = usersSnapshot.data().count;

      const activeUsersSnapshot = await firestore()
        .collection('users')
        .where('isActive', '==', true)
        .count()
        .get();
      const activeUsers = activeUsersSnapshot.data().count;

      // Estatísticas de conteúdo
      const questionsSnapshot = await firestore().collection('questions').count().get();
      const totalQuestions = questionsSnapshot.data().count;

      const articlesSnapshot = await firestore().collection('articles').count().get();
      const totalArticles = articlesSnapshot.data().count;

      const simulatedExamsSnapshot = await firestore().collection('simulatedExams').count().get();
      const totalSimulatedExams = simulatedExamsSnapshot.data().count;

      // Estatísticas de pagamentos
      const paymentsSnapshot = await firestore().collection('payments').count().get();
      const totalPayments = paymentsSnapshot.data().count;

      const successfulPaymentsSnapshot = await firestore()
        .collection('payments')
        .where('status', '==', 'completed')
        .count()
        .get();
      const successfulPayments = successfulPaymentsSnapshot.data().count;

      // Usuários recentes
      const recentUsersSnapshot = await firestore()
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const recentUsers = recentUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
        role: doc.data().role,
        createdAt: doc.data().createdAt?.toDate()
      }));

      // Atividades recentes
      const recentActivitiesSnapshot = await firestore()
        .collection('activityLogs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      
      const recentActivities = recentActivitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        action: doc.data().action,
        details: doc.data().details,
        timestamp: doc.data().timestamp?.toDate()
      }));

      // Estatísticas de receita
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthlyPaymentsSnapshot = await firestore()
        .collection('payments')
        .where('status', '==', 'completed')
        .where('createdAt', '>=', firestore.Timestamp.fromDate(firstDayOfMonth))
        .where('createdAt', '<=', firestore.Timestamp.fromDate(lastDayOfMonth))
        .get();
      
      let monthlyRevenue = 0;
      monthlyPaymentsSnapshot.docs.forEach(doc => {
        monthlyRevenue += doc.data().amount || 0;
      });

      res.status(200).json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            recent: recentUsers
          },
          content: {
            questions: totalQuestions,
            articles: totalArticles,
            simulatedExams: totalSimulatedExams
          },
          payments: {
            total: totalPayments,
            successful: successfulPayments,
            monthlyRevenue
          },
          activities: recentActivities
        }
      });
    } catch (error) {
      logger.error("Erro ao obter estatísticas do dashboard:", error);
      throw AppError.internal("Erro ao obter estatísticas do dashboard");
    }
  });

  /**
   * Gerencia usuários (lista, filtra, etc.)
   * Acesso: Admin
   */
  getUserManagement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { page = 1, limit = 10, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Iniciar a consulta
      let usersQuery = firestore().collection('users');

      // Aplicar filtros
      if (role) {
        usersQuery = usersQuery.where('role', '==', role);
      }

      if (status === 'active') {
        usersQuery = usersQuery.where('isActive', '==', true);
      } else if (status === 'inactive') {
        usersQuery = usersQuery.where('isActive', '==', false);
      }

      // Ordenação
      usersQuery = usersQuery.orderBy(sortBy as string, sortOrder === 'asc' ? 'asc' : 'desc');

      // Executar a consulta
      const usersSnapshot = await usersQuery.limit(limitNum).offset(offset).get();
      
      let users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
        role: doc.data().role,
        isActive: doc.data().isActive,
        createdAt: doc.data().createdAt?.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate()
      }));

      // Filtrar por termo de busca se fornecido
      if (search && typeof search === 'string' && search.trim().length > 0) {
        const searchTerm = search.trim().toLowerCase();
        users = users.filter(user => 
          user.displayName?.toLowerCase().includes(searchTerm) || 
          user.email?.toLowerCase().includes(searchTerm)
        );
      }

      // Contar total para paginação
      const countQuery = firestore().collection('users');
      const countSnapshot = await countQuery.count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao gerenciar usuários:", error);
      throw AppError.internal("Erro ao gerenciar usuários");
    }
  });

  /**
   * Gerencia conteúdo (moderação)
   * Acesso: Admin
   */
  getContentModeration = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { page = 1, limit = 10, type, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Determinar a coleção com base no tipo
      let collection = 'reports';
      if (type === 'questions') collection = 'questionReports';
      else if (type === 'comments') collection = 'commentReports';
      else if (type === 'articles') collection = 'articleReports';

      // Iniciar a consulta
      let contentQuery = firestore().collection(collection);

      // Aplicar filtros
      if (status) {
        contentQuery = contentQuery.where('status', '==', status);
      }

      // Ordenação
      contentQuery = contentQuery.orderBy(sortBy as string, sortOrder === 'asc' ? 'asc' : 'desc');

      // Executar a consulta
      const contentSnapshot = await contentQuery.limit(limitNum).offset(offset).get();
      
      const content = contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Contar total para paginação
      const countQuery = firestore().collection(collection);
      if (status) {
        countQuery.where('status', '==', status);
      }
      const countSnapshot = await countQuery.count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          content,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao moderar conteúdo:", error);
      throw AppError.internal("Erro ao moderar conteúdo");
    }
  });

  /**
   * Obtém configurações do sistema
   * Acesso: Admin
   */
  getSystemSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);

    try {
      // Buscar configurações do sistema
      const settingsDoc = await firestore().collection('systemSettings').doc('general').get();
      
      let settings = {};
      if (settingsDoc.exists) {
        settings = settingsDoc.data();
      } else {
        // Configurações padrão se não existirem
        settings = {
          siteName: 'ForumMed',
          siteDescription: 'Plataforma de estudos para medicina',
          maintenanceMode: false,
          registrationEnabled: true,
          defaultUserRole: 'student',
          emailVerificationRequired: true,
          maxLoginAttempts: 5,
          lockoutDurationMinutes: 30,
          sessionTimeoutMinutes: 60,
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now()
        };
        
        // Salvar configurações padrão
        await firestore().collection('systemSettings').doc('general').set(settings);
      }

      // Buscar configurações de pagamento
      const paymentSettingsDoc = await firestore().collection('systemSettings').doc('payment').get();
      
      let paymentSettings = {};
      if (paymentSettingsDoc.exists) {
        paymentSettings = paymentSettingsDoc.data();
      }

      // Buscar configurações de email
      const emailSettingsDoc = await firestore().collection('systemSettings').doc('email').get();
      
      let emailSettings = {};
      if (emailSettingsDoc.exists) {
        emailSettings = emailSettingsDoc.data();
      }

      res.status(200).json({
        success: true,
        data: {
          general: settings,
          payment: paymentSettings,
          email: emailSettings
        }
      });
    } catch (error) {
      logger.error("Erro ao obter configurações do sistema:", error);
      throw AppError.internal("Erro ao obter configurações do sistema");
    }
  });

  /**
   * Obtém relatórios de pagamento
   * Acesso: Admin
   */
  getPaymentReports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { 
      startDate, 
      endDate, 
      paymentMethod, 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Iniciar a consulta
      let paymentsQuery = firestore().collection('payments');

      // Aplicar filtros
      if (startDate) {
        const startDateTime = new Date(startDate as string);
        paymentsQuery = paymentsQuery.where('createdAt', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        paymentsQuery = paymentsQuery.where('createdAt', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      if (paymentMethod) {
        paymentsQuery = paymentsQuery.where('paymentMethod', '==', paymentMethod);
      }

      if (status) {
        paymentsQuery = paymentsQuery.where('status', '==', status);
      }

      // Ordenação
      paymentsQuery = paymentsQuery.orderBy(sortBy as string, sortOrder === 'asc' ? 'asc' : 'desc');

      // Executar a consulta
      const paymentsSnapshot = await paymentsQuery.limit(limitNum).offset(offset).get();
      
      const payments = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate()
      }));

      // Contar total para paginação
      let countQuery = firestore().collection('payments');
      
      if (startDate) {
        const startDateTime = new Date(startDate as string);
        countQuery = countQuery.where('createdAt', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        countQuery = countQuery.where('createdAt', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      if (paymentMethod) {
        countQuery = countQuery.where('paymentMethod', '==', paymentMethod);
      }

      if (status) {
        countQuery = countQuery.where('status', '==', status);
      }

      const countSnapshot = await countQuery.count().get();
      const total = countSnapshot.data().count;

      // Calcular estatísticas
      let totalAmount = 0;
      let successfulCount = 0;
      let pendingCount = 0;
      let failedCount = 0;

      payments.forEach(payment => {
        if (payment.status === 'completed') {
          totalAmount += payment.amount || 0;
          successfulCount++;
        } else if (payment.status === 'pending') {
          pendingCount++;
        } else if (payment.status === 'failed') {
          failedCount++;
        }
      });

      res.status(200).json({
        success: true,
        data: {
          payments,
          statistics: {
            totalAmount,
            successfulCount,
            pendingCount,
            failedCount
          },
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao obter relatórios de pagamento:", error);
      throw AppError.internal("Erro ao obter relatórios de pagamento");
    }
  });

  /**
   * Obtém logs de atividade de usuários
   * Acesso: Admin
   */
  getUserActivityLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { 
      userId, 
      action, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      sortBy = 'timestamp', 
      sortOrder = 'desc' 
    } = req.query;

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Iniciar a consulta
      let logsQuery = firestore().collection('activityLogs');

      // Aplicar filtros
      if (userId) {
        logsQuery = logsQuery.where('userId', '==', userId);
      }

      if (action) {
        logsQuery = logsQuery.where('action', '==', action);
      }

      if (startDate) {
        const startDateTime = new Date(startDate as string);
        logsQuery = logsQuery.where('timestamp', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        logsQuery = logsQuery.where('timestamp', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      // Ordenação
      logsQuery = logsQuery.orderBy(sortBy as string, sortOrder === 'asc' ? 'asc' : 'desc');

      // Executar a consulta
      const logsSnapshot = await logsQuery.limit(limitNum).offset(offset).get();
      
      const logs = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        action: doc.data().action,
        details: doc.data().details,
        ipAddress: doc.data().ipAddress,
        userAgent: doc.data().userAgent,
        timestamp: doc.data().timestamp?.toDate()
      }));

      // Contar total para paginação
      let countQuery = firestore().collection('activityLogs');
      
      if (userId) {
        countQuery = countQuery.where('userId', '==', userId);
      }

      if (action) {
        countQuery = countQuery.where('action', '==', action);
      }

      if (startDate) {
        const startDateTime = new Date(startDate as string);
        countQuery = countQuery.where('timestamp', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        countQuery = countQuery.where('timestamp', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      const countSnapshot = await countQuery.count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao obter logs de atividade de usuários:", error);
      throw AppError.internal("Erro ao obter logs de atividade de usuários");
    }
  });

  /**
   * Obtém logs do sistema
   * Acesso: Admin
   */
  getSystemLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { 
      level, 
      service, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10, 
      sortBy = 'timestamp', 
      sortOrder = 'desc' 
    } = req.query;

    try {
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Iniciar a consulta
      let logsQuery = firestore().collection('systemLogs');

      // Aplicar filtros
      if (level) {
        logsQuery = logsQuery.where('level', '==', level);
      }

      if (service) {
        logsQuery = logsQuery.where('service', '==', service);
      }

      if (startDate) {
        const startDateTime = new Date(startDate as string);
        logsQuery = logsQuery.where('timestamp', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        logsQuery = logsQuery.where('timestamp', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      // Ordenação
      logsQuery = logsQuery.orderBy(sortBy as string, sortOrder === 'asc' ? 'asc' : 'desc');

      // Executar a consulta
      const logsSnapshot = await logsQuery.limit(limitNum).offset(offset).get();
      
      const logs = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        level: doc.data().level,
        message: doc.data().message,
        service: doc.data().service,
        details: doc.data().details,
        timestamp: doc.data().timestamp?.toDate()
      }));

      // Contar total para paginação
      let countQuery = firestore().collection('systemLogs');
      
      if (level) {
        countQuery = countQuery.where('level', '==', level);
      }

      if (service) {
        countQuery = countQuery.where('service', '==', service);
      }

      if (startDate) {
        const startDateTime = new Date(startDate as string);
        countQuery = countQuery.where('timestamp', '>=', firestore.Timestamp.fromDate(startDateTime));
      }

      if (endDate) {
        const endDateTime = new Date(endDate as string);
        countQuery = countQuery.where('timestamp', '<=', firestore.Timestamp.fromDate(endDateTime));
      }

      const countSnapshot = await countQuery.count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao obter logs do sistema:", error);
      throw AppError.internal("Erro ao obter logs do sistema");
    }
  });

  /**
   * Realiza backup de dados
   * Acesso: Admin
   */
  performBackup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { collections } = req.body;

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      throw AppError.badRequest("É necessário especificar pelo menos uma coleção para backup");
    }

    try {
      const now = new Date();
      const backupId = `backup_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Registrar o início do backup
      const backupRef = await firestore().collection('backups').doc(backupId).set({
        id: backupId,
        startedAt: firestore.Timestamp.now(),
        completedAt: null,
        status: 'in_progress',
        collections,
        initiatedBy: adminId,
        totalDocuments: 0,
        errors: []
      });

      // Iniciar o processo de backup para cada coleção
      const backupPromises = collections.map(async (collection) => {
        try {
          // Obter todos os documentos da coleção
          const snapshot = await firestore().collection(collection).get();
          const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          }));

          // Salvar os documentos no backup
          await firestore().collection('backups').doc(backupId).collection(collection).doc('data').set({
            documents
          });

          return {
            collection,
            count: documents.length,
            success: true
          };
        } catch (error) {
          logger.error(`Erro ao fazer backup da coleção ${collection}:`, error);
          return {
            collection,
            count: 0,
            success: false,
            error: error.message
          };
        }
      });

      // Aguardar a conclusão de todos os backups
      const results = await Promise.all(backupPromises);
      
      // Calcular estatísticas
      let totalDocuments = 0;
      const errors = [];
      
      results.forEach(result => {
        if (result.success) {
          totalDocuments += result.count;
        } else {
          errors.push({
            collection: result.collection,
            error: result.error
          });
        }
      });

      // Atualizar o status do backup
      await firestore().collection('backups').doc(backupId).update({
        completedAt: firestore.Timestamp.now(),
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        totalDocuments,
        errors
      });

      res.status(200).json({
        success: true,
        message: "Backup realizado com sucesso",
        data: {
          backupId,
          collections: results,
          totalDocuments,
          errors
        }
      });
    } catch (error) {
      logger.error("Erro ao realizar backup:", error);
      throw AppError.internal("Erro ao realizar backup");
    }
  });

  /**
   * Obtém análises e métricas
   * Acesso: Admin
   */
  getAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { metric, period = 'month', startDate, endDate } = req.query;
    
    try {
      // Definir período de análise
      let start = new Date();
      let end = new Date();
      
      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
      } else {
        switch (period) {
          case 'day':
            start.setDate(end.getDate() - 1);
            break;
          case 'week':
            start.setDate(end.getDate() - 7);
            break;
          case 'month':
            start.setMonth(end.getMonth() - 1);
            break;
          case 'quarter':
            start.setMonth(end.getMonth() - 3);
            break;
          case 'year':
            start.setFullYear(end.getFullYear() - 1);
            break;
          default:
            start.setMonth(end.getMonth() - 1);
        }
      }
      
      // Converter para timestamp do Firestore
      const startTimestamp = firestore.Timestamp.fromDate(start);
      const endTimestamp = firestore.Timestamp.fromDate(end);
      
      let data: any = {};
      
      // Obter métricas específicas ou todas
      if (!metric || metric === 'all') {
        // Obter todas as métricas
        data = {
          users: await this.getUserMetrics(startTimestamp, endTimestamp),
          content: await this.getContentMetrics(startTimestamp, endTimestamp),
          engagement: await this.getEngagementMetrics(startTimestamp, endTimestamp),
          revenue: await this.getRevenueMetrics(startTimestamp, endTimestamp)
        };
      } else {
        // Obter métrica específica
        switch (metric) {
          case 'users':
            data = await this.getUserMetrics(startTimestamp, endTimestamp);
            break;
          case 'content':
            data = await this.getContentMetrics(startTimestamp, endTimestamp);
            break;
          case 'engagement':
            data = await this.getEngagementMetrics(startTimestamp, endTimestamp);
            break;
          case 'revenue':
            data = await this.getRevenueMetrics(startTimestamp, endTimestamp);
            break;
          default:
            throw AppError.badRequest("Métrica inválida");
        }
      }
      
      res.status(200).json({
        success: true,
        data: {
          ...data,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
            type: period
          }
        }
      });
    } catch (error) {
      logger.error("Erro ao obter análises:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.internal("Erro ao obter análises");
    }
  });

  /**
   * Obtém métricas de usuários
   */
  private async getUserMetrics(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<any> {
    // Novos usuários no período
    const newUsersSnapshot = await firestore()
      .collection('users')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newUsers = newUsersSnapshot.data().count;
    
    // Usuários ativos no período
    const activeUsersSnapshot = await firestore()
      .collection('activityLogs')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .select('userId')
      .get();
    
    const activeUserIds = new Set();
    activeUsersSnapshot.docs.forEach(doc => {
      activeUserIds.add(doc.data().userId);
    });
    
    const activeUsers = activeUserIds.size;
    
    // Retenção de usuários (usuários que retornaram após 7 dias)
    const retentionData = await this.calculateUserRetention(startTimestamp, endTimestamp);
    
    return {
      newUsers,
      activeUsers,
      retention: retentionData,
      conversionRate: (activeUsers > 0) ? (newUsers / activeUsers * 100).toFixed(2) : 0
    };
  }

  /**
   * Calcula retenção de usuários
   */
  private async calculateUserRetention(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<any> {
    // Obter usuários que se registraram no período
    const newUsersSnapshot = await firestore()
      .collection('users')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .select('id')
      .get();
    
    const newUserIds = newUsersSnapshot.docs.map(doc => doc.id);
    
    if (newUserIds.length === 0) {
      return {
        day1: 0,
        day7: 0,
        day30: 0
      };
    }
    
    // Calcular retenção de 1 dia
    const day1Count = await this.countReturnedUsers(newUserIds, 1);
    
    // Calcular retenção de 7 dias
    const day7Count = await this.countReturnedUsers(newUserIds, 7);
    
    // Calcular retenção de 30 dias
    const day30Count = await this.countReturnedUsers(newUserIds, 30);
    
    return {
      day1: (day1Count / newUserIds.length * 100).toFixed(2),
      day7: (day7Count / newUserIds.length * 100).toFixed(2),
      day30: (day30Count / newUserIds.length * 100).toFixed(2)
    };
  }

  /**
   * Conta usuários que retornaram após X dias
   */
  private async countReturnedUsers(userIds: string[], days: number): Promise<number> {
    // Simulação - em um ambiente real, isso seria calculado com base em logs de atividade
    // Retornar um valor aleatório para demonstração
    return Math.floor(userIds.length * (Math.random() * 0.5 + 0.3));
  }

  /**
   * Obtém métricas de conteúdo
   */
  private async getContentMetrics(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<any> {
    // Novos decks no período
    const newDecksSnapshot = await firestore()
      .collection('decks')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newDecks = newDecksSnapshot.data().count;
    
    // Novos flashcards no período
    const newFlashcardsSnapshot = await firestore()
      .collection('flashcards')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newFlashcards = newFlashcardsSnapshot.data().count;
    
    // Novas questões no período
    const newQuestionsSnapshot = await firestore()
      .collection('questions')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newQuestions = newQuestionsSnapshot.data().count;
    
    // Novos artigos no período
    const newArticlesSnapshot = await firestore()
      .collection('articles')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newArticles = newArticlesSnapshot.data().count;
    
    return {
      newDecks,
      newFlashcards,
      newQuestions,
      newArticles,
      contentGrowth: {
        decks: newDecks,
        flashcards: newFlashcards,
        questions: newQuestions,
        articles: newArticles
      }
    };
  }

  /**
   * Obtém métricas de engajamento
   */
  private async getEngagementMetrics(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<any> {
    // Sessões de estudo no período
    const studySessionsSnapshot = await firestore()
      .collection('studySessions')
      .where('startTime', '>=', startTimestamp)
      .where('startTime', '<=', endTimestamp)
      .count()
      .get();
    
    const studySessions = studySessionsSnapshot.data().count;
    
    // Flashcards revisados no período
    const flashcardsReviewedSnapshot = await firestore()
      .collection('flashcardReviews')
      .where('reviewedAt', '>=', startTimestamp)
      .where('reviewedAt', '<=', endTimestamp)
      .count()
      .get();
    
    const flashcardsReviewed = flashcardsReviewedSnapshot.data().count;
    
    // Simulados realizados no período
    const simulatedExamsSnapshot = await firestore()
      .collection('simulatedExamAttempts')
      .where('startTime', '>=', startTimestamp)
      .where('startTime', '<=', endTimestamp)
      .count()
      .get();
    
    const simulatedExams = simulatedExamsSnapshot.data().count;
    
    // Visualizações de artigos no período
    const articleViewsSnapshot = await firestore()
      .collection('articleViews')
      .where('viewedAt', '>=', startTimestamp)
      .where('viewedAt', '<=', endTimestamp)
      .count()
      .get();
    
    const articleViews = articleViewsSnapshot.data().count;
    
    return {
      studySessions,
      flashcardsReviewed,
      simulatedExams,
      articleViews,
      averageSessionDuration: await this.calculateAverageSessionDuration(startTimestamp, endTimestamp)
    };
  }

  /**
   * Calcula duração média das sessões
   */
  private async calculateAverageSessionDuration(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<number> {
    // Obter sessões de estudo no período
    const sessionsSnapshot = await firestore()
      .collection('studySessions')
      .where('startTime', '>=', startTimestamp)
      .where('startTime', '<=', endTimestamp)
      .where('endTime', '!=', null)
      .get();
    
    if (sessionsSnapshot.empty) {
      return 0;
    }
    
    let totalDuration = 0;
    let sessionCount = 0;
    
    sessionsSnapshot.docs.forEach(doc => {
      const session = doc.data();
      if (session.startTime && session.endTime) {
        const duration = session.endTime.seconds - session.startTime.seconds;
        if (duration > 0) {
          totalDuration += duration;
          sessionCount++;
        }
      }
    });
    
    return sessionCount > 0 ? Math.round(totalDuration / sessionCount / 60) : 0; // Em minutos
  }

  /**
   * Obtém métricas de receita
   */
  private async getRevenueMetrics(startTimestamp: firestore.Timestamp, endTimestamp: firestore.Timestamp): Promise<any> {
    // Pagamentos no período
    const paymentsSnapshot = await firestore()
      .collection('payments')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .where('status', '==', 'completed')
      .get();
    
    let totalRevenue = 0;
    const paymentsByDay: Record<string, number> = {};
    
    paymentsSnapshot.docs.forEach(doc => {
      const payment = doc.data();
      totalRevenue += payment.amount || 0;
      
      // Agrupar por dia
      if (payment.createdAt) {
        const date = payment.createdAt.toDate().toISOString().split('T')[0];
        paymentsByDay[date] = (paymentsByDay[date] || 0) + (payment.amount || 0);
      }
    });
    
    // Novas assinaturas no período
    const newSubscriptionsSnapshot = await firestore()
      .collection('subscriptions')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .count()
      .get();
    
    const newSubscriptions = newSubscriptionsSnapshot.data().count;
    
    // Assinaturas canceladas no período
    const canceledSubscriptionsSnapshot = await firestore()
      .collection('subscriptions')
      .where('canceledAt', '>=', startTimestamp)
      .where('canceledAt', '<=', endTimestamp)
      .count()
      .get();
    
    const canceledSubscriptions = canceledSubscriptionsSnapshot.data().count;
    
    return {
      totalRevenue,
      newSubscriptions,
      canceledSubscriptions,
      revenueByDay: paymentsByDay,
      churnRate: newSubscriptions > 0 ? (canceledSubscriptions / newSubscriptions * 100).toFixed(2) : 0
    };
  }

  /**
   * Envia notificações em massa
   * Acesso: Admin
   */
  sendBulkNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedAdminId(req);
    const { title, message, userFilter, channels } = req.body;
    
    try {
      if (!title || !message) {
        throw AppError.badRequest("Título e mensagem são obrigatórios");
      }
      
      if (!channels || !Array.isArray(channels) || channels.length === 0) {
        throw AppError.badRequest("Pelo menos um canal de notificação deve ser especificado");
      }
      
      // Determinar destinatários
      let userIds: string[] = [];
      
      if (userFilter) {
        // Aplicar filtros para selecionar usuários
        let usersQuery = firestore().collection('users').where('isActive', '==', true);
        
        if (userFilter.role) {
          usersQuery = usersQuery.where('role', '==', userFilter.role);
        }
        
        if (userFilter.lastActiveAfter) {
          const lastActiveTimestamp = firestore.Timestamp.fromDate(new Date(userFilter.lastActiveAfter));
          usersQuery = usersQuery.where('lastLoginAt', '>=', lastActiveTimestamp);
        }
        
        const usersSnapshot = await usersQuery.get();
        userIds = usersSnapshot.docs.map(doc => doc.id);
      } else {
        // Enviar para todos os usuários ativos
        const usersSnapshot = await firestore()
          .collection('users')
          .where('isActive', '==', true)
          .get();
        
        userIds = usersSnapshot.docs.map(doc => doc.id);
      }
      
      if (userIds.length === 0) {
        throw AppError.badRequest("Nenhum usuário encontrado com os filtros especificados");
      }
      
      // Criar registro da notificação em massa
      const bulkNotificationRef = await firestore().collection('bulkNotifications').add({
        title,
        message,
        channels,
        userCount: userIds.length,
        createdAt: firestore.Timestamp.now(),
        createdBy: adminId,
        status: 'PROCESSING'
      });
      
      // Iniciar processo de envio (simulado - em produção seria um job assíncrono)
      // Em um ambiente real, isso seria feito por um job em background
      setTimeout(async () => {
        try {
          // Simular envio de notificações
          const batch = firestore().batch();
          let processedCount = 0;
          
          for (const userId of userIds) {
            const notificationRef = firestore().collection('notifications').doc();
            
            batch.set(notificationRef, {
              userId,
              title,
              message,
              read: false,
              createdAt: firestore.Timestamp.now(),
              bulkNotificationId: bulkNotificationRef.id
            });
            
            processedCount++;
            
            // Processar em lotes de 500 (limite do Firestore)
            if (processedCount % 500 === 0) {
              await batch.commit();
              batch = firestore().batch();
            }
          }
          
          // Processar o lote final
          if (processedCount % 500 !== 0) {
            await batch.commit();
          }
          
          // Atualizar status da notificação em massa
          await bulkNotificationRef.update({
            status: 'COMPLETED',
            completedAt: firestore.Timestamp.now(),
            sentCount: processedCount
          });
        } catch (error) {
          logger.error(`Erro ao processar notificação em massa ${bulkNotificationRef.id}:`, error);
          await bulkNotificationRef.update({
            status: 'FAILED',
            error: error.message
          });
        }
      }, 1000);
      
      res.status(200).json({
        success: true,
        message: `Notificação em massa iniciada para ${userIds.length} usuários`,
        data: {
          bulkNotificationId: bulkNotificationRef.id,
          userCount: userIds.length
        }
      });
    } catch (error) {
      logger.error("Erro ao enviar notificações em massa:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.internal("Erro ao enviar notificações em massa");
    }
  });

  /**
   * Gerencia flags de funcionalidades
   * Acesso: Admin
   */
  manageFeatureFlags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.getAuthenticatedAdminId(req);
    const { action, flagName, enabled, description, userPercentage } = req.body;

    if (!action || !['get', 'create', 'update', 'delete'].includes(action)) {
      throw AppError.badRequest("Ação inválida. Deve ser 'get', 'create', 'update' ou 'delete'");
    }

    try {
      // Obter todas as flags
      if (action === 'get') {
        const flagsSnapshot = await firestore().collection('featureFlags').get();
        
        const flags = flagsSnapshot.docs.map(doc => ({
          name: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        }));

        res.status(200).json({
          success: true,
          data: flags
        });
        return;
      }

      // Validar nome da flag para outras ações
      if (!flagName) {
        throw AppError.badRequest("Nome da flag é obrigatório");
      }

      // Criar nova flag
      if (action === 'create') {
        if (enabled === undefined) {
          throw AppError.badRequest("Status da flag (enabled) é obrigatório");
        }

        const flagRef = firestore().collection('featureFlags').doc(flagName);
        const flagDoc = await flagRef.get();

        if (flagDoc.exists) {
          throw AppError.badRequest(`Flag '${flagName}' já existe`);
        }

        const now = firestore.Timestamp.now();
        await flagRef.set({
          name: flagName,
          enabled: enabled === true,
          description: description || '',
          userPercentage: userPercentage !== undefined ? userPercentage : 100,
          createdAt: now,
          updatedAt: now
        });

        res.status(201).json({
          success: true,
          message: `Flag '${flagName}' criada com sucesso`,
          data: {
            name: flagName,
            enabled: enabled === true,
            description: description || '',
            userPercentage: userPercentage !== undefined ? userPercentage : 100,
            createdAt: now.toDate(),
            updatedAt: now.toDate()
          }
        });
        return;
      }

      // Verificar se a flag existe para update/delete
      const flagRef = firestore().collection('featureFlags').doc(flagName);
      const flagDoc = await flagRef.get();

      if (!flagDoc.exists) {
        throw AppError.notFound(`Flag '${flagName}' não encontrada`);
      }

      // Atualizar flag
      if (action === 'update') {
        const updateData: any = {
          updatedAt: firestore.Timestamp.now()
        };

        if (enabled !== undefined) {
          updateData.enabled = enabled === true;
        }

        if (description !== undefined) {
          updateData.description = description;
        }

        if (userPercentage !== undefined) {
          updateData.userPercentage = userPercentage;
        }

        await flagRef.update(updateData);

        const updatedFlagDoc = await flagRef.get();
        const updatedFlag = {
          name: updatedFlagDoc.id,
          ...updatedFlagDoc.data(),
          createdAt: updatedFlagDoc.data().createdAt?.toDate(),
          updatedAt: updatedFlagDoc.data().updatedAt?.toDate()
        };

        res.status(200).json({
          success: true,
          message: `Flag '${flagName}' atualizada com sucesso`,
          data: updatedFlag
        });
        return;
      }

      // Excluir flag
      if (action === 'delete') {
        await flagRef.delete();

        res.status(200).json({
          success: true,
          message: `Flag '${flagName}' excluída com sucesso`
        });
        return;
      }
    } catch (error) {
      logger.error("Erro ao gerenciar flags de funcionalidades:", error);
      throw AppError.internal("Erro ao gerenciar flags de funcionalidades");
    }
  });
}

export default new AdminController();