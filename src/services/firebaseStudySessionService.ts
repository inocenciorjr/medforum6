import { Firestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
    FirebaseStudySession,
    FirebaseStudySessionCreatePayload,
    FirebaseStudySessionUpdatePayload,
    FirebaseStudySessionType,
    FirebaseStudySessionMood,
    FirebaseStudySessionDifficulty,
    ReviewQuality
} from "../types/firebaseTypes";
import { db as firestore } from "../firebase_config/firebaseAdmin"; // Padronizado com a versão existente
import { firebaseQuestionResponseService } from "./firebaseQuestionResponseService";
import { AppError } from "../utils/errors"; // Adicionado para consistência, se AppError for usado

const STUDY_SESSIONS_COLLECTION = "studySessions";

export const firebaseStudySessionService = {
    async createStudySession(payload: FirebaseStudySessionCreatePayload): Promise<FirebaseStudySession> {
        if (!payload.userId) throw new AppError("O ID do usuário é obrigatório.", 400);
        if (!payload.studyType) throw new AppError("O tipo de estudo é obrigatório.", 400);

        const now = Timestamp.now();
        const newSessionRef = firestore.collection(STUDY_SESSIONS_COLLECTION).doc();

        const newSessionData: FirebaseStudySession = {
            id: newSessionRef.id,
            userId: payload.userId,
            startTime: payload.startTime || now,
            endTime: null,
            duration: null,
            questionsAnswered: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            accuracy: null,
            studyType: payload.studyType,
            filters: payload.filters || null,
            subFilters: payload.subFilters || null,
            notes: null,
            mood: null,
            difficulty: null,
            focusScore: null,
            isCompleted: false,
            createdAt: now,
            updatedAt: now,
        };

        await newSessionRef.set(newSessionData);
        return newSessionData;
    },

    async getStudySessionById(sessionId: string): Promise<FirebaseStudySession | null> {
        if (!sessionId) throw new AppError("O ID da sessão é obrigatório.", 400);
        const doc = await firestore.collection(STUDY_SESSIONS_COLLECTION).doc(sessionId).get();
        if (!doc.exists) {
            return null;
        }
        return { id: doc.id, ...doc.data() } as FirebaseStudySession;
    },

    // Combina a lógica de updateStudySession e updateStudySessionDetails
    async updateStudySession(sessionId: string, userId: string, updates: FirebaseStudySessionUpdatePayload): Promise<FirebaseStudySession | null> {
        const sessionRef = firestore.collection(STUDY_SESSIONS_COLLECTION).doc(sessionId);
        const doc = await sessionRef.get();

        if (!doc.exists) {
            throw new AppError(`Sessão de estudo com ID "${sessionId}" não encontrada.`, 404);
        }
        const currentData = doc.data() as FirebaseStudySession;
        if (currentData.userId !== userId) {
            throw new AppError("Usuário não autorizado a atualizar esta sessão de estudo.", 403);
        }
        if (currentData.isCompleted && updates.isCompleted === false) {
            throw new AppError("Não é possível reabrir uma sessão de estudo já completada.", 400);
        }
        if (currentData.isCompleted && (updates.questionsAnswered || updates.correctAnswers || updates.incorrectAnswers)) {
             throw new AppError("Não é possível alterar contadores de respostas de uma sessão completada.", 400);
        }

        const updateData: Partial<FirebaseStudySession> = { ...updates, updatedAt: Timestamp.now() };
        
        if (updates.isCompleted && !currentData.isCompleted) {
            updateData.endTime = updates.endTime || Timestamp.now();
            if (currentData.startTime && updateData.endTime) {
                updateData.duration = Math.round(( (updateData.endTime as Timestamp).toMillis() - (currentData.startTime as Timestamp).toMillis() ) / (1000 * 60));
            }
            
            const questionsAnswered = updates.questionsAnswered ?? currentData.questionsAnswered;
            const correctAnswers = updates.correctAnswers ?? currentData.correctAnswers;

            if (questionsAnswered > 0) {
                updateData.accuracy = parseFloat(((correctAnswers / questionsAnswered) * 100).toFixed(2));
            } else {
                updateData.accuracy = 0;
            }
        }
        
        if (updates.focusScore !== undefined && updates.focusScore !== null) {
            updateData.focusScore = Math.min(100, Math.max(0, Math.round(updates.focusScore)));
        }

        await sessionRef.update(updateData);
        const updatedDoc = await sessionRef.get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as FirebaseStudySession;
    },

    async completeStudySession(sessionId: string, userId: string, finalUpdates?: FirebaseStudySessionUpdatePayload): Promise<FirebaseStudySession | null> {
        const sessionRef = firestore.collection(STUDY_SESSIONS_COLLECTION).doc(sessionId);
        const doc = await sessionRef.get();

        if (!doc.exists) {
            throw new AppError(`Sessão de estudo com ID "${sessionId}" não encontrada.`, 404);
        }
        const currentData = doc.data() as FirebaseStudySession;
        if (currentData.userId !== userId) {
            throw new AppError("Usuário não autorizado a completar esta sessão de estudo.", 403);
        }
        if (currentData.isCompleted) {
            return currentData; 
        }

        const now = Timestamp.now();
        const completionData: Partial<FirebaseStudySession> = {
            ...(finalUpdates || {}),
            endTime: finalUpdates?.endTime || now,
            isCompleted: true,
            updatedAt: now,
        };

        if (currentData.startTime && completionData.endTime) {
            completionData.duration = Math.round(( (completionData.endTime as Timestamp).toMillis() - (currentData.startTime as Timestamp).toMillis() ) / (1000 * 60));
        }

        const questionsAnswered = finalUpdates?.questionsAnswered ?? currentData.questionsAnswered;
        const correctAnswers = finalUpdates?.correctAnswers ?? currentData.correctAnswers;
        
        if (questionsAnswered > 0) {
            completionData.accuracy = parseFloat(((correctAnswers / questionsAnswered) * 100).toFixed(2));
        } else {
            completionData.accuracy = 0;
        }
        if (finalUpdates?.questionsAnswered !== undefined) completionData.questionsAnswered = finalUpdates.questionsAnswered;
        if (finalUpdates?.correctAnswers !== undefined) completionData.correctAnswers = finalUpdates.correctAnswers;
        if (finalUpdates?.incorrectAnswers !== undefined) completionData.incorrectAnswers = finalUpdates.incorrectAnswers;
        if (finalUpdates?.focusScore !== undefined && finalUpdates.focusScore !== null) {
            completionData.focusScore = Math.min(100, Math.max(0, Math.round(finalUpdates.focusScore)));
        }

        await sessionRef.update(completionData);
        const updatedDocAfterCompletion = await sessionRef.get(); // Re-fetch for accurate data
        return { id: updatedDocAfterCompletion.id, ...updatedDocAfterCompletion.data() } as FirebaseStudySession;
    },

    async recordAnswerInSession(
        sessionId: string, 
        userId: string, 
        questionId: string, 
        isCorrect: boolean, 
        quality: ReviewQuality,
        selectedOptionId?: string | null,
        essayResponse?: string | null,
        responseTimeSeconds?: number,
        questionListId?: string | null 
    ): Promise<void> {
        const sessionRef = firestore.collection(STUDY_SESSIONS_COLLECTION).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            throw new AppError(`Sessão de estudo com ID "${sessionId}" não encontrada.`, 404);
        }
        const sessionData = sessionDoc.data() as FirebaseStudySession;
        if (sessionData.userId !== userId) {
            throw new AppError("Usuário não autorizado a registrar respostas nesta sessão.", 403);
        }
        if (sessionData.isCompleted) {
            throw new AppError("Não é possível registrar respostas em uma sessão já completada.", 400);
        }

        const updatePayload: any = {
            questionsAnswered: FieldValue.increment(1),
            updatedAt: Timestamp.now(),
        };
        if (isCorrect) {
            updatePayload.correctAnswers = FieldValue.increment(1);
        } else {
            updatePayload.incorrectAnswers = FieldValue.increment(1);
        }
        await sessionRef.update(updatePayload);

        // Integração com SRS
        let qrId: string | null = null;
        const qrSnapshot = await firestore.collection("questionResponses")
            .where("userId", "==", userId)
            .where("questionId", "==", questionId)
            .limit(1)
            .get();

        if (!qrSnapshot.empty) {
            qrId = qrSnapshot.docs[0].id;
        } else {
            qrId = await firebaseQuestionResponseService.createQuestionResponse({
                userId,
                questionId,
                questionListId: questionListId, 
                selectedOptionId,
                essayResponse,
                isCorrectOnFirstAttempt: isCorrect,
                responseTimeSeconds,
                addedToErrorNotebook: false,
            });
        }

        if (!qrId) {
            throw new AppError("Falha ao obter ou criar QuestionResponse para a questão da sessão.", 500);
        }

        await firebaseQuestionResponseService.recordQuestionReview(
            qrId, 
            userId, 
            quality, 
            `Estudado na sessão: ${sessionData.studyType} (ID: ${sessionId})`
        );
    },

    async listStudySessionsByUser(
        userId: string, 
        options?: {
            studyType?: FirebaseStudySessionType;
            isCompleted?: boolean;
            limit?: number; 
            startAfter?: any; // Firestore DocumentSnapshot for pagination
        }
    ): Promise<{ sessions: FirebaseStudySession[], nextPageToken: any | null }> {
        if (!userId) throw new AppError("O ID do usuário é obrigatório.", 400);
        let query = firestore.collection(STUDY_SESSIONS_COLLECTION)
            .where("userId", "==", userId);

        if (options?.studyType) {
            query = query.where("studyType", "==", options.studyType);
        }
        if (options?.isCompleted !== undefined) {
            query = query.where("isCompleted", "==", options.isCompleted);
        }
        
        query = query.orderBy("startTime", "desc");

        if (options?.startAfter) {
            query = query.startAfter(options.startAfter);
        }

        const limit = options?.limit || 10;
        query = query.limit(limit);

        const snapshot = await query.get();
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseStudySession));
        const nextPageToken = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1] : null;
        return { sessions, nextPageToken };
    },

    async deleteStudySession(sessionId: string, userId: string): Promise<void> {
        if (!sessionId) throw new AppError("O ID da sessão é obrigatório.", 400);
        const sessionRef = firestore.collection(STUDY_SESSIONS_COLLECTION).doc(sessionId);
        const doc = await sessionRef.get();

        if (!doc.exists) {
            throw new AppError(`Sessão de estudo com ID "${sessionId}" não encontrada.`, 404);
        }
        const currentData = doc.data() as FirebaseStudySession;
        if (currentData.userId !== userId) {
            throw new AppError("Usuário não autorizado a deletar esta sessão de estudo.", 403);
        }
        await sessionRef.delete();
    }
};

