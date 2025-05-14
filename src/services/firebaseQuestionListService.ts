import { Firestore, Timestamp, FieldValue, FieldPath } from "firebase-admin/firestore";
import {
    FirebaseQuestionList,
    FirebaseQuestionListCreatePayload,
    FirebaseQuestionListUpdatePayload,
    FirebaseQuestionListItem,
    FirebaseQuestionListItemCreatePayload,
    FirebaseQuestionListItemUpdatePayload,
    FirebaseQuestionListStatus,
    FirebaseQuestionListItemStatus,
    ReviewQuality,
    FirebaseUserFavoriteQuestionList // Adicionar tipo para a nova coleção
} from "../types/firebaseTypes";
import { firestore } from "../config/firebaseAdmin"; 
import { firebaseQuestionResponseService } from "./firebaseQuestionResponseService"; 

const QUESTION_LISTS_COLLECTION = "questionLists";
const QUESTION_LIST_ITEMS_COLLECTION = "questionListItems";
const USER_FAVORITE_QUESTION_LISTS_COLLECTION = "userFavoriteQuestionLists"; // Nova coleção

export const firebaseQuestionListService = {
    // --- QuestionList CRUD ---
    async createQuestionList(payload: FirebaseQuestionListCreatePayload): Promise<FirebaseQuestionList> {
        if (!payload.userId) throw new Error("O ID do usuário é obrigatório.");
        if (!payload.title || payload.title.trim() === "") throw new Error("O título da lista é obrigatório.");

        const now = Timestamp.now();
        const newListRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc();

        const newListData: FirebaseQuestionList = {
            id: newListRef.id,
            userId: payload.userId,
            name: payload.name || payload.title, // Usar title como name se não for fornecido
            title: payload.title,
            description: payload.description === undefined ? null : payload.description, // Garantir null se undefined para compatibilidade com Firestore
            isPublic: payload.isPublic === undefined ? false : payload.isPublic,
            tags: payload.tags || [],
            questionCount: 0,
            status: FirebaseQuestionListStatus.ACTIVE, // Default status
            viewCount: 0,
            favoriteCount: 0,
            lastStudyDate: null,
            completionPercentage: 0,
            lastAddedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        await newListRef.set(newListData);
        return newListData;
    },

    async getQuestionListById(listId: string): Promise<FirebaseQuestionList | null> {
        const doc = await firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId).get();
        if (!doc.exists) {
            return null;
        }
        return { id: doc.id, ...doc.data() } as FirebaseQuestionList;
    },

    async updateQuestionList(listId: string, userId: string, updates: FirebaseQuestionListUpdatePayload): Promise<FirebaseQuestionList | null> {
        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId);
        const doc = await listRef.get();

        if (!doc.exists) {
            throw new Error(`Lista de questões com ID "${listId}" não encontrada.`);
        }
        const currentData = doc.data() as FirebaseQuestionList;
        if (currentData.userId !== userId) {
            throw new Error("Usuário não autorizado a atualizar esta lista de questões.");
        }

        const allowedUpdates: Partial<FirebaseQuestionList> = {};
        if (updates.title !== undefined) allowedUpdates.title = updates.title;
        if (updates.description !== undefined) allowedUpdates.description = updates.description === null ? null : updates.description;
        if (updates.isPublic !== undefined) allowedUpdates.isPublic = updates.isPublic;
        if (updates.tags !== undefined) allowedUpdates.tags = updates.tags;
        if (updates.status !== undefined) allowedUpdates.status = updates.status;

        const updateData: Partial<FirebaseQuestionList> = { ...allowedUpdates, updatedAt: Timestamp.now() };
        
        await listRef.update(updateData);
        
        const updatedDoc = await listRef.get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as FirebaseQuestionList;
    },

    async deleteQuestionList(listId: string, userId: string): Promise<boolean> {
        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId);
        const doc = await listRef.get();

        if (!doc.exists) {
            return false; 
        }
        const currentData = doc.data() as FirebaseQuestionList;
        if (currentData.userId !== userId) {
            throw new Error("Usuário não autorizado a deletar esta lista de questões.");
        }

        const batch = firestore.batch();

        // Deletar itens da lista
        const itemsQuery = firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).where("questionListId", "==", listId);
        const itemsSnapshot = await itemsQuery.get();
        if (!itemsSnapshot.empty) {
            itemsSnapshot.docs.forEach(itemDoc => {
                batch.delete(itemDoc.ref);
            });
        }

        // Deletar favoritos associados
        const favoritesQuery = firestore.collection(USER_FAVORITE_QUESTION_LISTS_COLLECTION).where("questionListId", "==", listId);
        const favoritesSnapshot = await favoritesQuery.get();
        if (!favoritesSnapshot.empty) {
            favoritesSnapshot.docs.forEach(favDoc => {
                batch.delete(favDoc.ref);
            });
        }

        batch.delete(listRef);
        await batch.commit();
        return true;
    },

    async listQuestionListsByUser(userId: string, limit: number = 10, startAfterDoc?: any): Promise<{ lists: FirebaseQuestionList[], nextPageToken: any | null }> {
        let query = firestore.collection(QUESTION_LISTS_COLLECTION)
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (startAfterDoc) {
            query = query.startAfter(startAfterDoc);
        }

        const snapshot = await query.get();
        const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseQuestionList));
        const nextPageToken = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1] : null;
        return { lists, nextPageToken };
    },

    // --- QuestionListItem CRUD ---
    async addQuestionToList(payload: FirebaseQuestionListItemCreatePayload): Promise<FirebaseQuestionListItem> {
        if (!payload.questionListId) throw new Error("O ID da lista de questões é obrigatório.");
        if (!payload.questionId) throw new Error("O ID da questão é obrigatório.");
        if (payload.order === undefined) throw new Error("A ordem do item na lista é obrigatória.");

        const existingItemQuery = await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION)
            .where("questionListId", "==", payload.questionListId)
            .where("questionId", "==", payload.questionId)
            .limit(1)
            .get();

        if (!existingItemQuery.empty) {
            throw new Error("Esta questão já existe nesta lista.");
        }

        const now = Timestamp.now();
        const newItemRef = firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc();
        const newItemData: FirebaseQuestionListItem = {
            id: newItemRef.id,
            questionListId: payload.questionListId,
            questionId: payload.questionId,
            order: payload.order,
            personalNotes: payload.personalNotes || null,
            status: FirebaseQuestionListItemStatus.NOT_STARTED,
            isCompleted: false,
            lastAttemptedAt: null,
            correctAttempts: 0,
            incorrectAttempts: 0,
            addedAt: now, 
            createdAt: now,
            updatedAt: now,
        };

        await newItemRef.set(newItemData);

        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(payload.questionListId);
        await listRef.update({
            questionCount: FieldValue.increment(1),
            lastAddedAt: now,
            updatedAt: now
        });

        return newItemData;
    },

    async getQuestionListItemById(itemId: string): Promise<FirebaseQuestionListItem | null> {
        const doc = await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc(itemId).get();
        if (!doc.exists) {
            return null;
        }
        return { id: doc.id, ...doc.data() } as FirebaseQuestionListItem;
    },

    async updateQuestionListItem(itemId: string, listId: string, userId: string, updates: FirebaseQuestionListItemUpdatePayload): Promise<FirebaseQuestionListItem | null> {
        const list = await this.getQuestionListById(listId);
        if (!list || list.userId !== userId) {
            throw new Error("Usuário não autorizado a modificar itens desta lista.");
        }

        const itemRef = firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc(itemId);
        const doc = await itemRef.get();
        if (!doc.exists || doc.data()?.questionListId !== listId) {
            throw new Error(`Item com ID "${itemId}" não encontrado na lista "${listId}".`);
        }
        
        const allowedUpdates: Partial<FirebaseQuestionListItem> = {};
        if (updates.order !== undefined) allowedUpdates.order = updates.order;
        if (updates.personalNotes !== undefined) allowedUpdates.personalNotes = updates.personalNotes || null;

        const updateData: Partial<FirebaseQuestionListItem> = { ...allowedUpdates, updatedAt: Timestamp.now() };
        await itemRef.update(updateData);

        const updatedDoc = await itemRef.get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as FirebaseQuestionListItem;
    },

    async removeQuestionFromList(itemId: string, listId: string, userId: string): Promise<boolean> {
        const list = await this.getQuestionListById(listId);
        if (!list || list.userId !== userId) {
            throw new Error("Usuário não autorizado a remover itens desta lista.");
        }

        const itemRef = firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc(itemId);
        const doc = await itemRef.get();
        if (!doc.exists || doc.data()?.questionListId !== listId) {
            return false; 
        }

        await itemRef.delete();

        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId);
        await listRef.update({
            questionCount: FieldValue.increment(-1),
            updatedAt: Timestamp.now()
        });
        await this.recalculateCompletionPercentage(listId);
        return true;
    },

    async listItemsByQuestionList(listId: string, orderBy: "order" | "addedAt" = "order", direction: "asc" | "desc" = "asc"): Promise<FirebaseQuestionListItem[]> {
        const snapshot = await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION)
            .where("questionListId", "==", listId)
            .orderBy(orderBy, direction)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseQuestionListItem));
    },

    async incrementViewCount(listId: string): Promise<void> {
        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId);
        await listRef.update({
            viewCount: FieldValue.increment(1),
            updatedAt: Timestamp.now(),
        });
    },

    async toggleFavorite(listId: string, userId: string): Promise<{ favorited: boolean; favoriteCount: number }> {
        const listRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId);
        const favoriteRef = firestore.collection(USER_FAVORITE_QUESTION_LISTS_COLLECTION).doc(`${userId}_${listId}`);
        const now = Timestamp.now();
        const batch = firestore.batch();
        let newFavoriteCount = 0;
        let isFavorited = false;

        const listDoc = await listRef.get();
        if (!listDoc.exists) {
            throw new Error("Lista de questões não encontrada.");
        }
        newFavoriteCount = (listDoc.data()?.favoriteCount || 0) as number;

        const favoriteDoc = await favoriteRef.get();

        if (favoriteDoc.exists) {
            // Usuário está desfavoritando
            batch.delete(favoriteRef);
            batch.update(listRef, { 
                favoriteCount: FieldValue.increment(-1),
                updatedAt: now 
            });
            newFavoriteCount = Math.max(0, newFavoriteCount - 1); // Garante que não seja negativo
            isFavorited = false;
        } else {
            // Usuário está favoritando
            const favoriteData: FirebaseUserFavoriteQuestionList = {
                id: favoriteRef.id,
                userId,
                questionListId: listId,
                createdAt: now,
            };
            batch.set(favoriteRef, favoriteData);
            batch.update(listRef, { 
                favoriteCount: FieldValue.increment(1),
                updatedAt: now 
            });
            newFavoriteCount += 1;
            isFavorited = true;
        }

        await batch.commit();
        return { favorited: isFavorited, favoriteCount: newFavoriteCount };
    },

    async getIsFavorite(listId: string, userId: string): Promise<boolean> {
        const favoriteRef = firestore.collection(USER_FAVORITE_QUESTION_LISTS_COLLECTION).doc(`${userId}_${listId}`);
        const favoriteDoc = await favoriteRef.get();
        return favoriteDoc.exists;
    },

    async listFavoriteQuestionListsByUser(userId: string, limit: number = 10, startAfterDoc?: any): Promise<{ lists: FirebaseQuestionList[], nextPageToken: any | null }> {
        let favoriteQuery = firestore.collection(USER_FAVORITE_QUESTION_LISTS_COLLECTION)
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc") // Ordenar por quando foi favoritado
            .limit(limit);

        if (startAfterDoc) {
            favoriteQuery = favoriteQuery.startAfter(startAfterDoc);
        }

        const favoriteSnapshot = await favoriteQuery.get();
        if (favoriteSnapshot.empty) {
            return { lists: [], nextPageToken: null };
        }

        const listIds = favoriteSnapshot.docs.map(doc => (doc.data() as FirebaseUserFavoriteQuestionList).questionListId);
        
        // Firestore "in" query has a limit of 10 items. If more, split into multiple queries.
        // For simplicity here, assuming listIds.length <= 10. For production, handle chunking.
        if (listIds.length === 0) return { lists: [], nextPageToken: null }; // Should not happen if favoriteSnapshot is not empty
        if (listIds.length > 30) {
            console.warn("A consulta de listas favoritas excedeu 30 IDs, o que pode causar problemas de performance ou erro no Firestore. Considere paginação ou uma estrutura de dados diferente se muitos favoritos são esperados.");
            // Truncate for safety in this example, but real solution is chunking
            listIds.splice(30);
        }

        const listsSnapshot = await firestore.collection(QUESTION_LISTS_COLLECTION)
            .where(FieldPath.documentId(), "in", listIds)
            .get();
        
        const lists = listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseQuestionList));
        
        // Re-order lists based on the original favorite order
        const orderedLists = listIds.map(id => lists.find(list => list.id === id)).filter(list => list !== undefined) as FirebaseQuestionList[];

        const nextPageToken = favoriteSnapshot.docs.length === limit ? favoriteSnapshot.docs[favoriteSnapshot.docs.length - 1] : null;
        return { lists: orderedLists, nextPageToken };
    },

    async recalculateCompletionPercentage(listId: string): Promise<void> {
        const items = await this.listItemsByQuestionList(listId);
        if (items.length === 0) {
            await firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId).update({
                completionPercentage: 0,
                updatedAt: Timestamp.now(),
            });
            return;
        }
        const completedItems = items.filter(item => item.isCompleted).length;
        const percentage = Math.round((completedItems / items.length) * 100);
        await firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId).update({
            completionPercentage: percentage,
            updatedAt: Timestamp.now(),
        });
    },

    async recordQuestionListStudyActivity(
        listId: string, 
        userId: string, 
        questionId: string, 
        quality: ReviewQuality, 
        isCorrect: boolean,
        selectedOptionId?: string | null,
        essayResponse?: string | null,
        responseTimeSeconds?: number
    ): Promise<void> {
        const list = await this.getQuestionListById(listId);
        if (!list || list.userId !== userId) {
            throw new Error("Usuário não autorizado ou lista não encontrada.");
        }

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
                questionListId: listId, 
                selectedOptionId: selectedOptionId === null ? undefined : selectedOptionId,
                selectedAlternativeId: selectedOptionId === null ? undefined : selectedOptionId, // Usar selectedOptionId como selectedAlternativeId para compatibilidade
                isCorrectOnFirstAttempt: isCorrect, 
                responseTimeSeconds,
            });
        }

        if (!qrId) {
            throw new Error("Falha ao obter ou criar QuestionResponse para a questão da lista.");
        }

        await firebaseQuestionResponseService.recordQuestionReview(
            qrId,
            quality,
            userId
        );

        const listItemSnapshot = await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION)
            .where("questionListId", "==", listId)
            .where("questionId", "==", questionId)
            .limit(1)
            .get();

        if (!listItemSnapshot.empty) {
            const listItemRef = listItemSnapshot.docs[0].ref;
            const listItemData = listItemSnapshot.docs[0].data() as FirebaseQuestionListItem;
            const now = Timestamp.now();
            const updates: Partial<FirebaseQuestionListItem> = {
                lastAttemptedAt: now,
                isCompleted: listItemData.isCompleted || isCorrect, 
                updatedAt: now
            };
            if (isCorrect) {
                updates.correctAttempts = FieldValue.increment(1) as any;
            } else {
                updates.incorrectAttempts = FieldValue.increment(1) as any;
            }
            await listItemRef.update(updates);
            await this.recalculateCompletionPercentage(listId);
        }
        
        await firestore.collection(QUESTION_LISTS_COLLECTION).doc(listId).update({
            lastStudyDate: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        console.log(`Atividade de estudo registrada para questão ${questionId} na lista ${listId} pelo usuário ${userId}`);
    },

    // Atualizar o status de tentativa de uma questão em uma lista
    async updateQuestionListItemAttempt(questionListId: string, questionId: string, isCorrect: boolean): Promise<void> {
        try {
            const questionListRef = firestore.collection(QUESTION_LISTS_COLLECTION).doc(questionListId);
            const questionListItemsRef = questionListRef.collection("items");
            
            // Buscar o item da questão na lista
            const querySnapshot = await questionListItemsRef.where("questionId", "==", questionId).get();
            
            if (querySnapshot.empty) {
                console.warn(`Questão ${questionId} não encontrada na lista ${questionListId}`);
                return;
            }
            
            const itemDoc = querySnapshot.docs[0];
            
            // Atualizar o status da tentativa
            const updateData: Partial<FirebaseQuestionListItem> = {
                lastAttemptedAt: Timestamp.now(),
                status: isCorrect ? FirebaseQuestionListItemStatus.ANSWERED_CORRECTLY : FirebaseQuestionListItemStatus.ANSWERED_INCORRECTLY
            };
            
            await itemDoc.ref.update(updateData);
            
            // Atualizar a data de último estudo da lista
            await questionListRef.update({
                lastStudyDate: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            
            // Recalcular a porcentagem de conclusão da lista
            await this.recalculateCompletionPercentage(questionListId);
            
            console.log(`Status de tentativa atualizado para questão ${questionId} na lista ${questionListId}: ${isCorrect ? 'Correta' : 'Incorreta'}`);
        } catch (error) {
            console.error("Erro ao atualizar tentativa de questão na lista:", error);
            throw error;
        }
    }
};
