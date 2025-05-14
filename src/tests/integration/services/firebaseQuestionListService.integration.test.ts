import { initializeAppIfNeeded, firestore, clearCollection, admin } from "../../../config/firebaseAdmin"; // Added admin
import {
  firebaseQuestionListService,
} from "../../../services/firebaseQuestionListService";
import {
  FirebaseQuestionList,
  FirebaseQuestionListItem,
  FirebaseQuestionListStatus,
  ReviewQuality,
  FirebaseQuestionListUpdatePayload // Ensure this is correctly defined or imported if used
} from "../../../types/firebaseTypes";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Local type for creation payload, as FirebaseQuestionListCreatePayload is not exported from firebaseTypes.ts in the provided snippet
interface FirebaseQuestionListCreatePayloadLocal {
    userId: string;
    title: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
    status?: FirebaseQuestionListStatus;
}

const QUESTION_LISTS_COLLECTION = "questionLists";
const QUESTION_LIST_ITEMS_COLLECTION = "questionListItems";
const USERS_COLLECTION = "users";
const QUESTIONS_COLLECTION = "questions"; 
const QUESTION_RESPONSES_COLLECTION = "questionResponses";
const USER_FAVORITE_QUESTION_LISTS_COLLECTION = "userFavoriteQuestionLists";

describe("FirebaseQuestionListService Integration Tests", () => {
  let testUserId = `testUser_QLS_${Date.now()}`;
  let testQuestionId = `testQuestion_QLS_${Date.now()}`;
  let createdQuestionListId: string;

  const ensureTestUser = async (userId: string) => {
    const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({
        id: userId,
        uid: userId,
        name: "Test User for Question List Service",
        email: `${userId}@example.com`,
        role: "student",
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  };

  const ensureTestQuestion = async (questionId: string) => {
    const questionRef = firestore.collection(QUESTIONS_COLLECTION).doc(questionId);
    const questionDoc = await questionRef.get();
    if (!questionDoc.exists) {
      await questionRef.set({
        id: questionId,
        title: "Test Question",
        statement: "What is 2+2?",
        alternatives: [{id: "1", text: "4", isCorrect: true}],
        correctAlternativeId: "1",
        difficulty: "easy",
        status: "PUBLISHED", // Ensure this matches FirebaseContentStatus enum if used
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  };

  beforeAll(async () => {
    // Firebase Admin SDK já foi inicializado no jest.setup.js
    await ensureTestUser(testUserId);
    await ensureTestQuestion(testQuestionId);
  });

  afterEach(async () => {
    if (createdQuestionListId) {
      await clearCollection(QUESTION_LIST_ITEMS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("questionListId", "==", createdQuestionListId));
      await clearCollection(USER_FAVORITE_QUESTION_LISTS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("questionListId", "==", createdQuestionListId));
      await clearCollection(QUESTION_LISTS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("id", "==", createdQuestionListId));
    }
    await clearCollection(QUESTION_LISTS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("userId", "==", testUserId));
    await clearCollection(QUESTION_RESPONSES_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("userId", "==", testUserId));
    createdQuestionListId = "";
  });

  afterAll(async () => {
    await clearCollection(USERS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("id", "==", testUserId));
    await clearCollection(QUESTIONS_COLLECTION, (ref: admin.firestore.CollectionReference) => ref.where("id", "==", testQuestionId));
  });

  describe("createQuestionList", () => {
    it("should create a new question list with default values", async () => {
      const listData: FirebaseQuestionListCreatePayloadLocal = {
        userId: testUserId,
        title: "My Test List with Defaults",
      };
      const createdList = await firebaseQuestionListService.createQuestionList(listData);
      createdQuestionListId = createdList.id;

      expect(createdList).toBeDefined();
      expect(createdList.id).toBeTruthy();
      expect(createdList.title).toBe(listData.title);
      expect(createdList.userId).toBe(testUserId);
      expect(createdList.status).toBe(FirebaseQuestionListStatus.ACTIVE);
      expect(createdList.viewCount).toBe(0);
      expect(createdList.favoriteCount).toBe(0);
      expect(createdList.lastStudyDate).toBeNull();
      expect(createdList.completionPercentage).toBe(0);
      expect(createdList.questionCount).toBe(0);
      expect(createdList.lastAddedAt).toBeNull();

      const fetchedList = await firebaseQuestionListService.getQuestionListById(createdList.id);
      expect(fetchedList).toEqual(expect.objectContaining({
        ...listData,
        status: FirebaseQuestionListStatus.ACTIVE,
        viewCount: 0,
        favoriteCount: 0,
        lastStudyDate: null,
        completionPercentage: 0,
        questionCount: 0,
        lastAddedAt: null,
      }));
    });
  });

  describe("updateQuestionList", () => {
    it("should update the status of a question list", async () => {
      const listData: FirebaseQuestionListCreatePayloadLocal = { userId: testUserId, title: "List to Update Status" };
      const list = await firebaseQuestionListService.createQuestionList(listData);
      createdQuestionListId = list.id;

      const updates: FirebaseQuestionListUpdatePayload = { status: FirebaseQuestionListStatus.ARCHIVED };
      const updatedList = await firebaseQuestionListService.updateQuestionList(list.id, testUserId, updates);
      expect(updatedList).toBeDefined();
      expect(updatedList?.status).toBe(FirebaseQuestionListStatus.ARCHIVED);

      const fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.status).toBe(FirebaseQuestionListStatus.ARCHIVED);
    });
  });

  describe("addQuestionToList", () => {
    it("should initialize new fields in QuestionListItem and update lastAddedAt in QuestionList", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List for Items" });
      createdQuestionListId = list.id;

      const listItem = await firebaseQuestionListService.addQuestionToList({
        questionListId: list.id,
        questionId: testQuestionId,
        order: 0,
      });

      expect(listItem.isCompleted).toBe(false);
      expect(listItem.lastAttemptedAt).toBeNull();
      expect(listItem.correctAttempts).toBe(0);
      expect(listItem.incorrectAttempts).toBe(0);

      const updatedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(updatedList?.questionCount).toBe(1);
      expect(updatedList?.lastAddedAt).toBeInstanceOf(Timestamp);
    });
  });

  describe("deleteQuestionList", () => {
    it("should delete a question list and its associated items", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List to Delete" });
      createdQuestionListId = list.id;
      await firebaseQuestionListService.addQuestionToList({ questionListId: list.id, questionId: testQuestionId, order: 0 });

      const deleteResult = await firebaseQuestionListService.deleteQuestionList(list.id, testUserId);
      expect(deleteResult).toBe(true);

      const fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList).toBeNull();
      const items = await firebaseQuestionListService.listItemsByQuestionList(list.id);
      expect(items.length).toBe(0);
      createdQuestionListId = ""; 
    });
  });

  describe("incrementViewCount", () => {
    it("should increment the view count of a question list", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List to View" });
      createdQuestionListId = list.id;

      await firebaseQuestionListService.incrementViewCount(list.id);
      let fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.viewCount).toBe(1);

      await firebaseQuestionListService.incrementViewCount(list.id);
      fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.viewCount).toBe(2);
    });
  });

  describe("toggleFavorite", () => {
    it("should toggle the favorite status and update favoriteCount", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List to Favorite" });
      createdQuestionListId = list.id;

      // Favorite the list
      let toggleResult = await firebaseQuestionListService.toggleFavorite(list.id, testUserId);
      expect(toggleResult.favorited).toBe(true);
      expect(toggleResult.favoriteCount).toBe(1);
      let fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.favoriteCount).toBe(1);

      // Unfavorite the list
      toggleResult = await firebaseQuestionListService.toggleFavorite(list.id, testUserId);
      expect(toggleResult.favorited).toBe(false);
      expect(toggleResult.favoriteCount).toBe(0);
      fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.favoriteCount).toBe(0);

      // Favorite again to ensure count goes back up
      toggleResult = await firebaseQuestionListService.toggleFavorite(list.id, testUserId);
      expect(toggleResult.favorited).toBe(true);
      expect(toggleResult.favoriteCount).toBe(1);
      fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.favoriteCount).toBe(1);
    });
  });

  describe("recalculateCompletionPercentage", () => {
    it("should correctly calculate completion percentage", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List for Completion" });
      createdQuestionListId = list.id;

      const qId1 = `${testQuestionId}_1`;
      const qId2 = `${testQuestionId}_2`;
      await ensureTestQuestion(qId1);
      await ensureTestQuestion(qId2);

      const item1 = await firebaseQuestionListService.addQuestionToList({ questionListId: list.id, questionId: qId1, order: 0 });
      const item2 = await firebaseQuestionListService.addQuestionToList({ questionListId: list.id, questionId: qId2, order: 1 });

      await firebaseQuestionListService.recalculateCompletionPercentage(list.id);
      let fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.completionPercentage).toBe(0);

      await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc(item1.id).update({ isCompleted: true });
      await firebaseQuestionListService.recalculateCompletionPercentage(list.id);
      fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.completionPercentage).toBe(50);

      await firestore.collection(QUESTION_LIST_ITEMS_COLLECTION).doc(item2.id).update({ isCompleted: true });
      await firebaseQuestionListService.recalculateCompletionPercentage(list.id);
      fetchedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(fetchedList?.completionPercentage).toBe(100);
    });
  });

  describe("recordQuestionListStudyActivity", () => {
    it("should update lastStudyDate, completionPercentage, and item stats", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List for Study Activity" });
      createdQuestionListId = list.id;
      const item = await firebaseQuestionListService.addQuestionToList({ questionListId: list.id, questionId: testQuestionId, order: 0 });

      await firebaseQuestionListService.recordQuestionListStudyActivity(
        list.id,
        testUserId,
        testQuestionId,
        5 as ReviewQuality, 
        true 
      );

      const updatedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(updatedList?.lastStudyDate).toBeInstanceOf(Timestamp);
      expect(updatedList?.completionPercentage).toBe(100); 

      const updatedItem = await firebaseQuestionListService.getQuestionListItemById(item.id);
      expect(updatedItem?.lastAttemptedAt).toBeInstanceOf(Timestamp);
      expect(updatedItem?.isCompleted).toBe(true);
      expect(updatedItem?.correctAttempts).toBe(1);
      expect(updatedItem?.incorrectAttempts).toBe(0);
    });

     it("should handle incorrect answers and update item stats accordingly", async () => {
      const list = await firebaseQuestionListService.createQuestionList({ userId: testUserId, title: "List Study Incorrect" });
      createdQuestionListId = list.id;
      const item = await firebaseQuestionListService.addQuestionToList({ questionListId: list.id, questionId: testQuestionId, order: 0 });

      await firebaseQuestionListService.recordQuestionListStudyActivity(
        list.id,
        testUserId,
        testQuestionId,
        1 as ReviewQuality, 
        false 
      );

      const updatedList = await firebaseQuestionListService.getQuestionListById(list.id);
      expect(updatedList?.lastStudyDate).toBeInstanceOf(Timestamp);
      expect(updatedList?.completionPercentage).toBe(0); 

      const updatedItem = await firebaseQuestionListService.getQuestionListItemById(item.id);
      expect(updatedItem?.lastAttemptedAt).toBeInstanceOf(Timestamp);
      expect(updatedItem?.isCompleted).toBe(false);
      expect(updatedItem?.correctAttempts).toBe(0);
      expect(updatedItem?.incorrectAttempts).toBe(1);
    });
  });
});

