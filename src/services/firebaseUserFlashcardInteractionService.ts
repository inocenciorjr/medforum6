import { Timestamp, Transaction, QueryDocumentSnapshot, DocumentData, FieldPath, Query } from "firebase-admin/firestore";
import { 
    FirebaseUserFlashcardInteraction, 
    ReviewQuality,
    FirebaseFlashcard // For returning in getDueFlashcardsForUser
} from "../types/firebaseTypes";
import { getDbInstance } from "../firebase_config/firebaseAdmin"; // Corrected import
import { AppError } from "@/utils/errors";

const db = getDbInstance(); // Corrected usage
const interactionsCollection = db.collection("userFlashcardInteractions");
const flashcardsCollection = db.collection("flashcards"); 

const MIN_EASINESS_FACTOR = 1.3;
const INITIAL_EASINESS_FACTOR = 2.5;
const LEECH_THRESHOLD = 8; // Number of consecutive failures to mark as leech

class FirebaseUserFlashcardInteractionService {

    async getOrCreateUserFlashcardInteraction(userId: string, flashcardId: string, deckId?: string): Promise<FirebaseUserFlashcardInteraction> {
        const interactionRef = interactionsCollection.doc(`${userId}_${flashcardId}`);
        const doc = await interactionRef.get();
        const now = Timestamp.now();

        if (doc.exists) {
            return doc.data() as FirebaseUserFlashcardInteraction;
        }

        const newInteraction: FirebaseUserFlashcardInteraction = {
            id: interactionRef.id,
            userId,
            flashcardId,
            deckId: deckId || undefined,
            easeFactor: INITIAL_EASINESS_FACTOR,
            interval: 0, 
            repetitions: 0,
            lastReviewedAt: now, 
            nextReviewAt: now,   
            isLearning: true,
            isLeech: false,
            failStreak: 0, // Initialize failStreak
            lastReviewQuality: 0, 
            createdAt: now,
            updatedAt: now,
        };
        await interactionRef.set(newInteraction);
        return newInteraction;
    }

    async recordFlashcardReview(
        userId: string, 
        flashcardId: string, 
        deckId: string | undefined, 
        reviewData: { quality: ReviewQuality; studyTime?: number; reviewNotes?: string }
    ): Promise<FirebaseUserFlashcardInteraction> {
        const interactionRef = interactionsCollection.doc(`${userId}_${flashcardId}`);
        const now = Timestamp.now();
        const { quality, studyTime, reviewNotes } = reviewData;

        if (quality < 0 || quality > 5) {
            throw AppError.badRequest("Qualidade da revisão inválida. Deve ser entre 0 e 5.");
        }

        return db.runTransaction(async (transaction: Transaction) => {
            const doc = await transaction.get(interactionRef);
            let currentInteraction: FirebaseUserFlashcardInteraction;

            if (!doc.exists) {
                currentInteraction = {
                    id: interactionRef.id,
                    userId,
                    flashcardId,
                    deckId: deckId || undefined,
                    easeFactor: INITIAL_EASINESS_FACTOR,
                    interval: 0,
                    repetitions: 0,
                    lastReviewedAt: now,
                    nextReviewAt: now, 
                    isLearning: true,
                    isLeech: false,
                    failStreak: 0, // Initialize failStreak for new interaction
                    createdAt: now,
                    updatedAt: now,
                    lastReviewQuality: quality,
                    studyTime: studyTime || undefined,
                    reviewNotes: reviewNotes || undefined,
                };
            } else {
                currentInteraction = doc.data() as FirebaseUserFlashcardInteraction;
            }

            let { easeFactor, interval, repetitions, isLeech, failStreak } = currentInteraction;
            failStreak = failStreak || 0; // Ensure failStreak is initialized if not present (e.g. older documents)

            if (quality < 3) { 
                repetitions = 0; 
                interval = 1;    
                failStreak += 1;
                if (failStreak >= LEECH_THRESHOLD) {
                    isLeech = true;
                }
            } else { 
                repetitions += 1;
                failStreak = 0; // Reset fail streak on success
                isLeech = false; // Reset leech status on success
                if (repetitions === 1) {
                    interval = 1;
                } else if (repetitions === 2) {
                    interval = 6;
                } else {
                    interval = Math.round(interval * easeFactor);
                }
                easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (easeFactor < MIN_EASINESS_FACTOR) {
                    easeFactor = MIN_EASINESS_FACTOR;
                }
            }
            
            interval = Math.min(interval, 365);
            interval = Math.max(interval, 1);

            const nextReviewDate = new Date(now.toDate());
            nextReviewDate.setDate(nextReviewDate.getDate() + interval);

            const updatedInteraction: FirebaseUserFlashcardInteraction = {
                ...currentInteraction,
                easeFactor,
                interval,
                repetitions,
                isLeech,
                failStreak,
                lastReviewedAt: now,
                nextReviewAt: Timestamp.fromDate(nextReviewDate),
                isLearning: quality < 4, 
                lastReviewQuality: quality,
                studyTime: studyTime !== undefined ? studyTime : currentInteraction.studyTime,
                reviewNotes: reviewNotes !== undefined ? reviewNotes : currentInteraction.reviewNotes,
                updatedAt: now,
            };

            const dataToSetInTransaction: any = {};
            for (const key in updatedInteraction) {
                if (updatedInteraction[key as keyof FirebaseUserFlashcardInteraction] !== undefined) {
                    dataToSetInTransaction[key] = updatedInteraction[key as keyof FirebaseUserFlashcardInteraction];
                }
            }

            transaction.set(interactionRef, dataToSetInTransaction);
            return updatedInteraction; 
        });
    }

    async getDueFlashcardsForUser(userId: string, deckId?: string, limit: number = 20): Promise<FirebaseFlashcard[]> {
        const now = Timestamp.now(); 
        if (!(now instanceof Timestamp)) {
            console.error("Error: Timestamp.now() did not return a valid Timestamp object.");
        }

        let query: Query = interactionsCollection
            .where("userId", "==", userId)
            .where("nextReviewAt", "<=", now) 
            .orderBy("nextReviewAt", "asc");

        if (deckId) {
            query = query.where("deckId", "==", deckId);
        }

        query = query.limit(limit); 

        const snapshot = await query.get();
        if (snapshot.empty) {
            return [];
        }

        const dueFlashcardInteractions = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data() as FirebaseUserFlashcardInteraction);
        const dueFlashcardIds = dueFlashcardInteractions.map((interaction: FirebaseUserFlashcardInteraction) => interaction.flashcardId);
        
        if (dueFlashcardIds.length === 0) return [];

        const flashcardDetailsMap = new Map<string, FirebaseFlashcard>();
        for (let i = 0; i < dueFlashcardIds.length; i += 30) {
            const batchIds = dueFlashcardIds.slice(i, i + 30);
            if (batchIds.length > 0) {
                const flashcardsSnapshot = await flashcardsCollection.where(FieldPath.documentId(), "in", batchIds).get();
                flashcardsSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => { 
                    const fc = { id: doc.id, ...doc.data() } as FirebaseFlashcard;
                    if (fc.userId === userId) { 
                         flashcardDetailsMap.set(fc.id, fc);
                    }
                });
            }
        }
        
        return dueFlashcardInteractions
            .map((interaction: FirebaseUserFlashcardInteraction) => flashcardDetailsMap.get(interaction.flashcardId))
            .filter((fc?: FirebaseFlashcard): fc is FirebaseFlashcard => fc !== undefined);
    }

    async resetFlashcardProgress(userId: string, flashcardId: string, deckId?: string): Promise<FirebaseUserFlashcardInteraction> {
        const interactionRef = interactionsCollection.doc(`${userId}_${flashcardId}`);
        const now = Timestamp.now();
        const doc = await interactionRef.get();

        const existingData = doc.exists ? doc.data() as FirebaseUserFlashcardInteraction : {} as Partial<FirebaseUserFlashcardInteraction>;        

        const fullResetInteractionData: FirebaseUserFlashcardInteraction = {
            id: interactionRef.id,
            userId,
            flashcardId,
            deckId: deckId || existingData.deckId || undefined,
            easeFactor: INITIAL_EASINESS_FACTOR,
            interval: 0,
            repetitions: 0,
            lastReviewedAt: now,
            nextReviewAt: now,
            isLearning: true,
            isLeech: false,
            failStreak: 0, // Reset failStreak
            lastReviewQuality: 0, 
            createdAt: existingData.createdAt || now, 
            updatedAt: now,
            studyTime: existingData.studyTime || undefined,
            reviewNotes: existingData.reviewNotes || undefined,
        };

        const dataToSet: any = {};
        for (const key in fullResetInteractionData) {
            if (fullResetInteractionData[key as keyof FirebaseUserFlashcardInteraction] !== undefined) {
                dataToSet[key] = fullResetInteractionData[key as keyof FirebaseUserFlashcardInteraction];
            }
        }

        await interactionRef.set(dataToSet); 
        return fullResetInteractionData; 
    }

    async getFlashcardStatsForUser(userId: string, flashcardId: string): Promise<FirebaseUserFlashcardInteraction | null> {
        const interactionRef = interactionsCollection.doc(`${userId}_${flashcardId}`);
        const doc = await interactionRef.get();
        if (!doc.exists) {
            return null;
        }
        return doc.data() as FirebaseUserFlashcardInteraction;
    }

    async getFlashcardSRSDetails(userId: string, flashcardId: string): Promise<FirebaseUserFlashcardInteraction | null> {
        const interactionRef = interactionsCollection.doc(`${userId}_${flashcardId}`);
        const doc = await interactionRef.get();
        if (!doc.exists) {
            return null;
        }
        return doc.data() as FirebaseUserFlashcardInteraction;
    }

}

export default new FirebaseUserFlashcardInteractionService();

