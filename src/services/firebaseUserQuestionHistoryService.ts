import { firestore } from "../config/firebaseAdmin";
import { FirebaseUserQuestionHistory, FirebaseSubFilter, FirebaseQuestionDifficulty } from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import * as UserStatisticsService from "./firebaseUserStatisticsService";

export const COLLECTION_NAME = "userQuestionHistory";

// Registrar a resposta de um usuário a uma questão
export const recordUserAnswer = async (
    userId: string,
    questionId: string,
    selectedAlternativeId: string,
    isCorrect: boolean,
    subFilterIds?: string[] | null, // Adicionado para passar para estatísticas
    difficulty?: FirebaseQuestionDifficulty | string | null // Adicionado para passar para estatísticas
): Promise<FirebaseUserQuestionHistory> => {
    const now = Timestamp.now();
    const historyEntry: FirebaseUserQuestionHistory = {
        // id será gerado automaticamente pelo Firestore
        userId,
        questionId,
        selectedAlternativeId,
        isCorrect,
        answeredAt: now,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await firestore.collection(COLLECTION_NAME).add(historyEntry);

    // Atualizar estatísticas do usuário
    // Passando subFilterIds e difficulty para recordAnswer do UserStatisticsService
    // Se subFilterIds for um array, passamos o primeiro como exemplo, ou adaptamos UserStatisticsService para aceitar um array
    const primarySubFilterId = (subFilterIds && subFilterIds.length > 0) ? subFilterIds[0] : null;
    await UserStatisticsService.recordAnswer(userId, isCorrect, primarySubFilterId, difficulty as FirebaseQuestionDifficulty | null);

    return { ...historyEntry, id: docRef.id };
};

// Obter histórico de respostas de um usuário (com paginação)
export const getUserQuestionHistory = async (
    userId: string,
    limit: number = 10,
    lastVisibleId?: string
): Promise<{ history: FirebaseUserQuestionHistory[]; nextVisibleId?: string | null }> => {
    let query = firestore.collection(COLLECTION_NAME)
        .where("userId", "==", userId)
        .orderBy("answeredAt", "desc")
        .limit(limit);

    if (lastVisibleId) {
        const lastDoc = await firestore.collection(COLLECTION_NAME).doc(lastVisibleId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const snapshot = await query.get();
    const history: FirebaseUserQuestionHistory[] = [];
    snapshot.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() } as FirebaseUserQuestionHistory);
    });

    const nextVisibleId = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1]?.id : null;

    return { history, nextVisibleId };
};

// Obter uma entrada específica do histórico pelo ID (menos comum, mas pode ser útil)
export const getHistoryEntryById = async (entryId: string): Promise<FirebaseUserQuestionHistory | null> => {
    const docRef = firestore.collection(COLLECTION_NAME).doc(entryId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() } as FirebaseUserQuestionHistory;
    }
    return null;
};

