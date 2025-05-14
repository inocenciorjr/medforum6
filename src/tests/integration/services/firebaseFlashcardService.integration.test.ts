import { initializeAppIfNeeded, firestore, clearCollection, admin } from "../../../config/firebaseAdmin"; // Added admin
import { firebaseFlashcardService } from "../../../services/firebaseFlashcardService";
import {
    FirebaseFlashcard,
    FirebaseFlashcardCreatePayload,
    FirebaseFlashcardStatus, // Corrected back to FirebaseFlashcardStatus
    FirebaseUserFlashcardInteraction,
    FirebaseDeck,
    FirebaseDeckStatus, // Added import for FirebaseDeckStatus
    ReviewQuality,
    UserRole,
    FirebaseContentStatus // Added for deck status
} from "../../../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";

// Coleções para limpeza
const FLASHCARDS_COLLECTION = "flashcards";
const USER_INTERACTIONS_COLLECTION = "userFlashcardInteractions";
const USERS_COLLECTION = "users";
const DECKS_COLLECTION = "decks"; 

describe("FirebaseFlashcardService Integration Tests", () => {
    let testUserId = `testUser_FCS_${Date.now()}`;
    let testDeckId = `testDeck_FCS_${Date.now()}`;
    let createdFlashcardId: string;

    const ensureTestUser = async (userId: string) => {
        const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                id: userId,
                uid: userId,
                name: "Test User for Flashcard Service",
                email: `${userId}@example.com`,
                role: UserRole.STUDENT, 
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        }
    };

    const ensureTestDeck = async (deckId: string, userId: string, title?: string) => {
        const deckRef = firestore.collection(DECKS_COLLECTION).doc(deckId);
        const deckDoc = await deckRef.get();
        if (!deckDoc.exists) {
            await deckRef.set({
                id: deckId,
                userId: userId,
                name: title || `Test Deck ${deckId}`,
                // title: title || `Test Deck ${deckId}`, // 'title' is not a direct property of FirebaseDeck, 'name' is used.
                description: "A test deck for flashcards", 
                flashcardCount: 0,
                isPublic: false,
                status: FirebaseDeckStatus.ACTIVE, // Using FirebaseDeckStatus for deck
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            } as FirebaseDeck);
        }
    };

    beforeAll(async () => {
        // Firebase Admin SDK já foi inicializado no jest.setup.js
        await ensureTestUser(testUserId);
        await ensureTestDeck(testDeckId, testUserId, "Main Test Deck");
    });

    afterEach(async () => {
        if (createdFlashcardId) {
            await clearCollection(USER_INTERACTIONS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("flashcardId", "==", createdFlashcardId));
            await clearCollection(FLASHCARDS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("id", "==", createdFlashcardId));
        }
        await clearCollection(FLASHCARDS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("userId", "==", testUserId));
        await clearCollection(USER_INTERACTIONS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("userId", "==", testUserId));
        createdFlashcardId = "";
    });

    afterAll(async () => {
        await clearCollection(USERS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("id", "==", testUserId));
        await clearCollection(DECKS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where(admin.firestore.FieldPath.documentId(), "in", [testDeckId, `otherDeck_${testUserId}`]));
    });

    describe("createFlashcard", () => {
        it("should create a new flashcard with default SRS fields and active status", async () => {
            const payload: FirebaseFlashcardCreatePayload = {
                userId: testUserId,
                deckId: testDeckId,
                frontText: "Test Front", // Added for payload compatibility
                backText: "Test Back",   // Added for payload compatibility
                frontContent: "Test Front", 
                backContent: "Test Back",   
                status: FirebaseFlashcardStatus.LEARNING 
            };
            const flashcard = await firebaseFlashcardService.createFlashcard(payload);
            createdFlashcardId = flashcard.id;

            expect(flashcard).toBeDefined();
            expect(flashcard.id).toBeTruthy();
            expect(flashcard.userId).toBe(testUserId);
            expect(flashcard.deckId).toBe(testDeckId);
            expect(flashcard.frontContent).toBe("Test Front"); // Corrected from front
            expect(flashcard.status).toBe(FirebaseFlashcardStatus.LEARNING);
            expect(flashcard.lastReviewedAt).toBeNull();
            expect(flashcard.nextReviewAt).toBeInstanceOf(Timestamp); 
            expect(flashcard.intervalDays).toBe(0);
            expect(flashcard.easeFactor).toBe(2.5);
            expect(flashcard.repetitions).toBe(0); // Corrected from reviewsCount
            expect(flashcard.lapses).toBe(0);      // Corrected from lapsesCount

            const fetchedFlashcard = await firebaseFlashcardService.getFlashcardById(flashcard.id, testUserId);
            expect(fetchedFlashcard).toEqual(flashcard);
        });
    });

    describe("getFlashcardById", () => {
        it("should return null if flashcard not found", async () => {
            const flashcard = await firebaseFlashcardService.getFlashcardById("nonExistentId", testUserId);
            expect(flashcard).toBeNull();
        });

        it("should throw an error if user is not authorized", async () => {
            const payload: FirebaseFlashcardCreatePayload = { userId: testUserId, deckId: testDeckId, frontText: "F1", backText: "B1", frontContent: "F1", backContent: "B1", status: FirebaseFlashcardStatus.LEARNING }; 
            const flashcard = await firebaseFlashcardService.createFlashcard(payload);
            createdFlashcardId = flashcard.id;
            await expect(firebaseFlashcardService.getFlashcardById(flashcard.id, "otherUserId")).rejects.toThrow("Usuário não autorizado a acessar este flashcard.");
        });
    });

    describe("recordFlashcardReview", () => {
        it("should update SRS fields correctly for a good review (quality EASY)", async () => {
            const flashcard = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "Q", backText: "A", frontContent: "Q", backContent: "A", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = flashcard.id;

            const reviewQuality = ReviewQuality.EASY;
            const { updatedFlashcard, interaction } = await firebaseFlashcardService.recordFlashcardReview(testUserId, flashcard.id, reviewQuality);

            expect(updatedFlashcard.repetitions).toBe(1); // Corrected from reviewsCount
            expect(updatedFlashcard.lapses).toBe(0);      // Corrected from lapsesCount
            expect(updatedFlashcard.intervalDays).toBe(1); 
            expect(updatedFlashcard.easeFactor).toBeCloseTo(2.5 + (0.1 - (5 - reviewQuality) * (0.08 + (5 - reviewQuality) * 0.02)), 5); // Using 5 as max quality for formula
            expect(updatedFlashcard.lastReviewedAt).toBeInstanceOf(Timestamp);
            expect(updatedFlashcard.nextReviewAt).toBeInstanceOf(Timestamp);
            
            const expectedNextReviewDate = new Date(updatedFlashcard.lastReviewedAt!.toDate());
            expectedNextReviewDate.setDate(expectedNextReviewDate.getDate() + 1);
            expect(updatedFlashcard.nextReviewAt!.toDate().toDateString()).toEqual(expectedNextReviewDate.toDateString());

            expect(interaction).toBeDefined();
            expect(interaction.flashcardId).toBe(flashcard.id);
            expect(interaction.reviewQuality).toBe(reviewQuality);
        });

        it("should reset interval for a bad review (quality BAD)", async () => {
            let flashcard = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "Q2", backText: "A2", frontContent: "Q2", backContent: "A2", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = flashcard.id;

            await firebaseFlashcardService.recordFlashcardReview(testUserId, flashcard.id, ReviewQuality.EASY);
            
            const { updatedFlashcard: flashcardAfterBadReview } = await firebaseFlashcardService.recordFlashcardReview(testUserId, flashcard.id, ReviewQuality.BAD);

            expect(flashcardAfterBadReview.repetitions).toBe(2); // Corrected from reviewsCount
            expect(flashcardAfterBadReview.lapses).toBe(1);      // Corrected from lapsesCount
            expect(flashcardAfterBadReview.intervalDays).toBe(0); 
            expect(flashcardAfterBadReview.easeFactor).toBeLessThan(2.5); 
        });
    });

    describe("getFlashcardsByUser - readyForReview filter", () => {
        it("should return flashcards that are due for review", async () => {
            const dueFlashcard = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "Due", backText: "Now", frontContent: "Due", backContent: "Now", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = dueFlashcard.id; 

            const notDueFlashcardPayload: FirebaseFlashcardCreatePayload = { userId: testUserId, deckId: testDeckId, frontText: "Not Due", backText: "Later", frontContent: "Not Due", backContent: "Later", status: FirebaseFlashcardStatus.LEARNING }; 
            const notDueFlashcardInitial = await firebaseFlashcardService.createFlashcard(notDueFlashcardPayload);
            await firebaseFlashcardService.recordFlashcardReview(testUserId, notDueFlashcardInitial.id, ReviewQuality.EASY); // Use enum

            const { flashcards } = await firebaseFlashcardService.getFlashcardsByUser(testUserId, 1, 10, { readyForReview: true });
            
            expect(flashcards.some(fc => fc.id === dueFlashcard.id)).toBe(true);
            expect(flashcards.some(fc => fc.id === notDueFlashcardInitial.id)).toBe(false);
        });
    });

    describe("toggleArchiveFlashcard", () => {
        it("should archive an active flashcard and set nextReviewAt to null", async () => {
            const flashcard = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "To Archive", backText: "Archived", frontContent: "To Archive", backContent: "Archived", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = flashcard.id;

            const archivedFlashcard = await firebaseFlashcardService.toggleArchiveFlashcard(flashcard.id, testUserId);
            expect(archivedFlashcard.status).toBe(FirebaseFlashcardStatus.SUSPENDED); // Archived is SUSPENDED for flashcards
            expect(archivedFlashcard.nextReviewAt).toBeNull();
        });

        it("should unarchive an archived flashcard and set nextReviewAt if it was null", async () => {
            let flashcard = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "To Unarchive", backText: "Unarchived", frontContent: "To Unarchive", backContent: "Unarchived", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = flashcard.id;
            flashcard = await firebaseFlashcardService.toggleArchiveFlashcard(flashcard.id, testUserId); 
            expect(flashcard.status).toBe(FirebaseFlashcardStatus.SUSPENDED);

            const unarchivedFlashcard = await firebaseFlashcardService.toggleArchiveFlashcard(flashcard.id, testUserId); 
            expect(unarchivedFlashcard.status).toBe(FirebaseFlashcardStatus.LEARNING);
            expect(unarchivedFlashcard.nextReviewAt).toBeInstanceOf(Timestamp);
        });
    });

    describe("getFlashcardStatistics", () => {
        it("should correctly calculate flashcard statistics for a user and deck", async () => {
            const fc1 = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "FC1", backText: "B1", frontContent: "FC1", backContent: "B1", status: FirebaseFlashcardStatus.LEARNING }); 
            createdFlashcardId = fc1.id; 

            const fc2 = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "FC2", backText: "B2", frontContent: "FC2", backContent: "B2", status: FirebaseFlashcardStatus.LEARNING }); 
            await firebaseFlashcardService.recordFlashcardReview(testUserId, fc2.id, ReviewQuality.EASY); // Use enum

            const fc3 = await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: testDeckId, frontText: "FC3", backText: "B3", frontContent: "FC3", backContent: "B3", status: FirebaseFlashcardStatus.LEARNING }); 
            await firebaseFlashcardService.toggleArchiveFlashcard(fc3.id, testUserId);

            const otherDeckId = `otherDeck_${testUserId}`;
            await ensureTestDeck(otherDeckId, testUserId, "Other Test Deck");
            await firebaseFlashcardService.createFlashcard({ userId: testUserId, deckId: otherDeckId, frontText: "FC4", backText: "B4", frontContent: "FC4", backContent: "B4", status: FirebaseFlashcardStatus.LEARNING }); 

            const stats = await firebaseFlashcardService.getUserFlashcardStatistics(testUserId, testDeckId);

            expect(stats.totalFlashcards).toBe(3); 
            expect(stats.activeFlashcards).toBe(2); // fc1 (learning), fc2 (reviewing)
            expect(stats.archivedFlashcards).toBe(1); // fc3 (suspended)
            expect(stats.dueForReviewCount).toBe(1); // fc1 is due immediately
            
            await clearCollection(FLASHCARDS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("deckId", "==", otherDeckId));
        });
    });
});


