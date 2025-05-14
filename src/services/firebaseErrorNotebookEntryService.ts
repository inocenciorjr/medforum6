/* eslint-disable @typescript-eslint/no-explicit-any */
import { firestore } from "../config/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore"; // Import FieldValue and Timestamp from firebase-admin/firestore
import {
    FirebaseErrorNotebookEntry,
    FirebaseProgrammedReviewContentType,
    FirebaseProgrammedReviewStatus,
    ReviewQuality,
} from "../types/firebaseTypes"; 
import { 
    createProgrammedReview, 
    updateProgrammedReview, 
    getProgrammedReviewByContentId, 
    deleteProgrammedReviewByContentId 
} from "./firebaseProgrammedReviewService";

const ERROR_NOTEBOOK_ENTRIES_COLLECTION = "errorNotebookEntries";
const ERROR_NOTEBOOKS_COLLECTION = "errorNotebooks";

interface ServiceErrorNotebookEntryCreatePayload {
    notebookId: string;
    questionId: string;
    userAnswer?: string | null;
    errorDescription?: string | null;
    errorCategory?: string | null;
    isResolved?: boolean; 
    personalNotes?: string | null; 
    tags?: string[];
}

interface ServiceErrorNotebookEntryUpdatePayload {
    questionId?: string;
    userAnswer?: string | null;
    errorDescription?: string | null;
    errorCategory?: string | null;
    isResolved?: boolean; 
    resolvedAt?: Timestamp | null; 
    personalNotes?: string | null; 
    tags?: string[];
}


const INITIAL_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL_DAYS = 1;

export const addEntryToNotebook = async (entryData: ServiceErrorNotebookEntryCreatePayload, userId: string): Promise<FirebaseErrorNotebookEntry> => {
    const batch = firestore.batch();
    const entryDocRef = firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION).doc();
    const notebookDocRef = firestore.collection(ERROR_NOTEBOOKS_COLLECTION).doc(entryData.notebookId);
    const now = Timestamp.now();

    const initialNextReviewDate = Timestamp.fromMillis(now.toMillis() + INITIAL_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    const newEntry: FirebaseErrorNotebookEntry = {
        id: entryDocRef.id,
        notebookId: entryData.notebookId,
        questionId: entryData.questionId,
        userNotes: entryData.personalNotes === null ? undefined : entryData.personalNotes, 
        addedAt: now, 
        srsInterval: INITIAL_INTERVAL_DAYS,
        srsEaseFactor: INITIAL_EASE_FACTOR,
        srsRepetitions: 0,
        srsLapses: 0,
        srsStatus: FirebaseProgrammedReviewStatus.LEARNING,
        lastReviewedAt: null,
        nextReviewAt: initialNextReviewDate,
        programmedReviewId: null, 
        createdAt: now,
        updatedAt: now,
    };
    batch.set(entryDocRef, newEntry);

    const notebookSnap = await notebookDocRef.get();
    if (notebookSnap.exists) {
        batch.update(notebookDocRef, {
            entryCount: FieldValue.increment(1),
            lastEntryAt: now,
            updatedAt: now
        });
    } else {
        console.warn(`ErrorNotebook with ID ${entryData.notebookId} not found. Entry count not incremented.`);
    }

    await batch.commit();

    try {
        const programmedReview = await createProgrammedReview({
            userId: userId,
            contentId: newEntry.id,
            contentType: FirebaseProgrammedReviewContentType.ERROR_NOTEBOOK_ENTRY,
            nextReviewAt: newEntry.nextReviewAt!, 
            intervalDays: newEntry.srsInterval || INITIAL_INTERVAL_DAYS, 
            easeFactor: newEntry.srsEaseFactor || INITIAL_EASE_FACTOR, 
            repetitions: newEntry.srsRepetitions || 0, 
            lapses: newEntry.srsLapses || 0, 
            status: newEntry.srsStatus || FirebaseProgrammedReviewStatus.LEARNING, 
            originalAnswerCorrect: null, 
        });
        await entryDocRef.update({ programmedReviewId: programmedReview.id, updatedAt: Timestamp.now() });
        newEntry.programmedReviewId = programmedReview.id;
        newEntry.updatedAt = Timestamp.now(); 
    } catch (error) {
        console.error(`Failed to create ProgrammedReview for ErrorNotebookEntry ${newEntry.id}:`, error);
    }

    return newEntry;
};

export const getEntryById = async (entryId: string): Promise<FirebaseErrorNotebookEntry | null> => {
    const docRef = firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION).doc(entryId);
    const docSnap = await docRef.get();
    return docSnap.exists ? (docSnap.data() as FirebaseErrorNotebookEntry) : null;
};

export const getEntriesByNotebookId = async (notebookId: string): Promise<FirebaseErrorNotebookEntry[]> => {
    const entries: FirebaseErrorNotebookEntry[] = [];
    try {
        // Primeiro, verificar se o notebook pai existe.
        const notebookDocRef = firestore.collection(ERROR_NOTEBOOKS_COLLECTION).doc(notebookId);
        const notebookSnap = await notebookDocRef.get();

        if (!notebookSnap.exists) {
            // console.warn(`Notebook with ID ${notebookId} does not exist. Cannot fetch entries.`);
            return []; // Retorna array vazio se o notebook não existe
        }

        const querySnapshot = await firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION)
            .where("notebookId", "==", notebookId)
            .orderBy("addedAt", "desc") 
            .get();
        querySnapshot.forEach((doc) => {
            entries.push(doc.data() as FirebaseErrorNotebookEntry);
        });
    } catch (error: any) {
        // Se ocorrer um erro durante a consulta (ex: índice faltando após deleção, permissões, etc.)
        console.error(`Error fetching entries for notebook ID ${notebookId}: ${error.message}`);
        // Retorna um array vazio em caso de erro para não quebrar o chamador
        return []; 
    }
    return entries;
};

export const updateEntry = async (entryId: string, updates: ServiceErrorNotebookEntryUpdatePayload): Promise<FirebaseErrorNotebookEntry | null> => {
    const docRef = firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION).doc(entryId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        console.warn(`ErrorNotebookEntry with ID ${entryId} not found for update.`);
        return null;
    }

    const forbiddenUpdates = ["srsInterval", "srsEaseFactor", "srsRepetitions", "srsLapses", "srsStatus", "lastReviewedAt", "nextReviewAt", "programmedReviewId", "addedAt", "createdAt"];
    for (const key of forbiddenUpdates) {
        if (key in updates) {
            throw new Error(`Field '${key}' cannot be updated directly. SRS fields use recordErrorNotebookEntryReview. Timestamps are managed by service.`);
        }
    }
    
    const updatePayload: Partial<FirebaseErrorNotebookEntry> & { resolvedAt?: Timestamp | null} = { updatedAt: Timestamp.now() };

    if (updates.personalNotes !== undefined) {
        updatePayload.userNotes = updates.personalNotes === null ? undefined : updates.personalNotes;
    }
    if (updates.questionId !== undefined) {
        updatePayload.questionId = updates.questionId;
    }

    await docRef.update(updatePayload);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as FirebaseErrorNotebookEntry;
};

export const recordErrorNotebookEntryReview = async (
    entryId: string, 
    userId: string, 
    quality: ReviewQuality,
    userNotesReview?: string | null 
): Promise<FirebaseErrorNotebookEntry | null> => {
    const entryRef = firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION).doc(entryId);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
        console.warn(`ErrorNotebookEntry with ID "${entryId}" not found for review.`);
        return null;
    }
    const currentEntryData = entryDoc.data() as FirebaseErrorNotebookEntry;

    if (!currentEntryData.programmedReviewId) {
        console.error(`ProgrammedReviewId missing for ErrorNotebookEntry ${entryId}. Cannot record review. Attempting to find or create.`);
        let pr = await getProgrammedReviewByContentId(entryId, FirebaseProgrammedReviewContentType.ERROR_NOTEBOOK_ENTRY, userId);
        if (!pr) {
            console.log(`No existing ProgrammedReview found for entry ${entryId}, creating new one.`);
            try {
                pr = await createProgrammedReview({
                    userId: userId,
                    contentId: entryId,
                    contentType: FirebaseProgrammedReviewContentType.ERROR_NOTEBOOK_ENTRY,
                    nextReviewAt: currentEntryData.nextReviewAt || Timestamp.now(), 
                    intervalDays: currentEntryData.srsInterval || INITIAL_INTERVAL_DAYS,
                    easeFactor: currentEntryData.srsEaseFactor || INITIAL_EASE_FACTOR,
                    repetitions: currentEntryData.srsRepetitions || 0,
                    lapses: currentEntryData.srsLapses || 0,
                    status: currentEntryData.srsStatus || FirebaseProgrammedReviewStatus.LEARNING,
                    originalAnswerCorrect: null,
                });
                await entryRef.update({ programmedReviewId: pr.id, updatedAt: Timestamp.now() });
                currentEntryData.programmedReviewId = pr.id;
            } catch (e) {
                console.error(`Failed to create missing ProgrammedReview for entry ${entryId}:`, e);
                return null;
            }
        } else {
            await entryRef.update({ programmedReviewId: pr.id, updatedAt: Timestamp.now() });
            currentEntryData.programmedReviewId = pr.id;
        }
    }

    try {
        const updatedProgrammedReview = await updateProgrammedReview(currentEntryData.programmedReviewId!, quality, userNotesReview === null ? undefined : userNotesReview);
        if (!updatedProgrammedReview) {
            console.error(`Failed to update ProgrammedReview ${currentEntryData.programmedReviewId}.`);
            return null;
        }

        const entryUpdates: Partial<FirebaseErrorNotebookEntry> = {
            srsInterval: updatedProgrammedReview.intervalDays,
            srsEaseFactor: updatedProgrammedReview.easeFactor,
            srsRepetitions: updatedProgrammedReview.repetitions,
            srsLapses: updatedProgrammedReview.lapses,
            srsStatus: updatedProgrammedReview.status,
            lastReviewedAt: updatedProgrammedReview.lastReviewedAt,
            nextReviewAt: updatedProgrammedReview.nextReviewAt,
            updatedAt: Timestamp.now(),
        };
        
        if (userNotesReview !== undefined) {
            entryUpdates.userNotes = userNotesReview === null ? undefined : userNotesReview;
        }

        await entryRef.update(entryUpdates);
        const updatedEntryDoc = await entryRef.get();
        return updatedEntryDoc.data() as FirebaseErrorNotebookEntry;
    } catch (error) {
        console.error(`Error recording review for ErrorNotebookEntry ${entryId}:`, error);
        return null;
    }
};

export const removeEntryFromNotebook = async (entryId: string, userId: string): Promise<boolean> => {
    const entryDocRef = firestore.collection(ERROR_NOTEBOOK_ENTRIES_COLLECTION).doc(entryId);
    const entrySnap = await entryDocRef.get();

    if (!entrySnap.exists) {
        console.warn(`ErrorNotebookEntry with ID ${entryId} not found for deletion.`);
        return false;
    }
    const entryData = entrySnap.data() as FirebaseErrorNotebookEntry;
    const notebookDocRef = firestore.collection(ERROR_NOTEBOOKS_COLLECTION).doc(entryData.notebookId);
    
    const batch = firestore.batch();
    batch.delete(entryDocRef);
    const notebookSnap = await notebookDocRef.get();
    if (notebookSnap.exists) {
        const currentNotebookData = notebookSnap.data();
        if (currentNotebookData && typeof currentNotebookData.entryCount === 'number' && currentNotebookData.entryCount > 0) {
            batch.update(notebookDocRef, {
                entryCount: FieldValue.increment(-1),
                updatedAt: Timestamp.now()
            });
        } else {
             batch.update(notebookDocRef, { 
                updatedAt: Timestamp.now()
            });
        }
    }
    await batch.commit();

    try {
        if (entryData.programmedReviewId) {
            const deletedPR = await deleteProgrammedReviewByContentId(entryId, FirebaseProgrammedReviewContentType.ERROR_NOTEBOOK_ENTRY, userId);
            if (deletedPR) {
                console.log(`Successfully deleted associated ProgrammedReview for ErrorNotebookEntry ${entryId}`);
            } else {
                console.warn(`Could not delete or find associated ProgrammedReview for ErrorNotebookEntry ${entryId}`);
            }
        }
    } catch (error) {
        console.error(`Error deleting associated ProgrammedReview for ErrorNotebookEntry ${entryId}:`, error);
    }
    return true;
};

export const firebaseErrorNotebookEntryService = {
    addEntryToNotebook,
    getEntryById,
    getEntriesByNotebookId,
    updateEntry,
    recordErrorNotebookEntryReview,
    removeEntryFromNotebook,
};

