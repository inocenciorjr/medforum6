import { Timestamp, QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { firestore as db } from "../config/firebaseAdmin"; // Corrigido o caminho para config
import { FirebaseDeck, FirebaseDeckStatus, FirebaseFlashcard } from "../types/firebaseTypes"; 
import { AppError } from "../utils/errors"; // Corrigido o caminho para utils

const DECKS_COLLECTION = "decks";
const FLASHCARDS_COLLECTION = "flashcards";
const USER_INTERACTIONS_COLLECTION = "userFlashcardInteractions";

// Interface for Deck Creation Payload
export interface FirebaseDeckCreatePayload {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
    coverImageUrl?: string;
    status?: FirebaseDeckStatus; // Status do Deck, alinhado com FirebaseDeckStatus
}

// Interface for Deck Update Payload
export interface FirebaseDeckUpdatePayload {
    name?: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
    coverImageUrl?: string;
    status?: FirebaseDeckStatus; // Status do Deck, alinhado com FirebaseDeckStatus
}

// Interface for pagination result
interface PaginatedDecksResult {
    data: FirebaseDeck[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export class FirebaseDeckService {

    static async createDeck(data: FirebaseDeckCreatePayload): Promise<FirebaseDeck> {
        const { userId, name, description, isPublic, tags, coverImageUrl, status } = data;

        if (!name) {
            throw AppError.badRequest("O nome do deck é obrigatório.");
        }

        const newDeckData = {
            userId,
            name,
            description: description || "",
            isPublic: isPublic === undefined ? false : isPublic,
            tags: tags || [],
            coverImageUrl: coverImageUrl || "",
            status: status || FirebaseDeckStatus.ACTIVE, // Usando FirebaseDeckStatus
            flashcardCount: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        const newDeckRef = await db.collection(DECKS_COLLECTION).add(newDeckData);
        return { id: newDeckRef.id, ...newDeckData } as FirebaseDeck;
    }

    static async getDeckById(deckId: string, requestingUserId?: string): Promise<FirebaseDeck | null> {
        const deckDoc = await db.collection(DECKS_COLLECTION).doc(deckId).get();
        if (!deckDoc.exists) {
            return null;
        }
        const deck = { id: deckDoc.id, ...deckDoc.data() } as FirebaseDeck;

        if (!deck.isPublic && deck.userId !== requestingUserId) {
            throw AppError.forbidden("Usuário não autorizado a acessar este deck.");
        }
        return deck;
    }

    static async getDecksByUser(
        userId: string,
        page: number = 1,
        limit: number = 10,
        filters: {
            status?: FirebaseDeckStatus; // Usando FirebaseDeckStatus
            tags?: string[];
            search?: string;
            sortBy?: string;
            sortOrder?: "ASC" | "DESC";
        } = {}
    ): Promise<PaginatedDecksResult> {
        let query: FirebaseFirestore.Query = db.collection(DECKS_COLLECTION).where("userId", "==", userId);

        if (filters.status) {
            query = query.where("status", "==", filters.status);
        } else {
            query = query.where("status", "==", FirebaseDeckStatus.ACTIVE);
        }

        if (filters.tags && filters.tags.length > 0) {
            query = query.where("tags", "array-contains-any", filters.tags);
        }
        
        const sortBy = filters.sortBy || "createdAt";
        const sortOrder = filters.sortOrder === "DESC" ? "desc" : "asc";
        query = query.orderBy(sortBy, sortOrder);

        const allUserDecksSnapshot = await query.get(); 
        let decksData = allUserDecksSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as FirebaseDeck));

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            decksData = decksData.filter((deck: FirebaseDeck) => deck.name.toLowerCase().includes(searchTerm) || (deck.description && deck.description.toLowerCase().includes(searchTerm)));
        }
        
        const total = decksData.length;
        const paginatedDecks = decksData.slice((page - 1) * limit, page * limit);

        return {
            data: paginatedDecks,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    static async updateDeck(deckId: string, userId: string, data: FirebaseDeckUpdatePayload): Promise<FirebaseDeck> {
        const deckRef = db.collection(DECKS_COLLECTION).doc(deckId);
        const deckDoc = await deckRef.get();

        if (!deckDoc.exists) {
            throw AppError.notFound("Deck não encontrado.");
        }

        const deckData = deckDoc.data() as FirebaseDeck;
        if (deckData.userId !== userId) {
            throw AppError.forbidden("Usuário não autorizado a atualizar este deck.");
        }

        const updatePayload: Partial<FirebaseDeck> = { ...data, updatedAt: Timestamp.now() };
        await deckRef.update(updatePayload);

        const updatedDeckDoc = await deckRef.get();
        return { id: updatedDeckDoc.id, ...updatedDeckDoc.data() } as FirebaseDeck;
    }

    static async deleteDeck(deckId: string, userId: string): Promise<void> {
        const deckRef = db.collection(DECKS_COLLECTION).doc(deckId);
        const deckDoc = await deckRef.get();

        if (!deckDoc.exists) {
            throw AppError.notFound("Deck não encontrado.");
        }

        const deckData = deckDoc.data() as FirebaseDeck;
        if (deckData.userId !== userId) {
            throw AppError.forbidden("Usuário não autorizado a excluir este deck.");
        }

        const flashcardsQuery = db.collection(FLASHCARDS_COLLECTION)
            .where("deckId", "==", deckId)
            .where("userId", "==", userId); 

        const flashcardsSnapshot = await flashcardsQuery.get();
        
        if (flashcardsSnapshot.empty) {
            await deckRef.delete();
            return;
        }

        const batch = db.batch();

        const flashcardIdsToDelete: string[] = [];
        flashcardsSnapshot.forEach(doc => {
            flashcardIdsToDelete.push(doc.id);
            batch.delete(doc.ref); 
        });

        const chunkSize = 30;
        for (let i = 0; i < flashcardIdsToDelete.length; i += chunkSize) {
            const chunk = flashcardIdsToDelete.slice(i, i + chunkSize);
            if (chunk.length > 0) {
                const interactionsQuery = db.collection(USER_INTERACTIONS_COLLECTION)
                    .where("flashcardId", "in", chunk)
                    .where("userId", "==", userId);
                const interactionsSnapshot = await interactionsQuery.get();
                interactionsSnapshot.forEach(interactionDoc => {
                    batch.delete(interactionDoc.ref); 
                });
            }
        }

        batch.delete(deckRef);
        await batch.commit();
    }

    static async toggleArchiveDeck(deckId: string, userId: string): Promise<FirebaseDeck> {
        const deckRef = db.collection(DECKS_COLLECTION).doc(deckId);
        const deckDoc = await deckRef.get();

        if (!deckDoc.exists) {
            throw AppError.notFound("Deck não encontrado.");
        }
        const deck = deckDoc.data() as FirebaseDeck;
        if (deck.userId !== userId) {
            throw AppError.forbidden("Usuário não autorizado a modificar este deck.");
        }

        const newStatus = deck.status === FirebaseDeckStatus.ACTIVE ? FirebaseDeckStatus.ARCHIVED : FirebaseDeckStatus.ACTIVE;
        await deckRef.update({ status: newStatus, updatedAt: Timestamp.now() });
        return { ...deck, id: deckId, status: newStatus, updatedAt: Timestamp.now() };
    }

    static async togglePublicDeck(deckId: string, userId: string): Promise<FirebaseDeck> {
        const deckRef = db.collection(DECKS_COLLECTION).doc(deckId);
        const deckDoc = await deckRef.get();

        if (!deckDoc.exists) {
            throw AppError.notFound("Deck não encontrado.");
        }
        const deck = deckDoc.data() as FirebaseDeck;
        if (deck.userId !== userId) {
            throw AppError.forbidden("Usuário não autorizado a modificar este deck.");
        }

        const newIsPublic = !deck.isPublic;
        await deckRef.update({ isPublic: newIsPublic, updatedAt: Timestamp.now() });
        return { ...deck, id: deckId, isPublic: newIsPublic, updatedAt: Timestamp.now() };
    }

    static async getPublicDecks(
        page: number = 1,
        limit: number = 10,
        filters: {
            tags?: string[];
            search?: string;
            sortBy?: string;
            sortOrder?: "ASC" | "DESC";
        } = {}
    ): Promise<PaginatedDecksResult> {
        let query: FirebaseFirestore.Query = db.collection(DECKS_COLLECTION).where("isPublic", "==", true)
                                                    .where("status", "==", FirebaseDeckStatus.ACTIVE);

        if (filters.tags && filters.tags.length > 0) {
            query = query.where("tags", "array-contains-any", filters.tags);
        }

        const sortBy = filters.sortBy || "createdAt";
        const sortOrder = filters.sortOrder === "DESC" ? "desc" : "asc";
        query = query.orderBy(sortBy, sortOrder);

        const allPublicDecksSnapshot = await query.get();
        let decksData = allPublicDecksSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as FirebaseDeck));

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            decksData = decksData.filter((deck: FirebaseDeck) => deck.name.toLowerCase().includes(searchTerm) || (deck.description && deck.description.toLowerCase().includes(searchTerm)));
        }

        const total = decksData.length;
        const paginatedDecks = decksData.slice((page - 1) * limit, page * limit);

        return {
            data: paginatedDecks,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    static async addPublicDeckToUserLibrary(deckIdToClone: string, newUserId: string): Promise<FirebaseDeck> {
        const originalDeckDoc = await db.collection(DECKS_COLLECTION).doc(deckIdToClone).get();
        if (!originalDeckDoc.exists) {
            throw AppError.notFound("Deck público original não encontrado.");
        }

        const originalDeck = originalDeckDoc.data() as FirebaseDeck;
        if (!originalDeck.isPublic) {
            throw AppError.forbidden("Este deck não é público e não pode ser clonado.");
        }

        const clonedDeckData: FirebaseDeckCreatePayload = {
            userId: newUserId,
            name: originalDeck.name, 
            description: originalDeck.description,
            isPublic: false, 
            tags: originalDeck.tags ? [...originalDeck.tags] : [], 
            coverImageUrl: originalDeck.coverImageUrl,
            status: FirebaseDeckStatus.ACTIVE,
        };

        const newDeck = await this.createDeck(clonedDeckData);

        const originalFlashcardsSnapshot = await db.collection(FLASHCARDS_COLLECTION).where("deckId", "==", deckIdToClone).get();
        
        const batch = db.batch();
        let newFlashcardCount = 0;

        originalFlashcardsSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const flashcardData = doc.data() as FirebaseFlashcard;
            const newFlashcardRef = db.collection(FLASHCARDS_COLLECTION).doc(); 
            batch.set(newFlashcardRef, {
                ...flashcardData,
                id: newFlashcardRef.id, 
                userId: newUserId, 
                deckId: newDeck.id, 
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                lastReviewedAt: null,
                nextReviewAt: Timestamp.now(),
                intervalDays: 0,
                easeFactor: 2.5,
                reviewsCount: 0,
                lapsesCount: 0,
            });
            newFlashcardCount++;
        });

        if (newFlashcardCount > 0) {
            await batch.commit();
        }

        await db.collection(DECKS_COLLECTION).doc(newDeck.id).update({ flashcardCount: newFlashcardCount, updatedAt: Timestamp.now() });

        return { ...newDeck, flashcardCount: newFlashcardCount };
    }

    static async _updateFlashcardCount(deckId: string, increment: boolean): Promise<void> {
        const deckRef = db.collection(DECKS_COLLECTION).doc(deckId);
        await db.runTransaction(async (transaction) => {
            const deckDoc = await transaction.get(deckRef);
            if (!deckDoc.exists) {
                throw AppError.notFound("Deck não encontrado para atualizar contagem de flashcards.");
            }
            const currentCount = deckDoc.data()?.flashcardCount || 0;
            const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);
            transaction.update(deckRef, { flashcardCount: newCount, updatedAt: Timestamp.now() });
        });
    }
}

// Exportar o método estático para ser importável diretamente
export const getDeckById = FirebaseDeckService.getDeckById;

