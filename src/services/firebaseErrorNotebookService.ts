/* eslint-disable @typescript-eslint/no-explicit-any */
import admin from "firebase-admin"; // Adicionado para tipagem do QueryDocumentSnapshot
import { firestore } from "../config/firebaseAdmin"; // Caminho relativo corrigido
import { FirebaseErrorNotebook, FirebaseErrorNotebookCreatePayload, FirebaseErrorNotebookUpdatePayload } from "../types/firebaseTypes"; // Caminho relativo corrigido
import { Timestamp } from "firebase-admin/firestore";

const ERROR_NOTEBOOKS_COLLECTION = "errorNotebooks";
const db = firestore;

export const createErrorNotebook = async (notebookData: FirebaseErrorNotebookCreatePayload): Promise<string> => {
    const docRef = db.collection(ERROR_NOTEBOOKS_COLLECTION).doc();
    const now = Timestamp.now();
    const newNotebook: FirebaseErrorNotebook = {
        id: docRef.id,
        userId: notebookData.userId,
        title: notebookData.title,
        description: notebookData.description || null,
        isPublic: notebookData.isPublic !== undefined ? notebookData.isPublic : false,
        lastEntryAt: null,
        entryCount: 0,
        tags: notebookData.tags || [],
        createdAt: now,
        updatedAt: now,
    };
    await docRef.set(newNotebook);
    return docRef.id;
};

export const getErrorNotebookById = async (notebookId: string): Promise<FirebaseErrorNotebook | null> => {
    const docRef = db.collection(ERROR_NOTEBOOKS_COLLECTION).doc(notebookId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        return docSnap.data() as FirebaseErrorNotebook;
    }
    return null;
};

export const getErrorNotebooksByUserId = async (userId: string): Promise<FirebaseErrorNotebook[]> => {
    const notebooks: FirebaseErrorNotebook[] = [];
    try {
        // Tentativa com índice composto (se existir)
        const querySnapshot = await db.collection(ERROR_NOTEBOOKS_COLLECTION)
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();
        querySnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            notebooks.push(doc.data() as FirebaseErrorNotebook);
        });
        return notebooks;
    } catch (error) {
        console.warn("Erro ao buscar com índice composto, tentando alternativa:", error);
        // Alternativa sem ordenação (não requer índice composto)
        const querySnapshot = await db.collection(ERROR_NOTEBOOKS_COLLECTION)
            .where("userId", "==", userId)
            .get();
        querySnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            notebooks.push(doc.data() as FirebaseErrorNotebook);
        });
        // Ordenar em memória
        notebooks.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime(); // ordem decrescente
        });
        return notebooks;
    }
};

export const updateErrorNotebook = async (notebookId: string, updates: FirebaseErrorNotebookUpdatePayload): Promise<boolean> => {
    const docRef = db.collection(ERROR_NOTEBOOKS_COLLECTION).doc(notebookId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        console.warn(`ErrorNotebook with ID ${notebookId} not found for update.`);
        return false;
    }
    await docRef.update({
        ...updates,
        updatedAt: Timestamp.now(),
    });
    return true;
};

export const deleteErrorNotebook = async (notebookId: string): Promise<boolean> => {
    const notebookDocRef = db.collection(ERROR_NOTEBOOKS_COLLECTION).doc(notebookId);
    const notebookSnap = await notebookDocRef.get();

    if (!notebookSnap.exists) {
        console.warn(`ErrorNotebook with ID ${notebookId} not found for deletion.`);
        return false;
    }

    const batch = db.batch();

    const entriesQuery = db.collection("errorNotebookEntries").where("notebookId", "==", notebookId);
    const entriesSnapshot = await entriesQuery.get();
    
    if (!entriesSnapshot.empty) {
        console.log(`Found ${entriesSnapshot.size} entries to delete for notebook ${notebookId}.`);
        entriesSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => { // Tipagem explícita adicionada
            batch.delete(doc.ref);
        });
    }

    batch.delete(notebookDocRef);

    try {
        await batch.commit();
        console.log(`Successfully deleted ErrorNotebook ${notebookId} and its associated entries.`);
        return true;
    } catch (error) {
        console.error(`Error deleting ErrorNotebook ${notebookId} and its entries:`, error);
        return false;
    }
};

export const firebaseErrorNotebookService = {
    createErrorNotebook,
    getErrorNotebookById,
    getErrorNotebooksByUserId,
    updateErrorNotebook,
    deleteErrorNotebook,
};
