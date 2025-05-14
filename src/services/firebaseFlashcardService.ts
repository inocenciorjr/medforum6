import { FieldPath, Timestamp } from "firebase-admin/firestore";
import {
    FirebaseFlashcard,
    FirebaseFlashcardStatus,
    FirebaseFlashcardUserStatistics,
    FirebaseFlashcardCreatePayload,
    FirebaseFlashcardUpdatePayload,
    FirebaseUserFlashcardInteraction,
    ReviewQuality,
    FirebaseDeck
} from "../types/firebaseTypes";
import { firestore as db } from "../config/firebaseAdmin";
import { AppError } from "../utils/errors";
import { getUserById } from "./firebaseUserService";
import { getDeckById } from "./firebaseDeckService";

// Collections
const FLASHCARDS_COLLECTION = "flashcards";
const DECKS_COLLECTION = "decks";
const USERS_COLLECTION = "users";
const USER_STATISTICS_COLLECTION = "userStatistics";
const FLASHCARD_INTERACTIONS_COLLECTION = "flashcardInteractions";

class FirebaseFlashcardService {
    // Validação de usuário
    private async validateUserExists(userId: string): Promise<void> {
        const user = await getUserById(userId);
        if (!user) {
            throw new AppError(`Usuário com ID ${userId} não encontrado`, 404);
        }
    }

    // Validação de deck
    private async validateDeckExistsAndBelongsToUser(deckId: string, userId: string): Promise<void> {
        const deck = await getDeckById(deckId);
        if (!deck) {
            throw new AppError(`Deck com ID ${deckId} não encontrado`, 404);
        }
        if (deck.userId !== userId) {
            throw new AppError(`Deck com ID ${deckId} não pertence ao usuário ${userId}`, 403);
        }
    }

    // Cálculo do próximo intervalo de revisão usando o algoritmo SM-2
    private calculateNextReview(
        srsEaseFactor: number,
        srsInterval: number,
        reviewQuality: ReviewQuality
    ): { nextInterval: number; newEaseFactor: number } {
        // Implementação do algoritmo SM-2
        let newEaseFactor = srsEaseFactor;
        let nextInterval = srsInterval;

        // Ajustar o fator de facilidade com base na qualidade da revisão
        if (reviewQuality < ReviewQuality.GOOD) {
            // Resposta incorreta, resetar para o início
            nextInterval = 1;
            // Reduzir o fator de facilidade, mas não abaixo de 1.3
            newEaseFactor = Math.max(1.3, srsEaseFactor - 0.2);
        } else {
            // Ajustar o fator de facilidade
            newEaseFactor = srsEaseFactor + (0.1 - (5 - reviewQuality) * (0.08 + (5 - reviewQuality) * 0.02));
            newEaseFactor = Math.max(1.3, newEaseFactor); // Não permitir que fique abaixo de 1.3

            if (srsInterval === 0) {
                // Primeiro intervalo
                nextInterval = 1;
            } else if (srsInterval === 1) {
                // Segundo intervalo
                nextInterval = 6;
            } else {
                // Intervalos subsequentes
                nextInterval = Math.round(srsInterval * newEaseFactor);
            }
        }

        return { nextInterval, newEaseFactor };
    }

    // Criar um novo flashcard
    async createFlashcard(data: FirebaseFlashcardCreatePayload): Promise<FirebaseFlashcard> {
        await this.validateUserExists(data.userId);
        await this.validateDeckExistsAndBelongsToUser(data.deckId, data.userId);

        const flashcardRef = db.collection(FLASHCARDS_COLLECTION).doc();
        const now = Timestamp.now();

        const newFlashcard: FirebaseFlashcard = {
            id: flashcardRef.id,
            userId: data.userId,
            deckId: data.deckId,
            frontContent: data.frontContent,
            backContent: data.backContent,
            tags: data.tags || [],
            status: data.status || FirebaseFlashcardStatus.LEARNING,
            srsEaseFactor: data.srsEaseFactor || 2.5,
            srsInterval: data.srsInterval || 0,
            srsRepetitions: data.srsRepetitions || 0,
            nextReviewAt: data.nextReviewAt || now,
            lastReviewedAt: data.lastReviewedAt || null,
            createdAt: now,
            updatedAt: now,
            personalNotes: data.personalNotes || null,
            frontImage: data.frontImage || null,
            backImage: data.backImage || null,
            frontAudio: data.frontAudio || null,
            backAudio: data.backAudio || null,

        };

        await flashcardRef.set(newFlashcard);

        // Atualizar estatísticas do usuário
        await this.updateUserFlashcardStatistics(data.userId, data.deckId);

        return newFlashcard;
    }

    // Obter um flashcard pelo ID
    async getFlashcardById(flashcardId: string, userId?: string): Promise<FirebaseFlashcard | null> {
        const doc = await db.collection(FLASHCARDS_COLLECTION).doc(flashcardId).get();

        if (!doc.exists) {
            return null;
        }

        const flashcard = doc.data() as FirebaseFlashcard;

        // Se userId for fornecido, verificar se o usuário tem acesso ao flashcard
        if (userId && flashcard.userId !== userId) {
            throw new Error("Usuário não autorizado a acessar este flashcard.");
        }

        return flashcard;
    }

    // Listar flashcards de um usuário (sem paginação, usado internamente ou para listagens simples)
    async listUserFlashcards(userId: string, deckId?: string): Promise<FirebaseFlashcard[]> {
        await this.validateUserExists(userId);

        let query = db.collection(FLASHCARDS_COLLECTION).where("userId", "==", userId);

        if (deckId) {
            await this.validateDeckExistsAndBelongsToUser(deckId, userId);
            query = query.where("deckId", "==", deckId);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as FirebaseFlashcard);
    }

    // Obter flashcards de um usuário com paginação e filtros
    async getFlashcardsByUser(userId: string, page: number = 1, limit: number = 10, filters?: { deckId?: string, readyForReview?: boolean, status?: FirebaseFlashcardStatus, tag?: string }): Promise<{ flashcards: FirebaseFlashcard[], total: number,totalPages: number }> {
        await this.validateUserExists(userId);

        let query = db.collection(FLASHCARDS_COLLECTION).where("userId", "==", userId);

        if (filters?.deckId) {
            await this.validateDeckExistsAndBelongsToUser(filters.deckId, userId);
            query = query.where("deckId", "==", filters.deckId);
        }

        if (filters?.readyForReview) {
            query = query.where("nextReviewAt", "<=", Timestamp.now());
        }

        if (filters?.status) {
            query = query.where("status", "==", filters.status);
        }

        if (filters?.tag) {
            query = query.where("tags", "array-contains", filters.tag);
        }

        // Para contagem total com os mesmos filtros
        const countSnapshot = await query.count().get();
        const total = countSnapshot.data().count;

        // Aplicar ordenação e paginação para a busca dos dados
        query = query.orderBy("nextReviewAt", "asc").orderBy("createdAt", "desc"); // Prioriza os mais próximos para revisão

        const offset = (page - 1) * limit;
        query = query.limit(limit).offset(offset);

        const snapshot = await query.get();
        const flashcards = snapshot.docs.map(doc => doc.data() as FirebaseFlashcard);
        const totalPages = Math.ceil(total / limit);

        return { flashcards, total, totalPages };
    }


    // Atualizar um flashcard
    async updateFlashcard(userId: string, flashcardId: string, data: FirebaseFlashcardUpdatePayload): Promise<FirebaseFlashcard> {
        await this.validateUserExists(userId);

        const flashcardRef = db.collection(FLASHCARDS_COLLECTION).doc(flashcardId);
        const doc = await flashcardRef.get();

        if (!doc.exists) {
            throw new AppError(`Flashcard com ID ${flashcardId} não encontrado`, 404);
        }

        const existingFlashcard = doc.data() as FirebaseFlashcard;

        if (existingFlashcard.userId !== userId) {
            throw new AppError(`Flashcard com ID ${flashcardId} não pertence ao usuário ${userId}`, 403);
        }

        // Se o deck estiver sendo alterado, validar o novo deck
        if (data.deckId && data.deckId !== existingFlashcard.deckId) {
            await this.validateDeckExistsAndBelongsToUser(data.deckId, userId);
        }

        const now = Timestamp.now();

        const updatedFlashcardData: Partial<FirebaseFlashcard> = { ...data, updatedAt: now };

        await flashcardRef.update(updatedFlashcardData);

        const updatedDoc = await flashcardRef.get();
        const finalFlashcard = updatedDoc.data() as FirebaseFlashcard;

        // Atualizar estatísticas do usuário
        await this.updateUserFlashcardStatistics(userId, finalFlashcard.deckId);

        // Se o deck foi alterado, atualizar estatísticas do deck antigo também
        if (data.deckId && data.deckId !== existingFlashcard.deckId) {
            await this.updateUserFlashcardStatistics(userId, existingFlashcard.deckId);
        }

        return finalFlashcard;
    }

    // Excluir um flashcard
    async deleteFlashcard(userId: string, flashcardId: string): Promise<void> {
        await this.validateUserExists(userId);

        const flashcardRef = db.collection(FLASHCARDS_COLLECTION).doc(flashcardId);
        const doc = await flashcardRef.get();

        if (!doc.exists) {
            throw new AppError(`Flashcard com ID ${flashcardId} não encontrado`, 404);
        }

        const flashcardData = doc.data() as FirebaseFlashcard;

        if (flashcardData.userId !== userId) {
            throw new AppError(`Flashcard com ID ${flashcardId} não pertence ao usuário ${userId}`, 403);
        }

        await flashcardRef.delete();

        // Atualizar estatísticas do usuário
        await this.updateUserFlashcardStatistics(userId, flashcardData.deckId);
    }

    // Registrar uma interação com um flashcard (revisão)
    async recordFlashcardReview(
        userId: string,
        flashcardId: string,
        reviewQuality: ReviewQuality
    ): Promise<{ updatedFlashcard: FirebaseFlashcard, interaction: FirebaseUserFlashcardInteraction }> {
        const interaction = await this.recordFlashcardInteraction(userId, flashcardId, reviewQuality);
        const updatedFlashcard = await this.getFlashcardById(flashcardId, userId); // Pass userId for validation

        if (!updatedFlashcard) {
            throw new AppError(`Flashcard com ID ${flashcardId} não encontrado após interação`, 404);
        }

        return { updatedFlashcard, interaction };
    }

    async recordFlashcardInteraction(
        userId: string,
        flashcardId: string,
        reviewQuality: ReviewQuality
    ): Promise<FirebaseUserFlashcardInteraction> {
        await this.validateUserExists(userId);

        const flashcardRef = db.collection(FLASHCARDS_COLLECTION).doc(flashcardId);
        const doc = await flashcardRef.get();

        if (!doc.exists) {
            throw new AppError(`Flashcard com ID ${flashcardId} não encontrado`, 404);
        }

        const flashcard = doc.data() as FirebaseFlashcard;

        if (flashcard.userId !== userId) {
            throw new AppError(`Flashcard com ID ${flashcardId} não pertence ao usuário ${userId}`, 403);
        }

        const now = Timestamp.now();

        // Calcular o próximo intervalo e fator de facilidade
        const { nextInterval, newEaseFactor } = this.calculateNextReview(
            flashcard.srsEaseFactor || 2.5,
            flashcard.srsInterval || 0,
            reviewQuality
        );

        // Determinar o novo status com base na qualidade da revisão
        let newStatus = flashcard.status;
        if (reviewQuality < ReviewQuality.GOOD) {
            newStatus = FirebaseFlashcardStatus.LEARNING;
        } else if (nextInterval > 30) { // Example threshold for MASTERED
            newStatus = FirebaseFlashcardStatus.MASTERED;
        } else if (nextInterval > 1) {
            newStatus = FirebaseFlashcardStatus.REVIEWING;
        } else {
            newStatus = FirebaseFlashcardStatus.LEARNING; // Default to learning if conditions not met
        }

        // Calcular a próxima data de revisão
        const nextReviewDate = new Date(now.toDate().getTime()); // Start from current time
        nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
        const nextReviewAt = Timestamp.fromDate(nextReviewDate);

        // Atualizar o flashcard
        const updatedFlashcardData: Partial<FirebaseFlashcard> = {
            status: newStatus,
            srsEaseFactor: newEaseFactor,
            srsInterval: nextInterval,
            srsRepetitions: (flashcard.srsRepetitions || 0) + 1,
            lastReviewedAt: now,
            nextReviewAt: nextReviewAt,
            updatedAt: now
        };

        await flashcardRef.update(updatedFlashcardData);

        // Registrar a interação
        const interactionRef = db.collection(FLASHCARD_INTERACTIONS_COLLECTION).doc();
        const interaction: FirebaseUserFlashcardInteraction = {
            id: interactionRef.id,
            userId: userId,
            flashcardId: flashcardId,
            deckId: flashcard.deckId,
            reviewQuality: reviewQuality,
            reviewedAt: now, // Usando reviewedAt conforme a interface
            previousInterval: flashcard.srsInterval,
            srsInterval: nextInterval,
            previousEaseFactor: flashcard.srsEaseFactor,
            srsEaseFactor: newEaseFactor,
            previousStatus: flashcard.status,
            newStatus: newStatus,
            srsRepetitions: updatedFlashcardData.srsRepetitions || 0,
            srsLapses: 0, // Valor padrão
            nextReviewAt: updatedFlashcardData.nextReviewAt || now,
            createdAt: now,
            updatedAt: now
        };

        await interactionRef.set(interaction);

        // Atualizar estatísticas do usuário
        await this.updateUserFlashcardStatistics(userId, flashcard.deckId);

        return interaction;
    }

    // Arquivar/desarquivar um flashcard
    async toggleArchiveFlashcard(flashcardId: string, userId: string): Promise<FirebaseFlashcard> {
        await this.validateUserExists(userId);

        const flashcardRef = db.collection(FLASHCARDS_COLLECTION).doc(flashcardId);
        const doc = await flashcardRef.get();

        if (!doc.exists) {
            throw new AppError(`Flashcard com ID ${flashcardId} não encontrado`, 404);
        }

        const flashcard = doc.data() as FirebaseFlashcard;

        if (flashcard.userId !== userId) {
            throw new AppError(`Flashcard com ID ${flashcardId} não pertence ao usuário ${userId}`, 403);
        }

        // Alternar o status de arquivado
        const isArchived = flashcard.status === FirebaseFlashcardStatus.ARCHIVED;
        // If it's archived, make it active (or new if it was never reviewed). For simplicity, make it ACTIVE.
        // If it's not archived, archive it.
        const newStatus = isArchived ? FirebaseFlashcardStatus.ACTIVE : FirebaseFlashcardStatus.ARCHIVED;

        await flashcardRef.update({
            status: newStatus,
            updatedAt: Timestamp.now()
        });

        // Atualizar estatísticas do usuário
        await this.updateUserFlashcardStatistics(userId, flashcard.deckId);

        // Retornar o flashcard atualizado
        const updatedDoc = await flashcardRef.get();
        return updatedDoc.data() as FirebaseFlashcard;
    }

    async getUserFlashcardStatistics(userId: string, deckId?: string): Promise<FirebaseFlashcardUserStatistics> {
        const flashcardsRef = db.collection(FLASHCARDS_COLLECTION).where('userId', '==', userId);

        if (deckId) {
            await this.validateDeckExistsAndBelongsToUser(deckId, userId);
            flashcardsRef.where('deckId', '==', deckId);
        }

        const snapshot = await flashcardsRef.get();
        const flashcards = snapshot.docs.map(doc => doc.data() as FirebaseFlashcard);

        let totalFlashcards = flashcards.length;
        let activeFlashcards = 0;
        let learningFlashcards = 0;
        let newFlashcards = 0;
        let reviewingFlashcards = 0;
        let masteredFlashcards = 0;
        let suspendedFlashcards = 0; // Renamed from archivedFlashcards for consistency with status
        let archivedFlashcards = 0; // Explicitly for ARCHIVED status
        let dueForReviewCount = 0;
        let totalEaseFactor = 0;
        let totalIntervalDays = 0;
        let reviewedFlashcardsCount = 0;
        let nextGlobalReviewAt: Timestamp | null = null;
        let lastGlobalReviewedAt: Timestamp | null = null;

        flashcards.forEach(fc => {
            if (fc.status === FirebaseFlashcardStatus.ARCHIVED) {
                archivedFlashcards++;
            } else if (fc.status === FirebaseFlashcardStatus.SUSPENDED) {
                suspendedFlashcards++;
            } else {
                activeFlashcards++; // Non-archived, non-suspended are active for learning cycle
                if (fc.status === FirebaseFlashcardStatus.LEARNING) newFlashcards++;
                if (fc.status === FirebaseFlashcardStatus.LEARNING) learningFlashcards++;
                if (fc.status === FirebaseFlashcardStatus.REVIEWING) reviewingFlashcards++;
                if (fc.status === FirebaseFlashcardStatus.MASTERED) masteredFlashcards++;

                if (fc.nextReviewAt && fc.nextReviewAt.toMillis() <= Timestamp.now().toMillis()) {
                    dueForReviewCount++;
                }

                if (fc.lastReviewedAt) {
                    if (!lastGlobalReviewedAt || fc.lastReviewedAt.toMillis() > lastGlobalReviewedAt.toMillis()) {
                        lastGlobalReviewedAt = fc.lastReviewedAt;
                    }
                }
                if (fc.nextReviewAt) {
                    if (!nextGlobalReviewAt || fc.nextReviewAt.toMillis() < nextGlobalReviewAt.toMillis()) {
                        nextGlobalReviewAt = fc.nextReviewAt;
                    }
                }
                totalEaseFactor += fc.srsEaseFactor || 2.5;
                totalIntervalDays += fc.srsInterval || 0;
                if (fc.srsRepetitions && fc.srsRepetitions > 0) reviewedFlashcardsCount++;
            }
        });

        const averageEaseFactor = activeFlashcards > 0 ? totalEaseFactor / activeFlashcards : 2.5;
        const averageIntervalDays = activeFlashcards > 0 ? totalIntervalDays / activeFlashcards : 0;

         const stats: FirebaseFlashcardUserStatistics = {
            userId,
            totalFlashcards,
            activeFlashcards,
            newFlashcards,
            learningFlashcards,
            reviewingFlashcards,
            masteredFlashcards,
            suspendedFlashcards,
            archivedFlashcards,
            deletedFlashcards: 0, // Adicionando campo obrigatório
            averageEaseFactor,
            averageIntervalDays,
            reviewedFlashcardsCount,
            dueForReviewCount: 0, // Adicionando campo obrigatório
            nextReviewAt: nextGlobalReviewAt,
            lastReviewedAt: lastGlobalReviewedAt,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        return stats;
    }

    async updateUserFlashcardStatistics(userId: string, deckId?: string): Promise<FirebaseFlashcardUserStatistics> {
        await this.validateUserExists(userId);
         if (deckId) {
            await this.validateDeckExistsAndBelongsToUser(deckId, userId);
        }
        const stats = await this.getUserFlashcardStatistics(userId, deckId);
        const userStatsRef = db.collection(USER_STATISTICS_COLLECTION).doc(userId);
         if (deckId) {
            // Salvar como subcoleção ou campo aninhado para estatísticas do deck
            // Exemplo: /userStatistics/{userId}/deckFlashcardStats/{deckId}
            const deckStatsRef = userStatsRef.collection("deckFlashcardStats").doc(deckId);
            await deckStatsRef.set(stats, { merge: true });
        } else {
            // Salvar estatísticas globais do usuário
             await userStatsRef.set({ userFlashcardStats: stats, updatedAt: Timestamp.now() }, { merge: true });
        }

        return stats;
    }
}

export const firebaseFlashcardService = new FirebaseFlashcardService();