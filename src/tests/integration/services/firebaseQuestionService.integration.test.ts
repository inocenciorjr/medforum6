import { FirebaseQuestion, FirebaseQuestionStatus, FirebaseQuestionDifficulty, FirebaseQuestionAlternative } from "../../../types/firebaseTypes";
import {
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  listQuestions,
} from "../../../services/firebaseQuestionService";
import { firestore } from "../../../config/firebaseAdmin";
import { Timestamp } from 'firebase-admin/firestore'; // Corrected import
import { v4 as uuidv4 } from 'uuid';

// Helper function to clean up test data
const cleanup = async (ids: string[]) => {
  for (const id of ids) {
    try {
      await firestore.collection("questions").doc(id).delete();
    } catch (error) {
      // console.error(`Error cleaning up question ${id}:`, error);
    }
  }
};

describe("FirebaseQuestionService Integration Tests", () => {
  const testQuestionIds: string[] = [];

  afterAll(async () => {
    await cleanup(testQuestionIds);
  });

  // Adjusted to return FirebaseQuestionAlternative including id
  const createSampleAlternativeWithId = (text: string, isCorrect: boolean, order: number, explanation?: string): FirebaseQuestionAlternative => ({
    id: uuidv4(), // Generate ID here
    text,
    isCorrect,
    order,
    explanation: explanation || (isCorrect ? "This is the correct alternative." : "This is an incorrect alternative."),
  });

  // Used for initial creation where service generates alternative IDs
   const createSampleAlternativeForCreation = (text: string, isCorrect: boolean, order: number, explanation?: string): Omit<FirebaseQuestionAlternative, 'id'> => ({
    text,
    isCorrect,
    order,
    explanation: explanation || (isCorrect ? "This is the correct alternative." : "This is an incorrect alternative."),
  });


  const sampleQuestionData: Omit<FirebaseQuestion, "id" | "createdAt" | "updatedAt" | "reviewCount" | "averageRating" | "alternatives"> & { alternatives: Omit<FirebaseQuestionAlternative, 'id'>[] } = {
    statement: "Qual é a capital da França?",
    alternatives: [
      createSampleAlternativeForCreation("Londres", false, 1),
      createSampleAlternativeForCreation("Paris", true, 0),
      createSampleAlternativeForCreation("Berlin", false, 2),
    ],
    explanation: "Paris é a capital da França.",
    difficulty: FirebaseQuestionDifficulty.EASY,
    filterIds: ["geografia", "europa"],
    subFilterIds: ["capitais"],
    tags: ["frança", "capital"],
    source: "Livro de Geografia Geral",
    year: 2023,
    status: FirebaseQuestionStatus.PUBLISHED,
    isAnnulled: false,
    isActive: true,
    createdBy: "test-user-id",
    updatedBy: "test-user-id",
    commentsAllowed: true,
    imageUrls: ["http://example.com/paris.jpg"],
  };

  test("should create a new question with alternatives having generated IDs", async () => {
    const newQuestion = await createQuestion(sampleQuestionData);
    expect(newQuestion).toBeDefined();
    expect(newQuestion.id).toBeDefined();
    testQuestionIds.push(newQuestion.id);

    expect(newQuestion.statement).toBe(sampleQuestionData.statement);
    expect(newQuestion.difficulty).toBe(sampleQuestionData.difficulty);
    expect(newQuestion.status).toBe(FirebaseQuestionStatus.PUBLISHED);
    expect(newQuestion.isAnnulled).toBe(false);
    expect(newQuestion.isActive).toBe(true);
    expect(newQuestion.reviewCount).toBe(0);
    expect(newQuestion.averageRating).toBe(0);
    expect(newQuestion.alternatives).toHaveLength(sampleQuestionData.alternatives.length);

    newQuestion.alternatives.forEach(alt => {
      expect(alt.id).toBeDefined();
      expect(typeof alt.id).toBe('string');
      const originalAlt = sampleQuestionData.alternatives.find(oa => oa.text === alt.text);
      expect(originalAlt).toBeDefined();
      if(originalAlt){
        expect(alt.isCorrect).toBe(originalAlt.isCorrect);
        expect(alt.order).toBe(originalAlt.order);
      }
    });
    expect(newQuestion.createdAt).toBeInstanceOf(Timestamp); // Corrected usage
    expect(newQuestion.updatedAt).toBeInstanceOf(Timestamp); // Corrected usage
  });

  test("should get a question by ID", async () => {
    const createdQuestion = await createQuestion(sampleQuestionData);
    testQuestionIds.push(createdQuestion.id);

    const fetchedQuestion = await getQuestionById(createdQuestion.id);
    expect(fetchedQuestion).toBeDefined();
    expect(fetchedQuestion!.id).toBe(createdQuestion.id);
    expect(fetchedQuestion!.statement).toBe(sampleQuestionData.statement);
    expect(fetchedQuestion!.alternatives).toHaveLength(sampleQuestionData.alternatives.length);
    fetchedQuestion!.alternatives.forEach(alt => expect(alt.id).toBeDefined());
  });

  test("getQuestionById should return null for non-existent ID", async () => {
    const fetchedQuestion = await getQuestionById("non-existent-id");
    expect(fetchedQuestion).toBeNull();
  });

  test("should update an existing question", async () => {
    const createdQuestion = await createQuestion(sampleQuestionData);
    testQuestionIds.push(createdQuestion.id);

    const updatePayload: Partial<Omit<FirebaseQuestion, "id" | "createdAt" | "updatedAt">> & { alternatives?: FirebaseQuestionAlternative[] } = {
      statement: "Qual é a capital da Alemanha?",
      difficulty: FirebaseQuestionDifficulty.MEDIUM,
      status: FirebaseQuestionStatus.DRAFT,
      tags: ["alemanha", "capital"],
      alternatives: [ // Alternatives now include IDs as per FirebaseQuestionAlternative
        createSampleAlternativeWithId("Munique", false, 1, "Explicação Munique"),
        createSampleAlternativeWithId("Berlim", true, 0, "Explicação Berlim Correta"),
      ]
    };

    const updatedQuestion = await updateQuestion(createdQuestion.id, updatePayload);
    expect(updatedQuestion).toBeDefined();
    expect(updatedQuestion!.id).toBe(createdQuestion.id);
    expect(updatedQuestion!.statement).toBe(updatePayload.statement);
    expect(updatedQuestion!.difficulty).toBe(updatePayload.difficulty);
    expect(updatedQuestion!.status).toBe(updatePayload.status);
    expect(updatedQuestion!.tags).toEqual(updatePayload.tags);
    expect(updatedQuestion!.alternatives).toHaveLength(2);
    updatedQuestion!.alternatives.forEach(alt => {
        expect(alt.id).toBeDefined();
        if (alt.text === "Berlim") expect(alt.isCorrect).toBe(true);
    });
    expect(updatedQuestion!.updatedAt.toMillis()).toBeGreaterThan(createdQuestion.updatedAt.toMillis());
  });

  test("updateQuestion should return null for non-existent ID", async () => {
    const updatedQuestion = await updateQuestion("non-existent-id", { statement: "Test" });
    expect(updatedQuestion).toBeNull();
  });

  test("should soft delete a question (set status to ARCHIVED and isActive to false)", async () => {
    const createdQuestion = await createQuestion(sampleQuestionData);
    testQuestionIds.push(createdQuestion.id);

    const deletedQuestion = await deleteQuestion(createdQuestion.id);
    expect(deletedQuestion).toBeDefined();
    expect(deletedQuestion!.id).toBe(createdQuestion.id);
    expect(deletedQuestion!.status).toBe(FirebaseQuestionStatus.ARCHIVED);
    expect(deletedQuestion!.isActive).toBe(false);

    const fetchedAfterDelete = await getQuestionById(createdQuestion.id);
    expect(fetchedAfterDelete).toBeDefined();
    expect(fetchedAfterDelete!.status).toBe(FirebaseQuestionStatus.ARCHIVED);
    expect(fetchedAfterDelete!.isActive).toBe(false);
  });

  test("deleteQuestion should return null for non-existent ID", async () => {
    const result = await deleteQuestion("non-existent-id-for-delete");
    expect(result).toBeNull();
  });

  describe("listQuestions", () => {
    const q1Data = { ...sampleQuestionData, statement: "Q1 Easy Published", difficulty: FirebaseQuestionDifficulty.EASY, status: FirebaseQuestionStatus.PUBLISHED, tags: ["tagA", "tagCommon"], filterIds: ["filterX"], year: 2020, source: "Source A" };
    const q2Data = { ...sampleQuestionData, statement: "Q2 Medium Draft", difficulty: FirebaseQuestionDifficulty.MEDIUM, status: FirebaseQuestionStatus.DRAFT, tags: ["tagB", "tagCommon"], filterIds: ["filterY"], year: 2021, source: "Source B", isActive: false };
    const q3Data = { ...sampleQuestionData, statement: "Q3 Hard Published Annulled", difficulty: FirebaseQuestionDifficulty.HARD, status: FirebaseQuestionStatus.PUBLISHED, tags: ["tagC"], filterIds: ["filterX", "filterZ"], year: 2022, source: "Source A", isAnnulled: true };
    const q4Data = { ...sampleQuestionData, statement: "Q4 Easy Archived", difficulty: FirebaseQuestionDifficulty.EASY, status: FirebaseQuestionStatus.ARCHIVED, tags: ["tagD"], filterIds: ["filterZ"], year: 2020 };

    beforeAll(async () => {
      const q1 = await createQuestion(q1Data);
      const q2 = await createQuestion(q2Data);
      const q3 = await createQuestion(q3Data);
      const q4 = await createQuestion(q4Data);
      testQuestionIds.push(q1.id, q2.id, q3.id, q4.id);
    });

    test("should list questions with default limit", async () => {
      const { questions } = await listQuestions({ orderBy: "createdAt", orderDirection: "asc" });
      expect(questions.length).toBeGreaterThanOrEqual(0);
      if (questions.length > 0) {
          questions.forEach(q => expect(q.alternatives).toBeDefined());
      }
    });

    test("should filter by status", async () => {
      const { questions } = await listQuestions({ status: FirebaseQuestionStatus.PUBLISHED, orderBy: "statement" });
      expect(questions.every(q => q.status === FirebaseQuestionStatus.PUBLISHED)).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q1 Easy Published");
      expect(statements).toContain("Q3 Hard Published Annulled");
    });

    test("should filter by difficulty", async () => {
      const { questions } = await listQuestions({ difficulty: FirebaseQuestionDifficulty.EASY, orderBy: "statement" });
      expect(questions.every(q => q.difficulty === FirebaseQuestionDifficulty.EASY)).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q1 Easy Published");
    });

    test("should filter by isActive", async () => {
      const { questions } = await listQuestions({ isActive: true, status: FirebaseQuestionStatus.PUBLISHED, orderBy: "statement" });
      expect(questions.every(q => q.isActive === true && q.status === FirebaseQuestionStatus.PUBLISHED)).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q1 Easy Published");
      expect(statements).not.toContain("Q2 Medium Draft");
    });

    test("should filter by isAnnulled", async () => {
      const { questions } = await listQuestions({ isAnnulled: true, status: FirebaseQuestionStatus.PUBLISHED, orderBy: "statement" });
      expect(questions.every(q => q.isAnnulled === true && q.status === FirebaseQuestionStatus.PUBLISHED)).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q3 Hard Published Annulled");
    });

    test("should filter by source", async () => {
      const { questions } = await listQuestions({ source: "Source A", orderBy: "statement" });
      expect(questions.every(q => q.source === "Source A")).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q1 Easy Published");
      expect(statements).toContain("Q3 Hard Published Annulled");
    });
    
    test("should filter by year", async () => {
      const { questions } = await listQuestions({ year: 2020, orderBy: "statement" });
      expect(questions.every(q => q.year === 2020)).toBe(true);
      const statements = questions.map(q => q.statement);
      expect(statements).toContain("Q1 Easy Published");
    });

    test("should filter by a single tag (array-contains)", async () => {
      const { questions } = await listQuestions({ tags: ["tagCommon"], orderBy: "statement" });
      expect(questions.some(q => q.statement === "Q1 Easy Published")).toBe(true);
      expect(questions.some(q => q.statement === "Q2 Medium Draft")).toBe(true);
    });

    test("should filter by filterIds (array-contains-any)", async () => {
        const { questions } = await listQuestions({ filterIds: ["filterX", "filterY"], orderBy: "statement" });
        const statements = questions.map(q => q.statement);
        expect(statements).toContain("Q1 Easy Published");
        expect(statements).toContain("Q2 Medium Draft");
        expect(statements).toContain("Q3 Hard Published Annulled");
      });

    test("should paginate results", async () => {
      const baseData = { ...sampleQuestionData, difficulty: FirebaseQuestionDifficulty.MEDIUM, status: FirebaseQuestionStatus.PUBLISHED }; 
      for (let i = 0; i < 5; i++) {
        const q = await createQuestion({ ...baseData, statement: `Pagination Test Q${i}`});
        testQuestionIds.push(q.id);
      }

      const firstPage = await listQuestions({ limit: 2, orderBy: "statement", orderDirection: "asc" });
      expect(firstPage.questions).toHaveLength(2);
      expect(firstPage.nextPageStartAfter).toBeDefined();

      const secondPage = await listQuestions({ limit: 2, startAfter: firstPage.nextPageStartAfter, orderBy: "statement", orderDirection: "asc" });
      expect(secondPage.questions).toHaveLength(2);
      expect(secondPage.nextPageStartAfter).toBeDefined();
      
      const firstPageIds = firstPage.questions.map(q => q.id);
      const secondPageIds = secondPage.questions.map(q => q.id);
      firstPageIds.forEach(id => expect(secondPageIds).not.toContain(id));
    });
  });
});

