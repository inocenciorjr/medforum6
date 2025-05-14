import { Request, Response, NextFunction } from 'express';
import * as userService from '../../services/firebaseUserService';
import * as studySessionService from '../../services/firebaseStudySessionService';
import * as notificationService from '../../services/firebaseNotificationService';
import * as userStatisticsService from '../../services/firebaseUserStatisticsService';
import * as userAchievementService from '../../services/firebaseUserAchievementService';
import { AppError } from '../../utils/errors';

/**
 * Obter perfil do usuário
 */
export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return next(AppError.notFound('Usuário não encontrado'));
    }
    
    // Remover campos sensíveis
    const { password, ...userProfile } = user;
    
    return res.status(200).json({
      success: true,
      data: {
        user: userProfile
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Atualizar perfil do usuário
 */
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Validar dados de entrada
    const { name, email, phone, profileImage, bio, preferences, settings } = req.body;
    
    // Verificar se o usuário existe
    const existingUser = await userService.getUserById(userId);
    
    if (!existingUser) {
      return next(AppError.notFound('Usuário não encontrado'));
    }
    
    // Verificar se o email já está em uso (se estiver sendo alterado)
    if (email && email !== existingUser.email) {
      const emailExists = await userService.getUserByEmail(email);
      
      if (emailExists && emailExists.id !== userId) {
        return next(AppError.conflict('Este email já está em uso'));
      }
    }
    
    // Preparar dados para atualização
    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (profileImage) updateData.profileImage = profileImage;
    if (bio) updateData.bio = bio;
    if (preferences) updateData.preferences = preferences;
    if (settings) updateData.settings = settings;
    
    // Atualizar perfil
    const updatedUser = await userService.updateUser(userId, updateData);
    
    // Remover campos sensíveis
    const { password, ...userProfile } = updatedUser;
    
    return res.status(200).json({
      success: true,
      data: {
        user: userProfile
      },
      message: 'Perfil atualizado com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Criar uma sessão de estudo
 */
export const createStudySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Validar dados de entrada
    const { topic, duration, questionsAnswered, correctAnswers, resources, notes } = req.body;
    
    if (!topic) {
      return next(AppError.badRequest('Tópico é obrigatório'));
    }
    
    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return next(AppError.badRequest('Duração válida é obrigatória'));
    }
    
    // Criar sessão de estudo
    const studySession = await studySessionService.createStudySession({
      userId,
      topic,
      duration,
      questionsAnswered: questionsAnswered || 0,
      correctAnswers: correctAnswers || 0,
      resources: resources || [],
      notes: notes || '',
      startedAt: new Date(),
      endedAt: new Date(Date.now() + duration * 60 * 1000) // Converter minutos para milissegundos
    });
    
    // Atualizar estatísticas do usuário
    await userStatisticsService.updateStudyStatistics(userId, {
      totalStudyTime: duration,
      sessionsCount: 1,
      questionsAnswered: questionsAnswered || 0,
      correctAnswers: correctAnswers || 0
    });
    
    // Verificar conquistas
    await userAchievementService.checkStudyAchievements(userId);
    
    return res.status(201).json({
      success: true,
      data: {
        studySession
      },
      message: 'Sessão de estudo criada com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Obter sessões de estudo do usuário
 */
export const getUserStudySessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Parâmetros de paginação e filtros
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const topic = req.query.topic as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    // Validar parâmetros
    if (limit <= 0 || limit > 100) {
      return next(AppError.badRequest('Limite inválido. Deve estar entre 1 e 100.'));
    }
    
    if (offset < 0) {
      return next(AppError.badRequest('Offset inválido. Deve ser maior ou igual a 0.'));
    }
    
    // Obter sessões de estudo
    const { sessions, total } = await studySessionService.getUserStudySessions(userId, {
      limit,
      offset,
      topic,
      startDate,
      endDate
    });
    
    return res.status(200).json({
      success: true,
      data: {
        sessions,
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Atualizar uma sessão de estudo
 */
export const updateStudySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    if (!sessionId) {
      return next(AppError.badRequest('ID da sessão é obrigatório'));
    }
    
    // Verificar se a sessão existe e pertence ao usuário
    const existingSession = await studySessionService.getStudySessionById(sessionId);
    
    if (!existingSession) {
      return next(AppError.notFound('Sessão de estudo não encontrada'));
    }
    
    if (existingSession.userId !== userId) {
      return next(AppError.forbidden('Você não tem permissão para atualizar esta sessão'));
    }
    
    // Validar dados de entrada
    const { topic, duration, questionsAnswered, correctAnswers, resources, notes, endedAt } = req.body;
    
    // Preparar dados para atualização
    const updateData: any = {};
    
    if (topic) updateData.topic = topic;
    if (duration) updateData.duration = duration;
    if (questionsAnswered !== undefined) updateData.questionsAnswered = questionsAnswered;
    if (correctAnswers !== undefined) updateData.correctAnswers = correctAnswers;
    if (resources) updateData.resources = resources;
    if (notes !== undefined) updateData.notes = notes;
    if (endedAt) updateData.endedAt = new Date(endedAt);
    
    // Atualizar sessão
    const updatedSession = await studySessionService.updateStudySession(sessionId, updateData);
    
    // Atualizar estatísticas do usuário se necessário
    if (duration !== undefined && duration !== existingSession.duration) {
      const timeDiff = duration - existingSession.duration;
      await userStatisticsService.updateStudyStatistics(userId, {
        totalStudyTime: timeDiff
      });
    }
    
    if (questionsAnswered !== undefined && questionsAnswered !== existingSession.questionsAnswered) {
      const questionsDiff = questionsAnswered - existingSession.questionsAnswered;
      await userStatisticsService.updateStudyStatistics(userId, {
        questionsAnswered: questionsDiff
      });
    }
    
    if (correctAnswers !== undefined && correctAnswers !== existingSession.correctAnswers) {
      const correctDiff = correctAnswers - existingSession.correctAnswers;
      await userStatisticsService.updateStudyStatistics(userId, {
        correctAnswers: correctDiff
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        studySession: updatedSession
      },
      message: 'Sessão de estudo atualizada com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Excluir uma sessão de estudo
 */
export const deleteStudySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    if (!sessionId) {
      return next(AppError.badRequest('ID da sessão é obrigatório'));
    }
    
    // Verificar se a sessão existe e pertence ao usuário
    const existingSession = await studySessionService.getStudySessionById(sessionId);
    
    if (!existingSession) {
      return next(AppError.notFound('Sessão de estudo não encontrada'));
    }
    
    if (existingSession.userId !== userId) {
      return next(AppError.forbidden('Você não tem permissão para excluir esta sessão'));
    }
    
    // Excluir sessão
    await studySessionService.deleteStudySession(sessionId);
    
    // Atualizar estatísticas do usuário
    await userStatisticsService.updateStudyStatistics(userId, {
      totalStudyTime: -existingSession.duration,
      sessionsCount: -1,
      questionsAnswered: -existingSession.questionsAnswered,
      correctAnswers: -existingSession.correctAnswers
    });
    
    return res.status(200).json({
      success: true,
      message: 'Sessão de estudo excluída com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Obter notificações do usuário
 */
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Parâmetros de paginação
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';
    
    // Validar parâmetros
    if (limit <= 0 || limit > 100) {
      return next(AppError.badRequest('Limite inválido. Deve estar entre 1 e 100.'));
    }
    
    if (offset < 0) {
      return next(AppError.badRequest('Offset inválido. Deve ser maior ou igual a 0.'));
    }
    
    // Obter notificações
    const { notifications, total, unreadCount } = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly
    });
    
    return res.status(200).json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
        limit,
        offset
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Marcar notificação como lida
 */
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    if (!notificationId) {
      return next(AppError.badRequest('ID da notificação é obrigatório'));
    }
    
    // Verificar se a notificação existe e pertence ao usuário
    const notification = await notificationService.getNotificationById(notificationId);
    
    if (!notification) {
      return next(AppError.notFound('Notificação não encontrada'));
    }
    
    if (notification.userId !== userId) {
      return next(AppError.forbidden('Você não tem permissão para acessar esta notificação'));
    }
    
    // Marcar como lida
    const updatedNotification = await notificationService.markAsRead(notificationId);
    
    return res.status(200).json({
      success: true,
      data: {
        notification: updatedNotification
      },
      message: 'Notificação marcada como lida'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Marcar todas as notificações como lidas
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Marcar todas como lidas
    const count = await notificationService.markAllAsRead(userId);
    
    return res.status(200).json({
      success: true,
      data: {
        count
      },
      message: `${count} notificações marcadas como lidas`
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Excluir uma notificação
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    if (!notificationId) {
      return next(AppError.badRequest('ID da notificação é obrigatório'));
    }
    
    // Verificar se a notificação existe e pertence ao usuário
    const notification = await notificationService.getNotificationById(notificationId);
    
    if (!notification) {
      return next(AppError.notFound('Notificação não encontrada'));
    }
    
    if (notification.userId !== userId) {
      return next(AppError.forbidden('Você não tem permissão para excluir esta notificação'));
    }
    
    // Excluir notificação
    await notificationService.deleteNotification(notificationId);
    
    return res.status(200).json({
      success: true,
      message: 'Notificação excluída com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Obter estatísticas do usuário
 */
export const getUserStatistics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Obter estatísticas
    const statistics = await userStatisticsService.getUserStatistics(userId);
    
    if (!statistics) {
      return next(AppError.notFound('Estatísticas não encontradas'));
    }
    
    return res.status(200).json({
      success: true,
      data: {
        statistics
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Obter conquistas do usuário
 */
export const getUserAchievements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Obter conquistas
    const achievements = await userAchievementService.getUserAchievements(userId);
    
    return res.status(200).json({
      success: true,
      data: {
        achievements
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Atualizar preferências de notificação
 */
export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(AppError.unauthorized('Usuário não autenticado'));
    }
    
    // Validar dados de entrada
    const { email, push, sms, inApp } = req.body;
    
    if (email === undefined && push === undefined && sms === undefined && inApp === undefined) {
      return next(AppError.badRequest('Pelo menos uma preferência de notificação deve ser fornecida'));
    }
    
    // Obter usuário atual
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return next(AppError.notFound('Usuário não encontrado'));
    }
    
    // Preparar dados para atualização
    const currentPreferences = user.notificationPreferences || {};
    const updatedPreferences = {
      ...currentPreferences,
      ...(email !== undefined && { email }),
      ...(push !== undefined && { push }),
      ...(sms !== undefined && { sms }),
      ...(inApp !== undefined && { inApp })
    };
    
    // Atualizar preferências
    const updatedUser = await userService.updateUser(userId, {
      notificationPreferences: updatedPreferences
    });
    
    return res.status(200).json({
      success: true,
      data: {
        notificationPreferences: updatedUser.notificationPreferences
      },
      message: 'Preferências de notificação atualizadas com sucesso'
    });
  } catch (error) {
    return next(error);
  }
};