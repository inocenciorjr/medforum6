import { Timestamp, FieldValue, FieldPath } from "firebase-admin/firestore";
// Re-export payment types AND enums from firebasePaymentTypes
import {
  FirebasePayment as ImportedFirebasePayment,
  FirebasePaymentMethod as ImportedFirebasePaymentMethodEnum, // Enum for values
  FirebasePaymentStatus as ImportedFirebasePaymentStatusEnum, // Enum for values
  FirebaseCreditCardPayment as ImportedFirebaseCreditCardPayment,
  FirebaseCreditCardPaymentStatus as ImportedFirebaseCreditCardPaymentStatusEnum,
  FirebasePixPayment as ImportedFirebasePixPayment,
  FirebasePixStatus as ImportedFirebasePixStatusEnum,
  FirebasePixKeyType as ImportedFirebasePixKeyTypeEnum,
  FirebaseCoupon as ImportedFirebaseCoupon,
  FirebasePaymentNotification as ImportedFirebasePaymentNotification
} from "./firebasePaymentTypes";

// Exportando tipos de pagamento
export type FirebasePayment = ImportedFirebasePayment;
export type FirebasePaymentMethod = ImportedFirebasePaymentMethodEnum;
export type FirebasePaymentStatus = ImportedFirebasePaymentStatusEnum;
export type FirebaseCreditCardPayment = ImportedFirebaseCreditCardPayment;
export type FirebaseCreditCardPaymentStatus = ImportedFirebaseCreditCardPaymentStatusEnum;
export type FirebasePixPayment = ImportedFirebasePixPayment;
export type FirebasePixStatus = ImportedFirebasePixStatusEnum;
export type FirebasePixKeyType = ImportedFirebasePixKeyTypeEnum;
export type FirebaseCoupon = ImportedFirebaseCoupon;
export type FirebasePaymentNotification = ImportedFirebasePaymentNotification;

// Exportando ENUMS de pagamento para uso como VALORES
export const FirebasePaymentMethod = ImportedFirebasePaymentMethodEnum;
export const FirebasePaymentStatus = ImportedFirebasePaymentStatusEnum;
export const FirebaseCreditCardPaymentStatus = ImportedFirebaseCreditCardPaymentStatusEnum;
export const FirebasePixStatus = ImportedFirebasePixStatusEnum;
export const FirebasePixKeyType = ImportedFirebasePixKeyTypeEnum;


// Tipo para faturas
export interface FirebaseInvoice {
  id: string;
  paymentId: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  status: "paid" | "cancelled" | "refunded";
  pdfUrl: string;
  items: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  discounts: Array<{
    description: string;
    amount: number;
  }>;
  paymentMethod: string; // Should this be FirebasePaymentMethod?
  paidAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Adicionando FirebasePlan
export interface FirebasePlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string; // e.g., "BRL", "USD"
  interval: FirebasePlanInterval; // MONTHLY, YEARLY
  intervalCount: number; // e.g., 1 for 1 month/year, 3 for 3 months/years
  features?: string[];
  isActive: boolean;
  durationInDays?: number; // Duração do plano em dias (ex: 30 para mensal, 365 para anual)
  trialPeriodDays?: number;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Adicionando FirebaseDeck
export interface FirebaseDeck {
  id: string;
  userId: string;
  name: string;
  description?: string;
  flashcardCount?: number;
  isPublic: boolean;
  status: FirebaseDeckStatus; // ACTIVE, INACTIVE, ARCHIVED, PRIVATE, PUBLIC
  tags?: string[];
  lastReviewedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Enum para status de flashcards
// Comentado para evitar duplicação com o enum abaixo
/*
export enum FirebaseFlashcardStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
  DELETED = "deleted",
  LEARNING = "learning",
  REVIEWING = "reviewing",
  MASTERED = "mastered",
  SUSPENDED = "suspended",
}
*/

// Adicionando FirebaseFlashcard e FirebaseFlashcardCreatePayload
export interface FirebaseFlashcard {
  id: string;
  frontContent: string;
  backContent: string;
  deckId: string;
  userId: string;
  questionId?: string;
  status: FirebaseFlashcardStatus;
  personalNotes?: string;
  searchableText: string;
  isSuspended: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseFlashcardCreatePayload {
  frontContent: string;
  backContent: string;
  deckId: string;
  questionId?: string;
  personalNotes?: string;
  status?: FirebaseFlashcardStatus;
}

export type FirebaseFlashcardUpdatePayload = Partial<Omit<FirebaseFlashcard, "id" | "userId" | "createdAt" | "updatedAt">>;

// Adicionando FirebaseUserFlashcardInteraction
export interface FirebaseUserFlashcardInteraction {
  userId: string;
  flashcardId: string;
  deckId: string;
  lastReviewedAt: Timestamp;
  nextReviewAt: Timestamp;
  repetitions: number;
  easeFactor: number;
  interval: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseFlashcardUserStatistics {
  userId: string;
  totalFlashcards: number;
  activeFlashcards: number;
  newFlashcards: number;
  learningFlashcards: number;
  reviewingFlashcards: number;
  masteredFlashcards: number;
  suspendedFlashcards: number;
  archivedFlashcards: number;
  deletedFlashcards: number;
  averageEaseFactor: number;
  averageIntervalDays: number;
  reviewedFlashcardsCount: number;
  dueForReviewCount: number;
  nextReviewAt: Timestamp | null;
  lastReviewedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


export enum FirebaseFlashcardStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
  LEARNING = "LEARNING",
  REVIEWING = "REVIEWING",
  MASTERED = "MASTERED",
  SUSPENDED = "SUSPENDED",
}

export enum FirebaseDeckStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
  PRIVATE = "PRIVATE", // Specific to Decks if needed
  PUBLIC = "PUBLIC"   // Specific to Decks if needed
}

// --- Enums ---

export enum FirebaseFilterCategory {
  EDUCATIONAL = "educational",
  INSTITUTIONAL = "institutional",
}

export enum FirebaseFilterType {
  CONTENT = "CONTENT",
  SUBJECT = "SUBJECT",
  DIFFICULTY = "DIFFICULTY",
  INSTITUTION = "INSTITUTION",
  YEAR = "YEAR",
  REGION = "REGION",
  ORGANIZATIONAL = "ORGANIZATIONAL",
}

export enum FirebaseContentStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  PENDING_REVIEW = "PENDING_REVIEW",
  REJECTED = "REJECTED",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum FirebaseFilterStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum FirebaseCommentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SPAM = "SPAM",
}

export enum FirebaseCommentContentType {
  POST = "post",
  ARTICLE = "article",
  QUESTION = "question",
  EXAM = "exam"
}

// Esta interface foi substituída por FirebaseComment
// Mantendo comentada para referência
/*
export interface FirebaseCommentBase {
  id: string;
  postId: string;
  contentId?: string;
  contentType: FirebaseCommentContentType;
  userId: string;
  content: string;
  parentId?: string | null;
  authorName?: string;
  authorProfileImage?: string | null;
  status: FirebaseCommentStatus;
  likeCount: number;
  dislikeCount?: number;
  replyCount: number;
  isDeleted: boolean;
  isEdited?: boolean;
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
*/

export enum UserRole {
  STUDENT = "student",
  MENTOR = "mentor",
  ADMIN = "admin",
}

export const FirebaseArticleStatus = FirebaseContentStatus;
export type FirebaseArticleStatus = FirebaseContentStatus;

export enum FirebaseQuestionStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum FirebaseProgrammedReviewContentType {
  QUESTION = "QUESTION",
  ERROR_NOTEBOOK_ENTRY = "ERROR_NOTEBOOK_ENTRY",
}

export enum FirebaseMentorshipStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum FirebaseMeetingFrequency {
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
  MONTHLY = "monthly",
  CUSTOM = "custom",
}

export enum FirebaseMeetingStatus {
  SCHEDULED = "scheduled",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  RESCHEDULED = "rescheduled",
}

export enum FirebaseMeetingType {
  VIDEO = "video",
  AUDIO = "audio",
  CHAT = "chat",
  IN_PERSON = "in-person",
}

export enum FirebaseObjectiveStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum FirebaseResourceType {
  LINK = "link",
  FILE = "file",
  VIDEO = "video",
  ARTICLE = "article",
  OTHER = "other",
}

export enum FirebaseProgrammedReviewStatus {
  LEARNING = "LEARNING",
  REVIEWING = "REVIEWING",
  MASTERED = "MASTERED",
  SUSPENDED = "SUSPENDED",
}

export enum FirebaseAchievementCriteriaType {
  ANSWER_COUNT = "ANSWER_COUNT",
  STUDY_TIME = "STUDY_TIME",
  EXAM_COUNT = "EXAM_COUNT",
  STREAK = "STREAK",
  ACCURACY = "ACCURACY",
  CUSTOM = "CUSTOM",
}

export enum FirebaseReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

export enum FirebaseTagScope {
  GLOBAL = "GLOBAL",
  USER = "USER",
  ALL = "ALL",
  ARTICLES = "ARTICLES"
}

export enum FirebaseBugReportStatus {
  NEW = "new",
  OPEN = "open",
  IN_PROGRESS = "in-progress",
  ACKNOWLEDGED = "acknowledged",
  RESOLVED = "resolved",
  CLOSED = "closed"
}

export enum FirebaseBugReportPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export enum FirebasePlanInterval {
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum FirebaseQuestionDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export enum FirebaseSubFilterStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED"
}

export enum FirebaseCategoryStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE"
}

export enum FirebasePaymentMethodType {
  CREDIT_CARD = "credit_card",
  PIX = "pix",
  BANK_SLIP = "bank_slip",
  OTHER = "other",
  FREE = "free",
}

export enum FirebaseUserPlanStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  PENDING_PAYMENT = "pending_payment",
  PENDING_RENEWAL = "pending_renewal",
  SUSPENDED = "suspended",
}

export enum FirebaseQuestionListStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export enum FirebaseSimulatedExamStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  SCHEDULED = "SCHEDULED"
}

export enum FirebaseSimulatedExamResultStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum FirebaseQuestionListItemStatus {
  NOT_STARTED = "NOT_STARTED",
  NOT_ANSWERED = "NOT_ANSWERED",
  ANSWERED_CORRECTLY = "ANSWERED_CORRECTLY",
  ANSWERED_INCORRECTLY = "ANSWERED_INCORRECTLY",
  SKIPPED = "SKIPPED"
}


// Enum for ReviewQuality (used in flashcard interactions)
export enum ReviewQuality {
  BAD = 0,      // (0) Completely forgot
  DIFFICULT = 1, // (1) Remembered with difficulty
  GOOD = 2,     // (2) Remembered correctly after some hesitation
  EASY = 3      // (3) Perfect recall
}

// --- Interfaces ---

export interface FirebaseFilter {
  id: string;
  name: string;
  description?: string;
  category: FirebaseFilterCategory;
  filterType?: FirebaseFilterType;
  displayOrder?: number;
  icon?: string;
  color?: string;
  status?: FirebaseFilterStatus;
  createdBy?: string;
  isActive: boolean;
  isGlobal?: boolean;
  subFilterCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseSubFilter {
  id: string;
  filterId: string;
  parentId?: string | null;
  name: string;
  description?: string;
  order?: number;
  isActive: boolean;
  status?: FirebaseSubFilterStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseQuestionAlternative {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  order: number;
}

export interface FirebaseQuestion {
  id: string;
  title?: string;
  statement: string;
  alternatives: FirebaseQuestionAlternative[];
  correctAlternativeId?: string;
  explanation?: string | null;
  difficulty: FirebaseQuestionDifficulty;
  filterIds: string[];
  subFilterIds: string[];
  tags: string[];
  source?: string | null;
  year?: number | null;
  status: FirebaseQuestionStatus;
  isAnnulled: boolean;
  isActive: boolean;
  reviewCount: number;
  averageRating: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentsAllowed?: boolean;
  lastReviewedAt?: Timestamp | null;
  reviewStatus?: FirebaseReviewStatus;
  reviewerId?: string | null;
  reviewNotes?: string | null;
  version?: number;
  relatedQuestionIds?: string[];
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  metadata?: Record<string, any>;
  type?: string;
  categoryId?: string;
  topicId?: string;
  institutionId?: string;
  examId?: string;
}

export interface FirebaseUserQuestionResponse {
  id: string;
  userId: string;
  questionId: string;
  questionListId?: string | null;
  selectedAlternativeId?: string | null;
  essayResponse?: string | null;
  isCorrect: boolean;
  responseTimeSeconds?: number;
  addedToErrorNotebook?: boolean;
  reviewCount?: number;
  lastReviewDate?: Timestamp | null;
  nextReviewDate?: Timestamp | null;
  programmedReviewId?: string | null;
  srsLevel?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseUserQuestionHistory {
  id?: string;
  userId: string;
  questionId: string;
  selectedAlternativeId: string;
  isCorrect: boolean;
  responseTimeMs?: number;
  subFilterIds?: string[] | null;
  difficulty?: string | null;
  answeredAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface FirebaseMentorship {
  id: string;
  mentorId: string;
  menteeId: string;
  title: string;
  description?: string;
  status: FirebaseMentorshipStatus;
  startDate: Timestamp;
  endDate?: Timestamp | null;
  meetingFrequency?: FirebaseMeetingFrequency;
  nextMeetingDate?: Timestamp | null;
  lastMeetingDate?: Timestamp | null;
  meetingCount?: number; // Number of meetings held or scheduled
  customFrequencyDays?: number;
  totalMeetings?: number; // Total number of meetings planned for the mentorship
  completedMeetings?: number; // Number of meetings completed
  objectives?: string[];
  notes?: string;
  tags?: string[];
  rating?: number;
  feedback?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseComment {
  id: string;
  postId: string;
  contentId?: string;
  articleId?: string;
  contentType: FirebaseCommentContentType;
  userId: string;
  authorId?: string;
  authorName?: string;
  authorProfileImage?: string | null;
  content: string;
  text?: string;
  parentId?: string | null;
  replyTo?: string | null;
  replyCount: number;
  likeCount: number;
  dislikeCount?: number;
  isEdited?: boolean;
  isDeleted: boolean;
  status: FirebaseCommentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}

export interface FirebaseUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  profileImage?: string | null;
  isActive?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface FirebaseUserProfile {
  userId?: string;
  uid?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string | null;
  role?: UserRole | null;
  isActive?: boolean | null;
  profileImage?: string | null;
  bio?: string | null;
  phone?: string | null;
  lastLoginAt?: Timestamp | null;
  preferences?: Record<string, any> | null;
  specialization?: string | null;
  interests?: string[] | null;
  graduationYear?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  birthDate?: Timestamp | null;
  gender?: string | null;
  profession?: string | null;
  institution?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FirebaseMentorProfile {
  id?: string;
  userId: string;
  specialties?: string[];
  availability?: string | Record<string, string[]>;
  rating?: number;
  totalSessions?: number;
  bio?: string;
  createdAt?: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  authorId: string;
  authorName?: string;
  categoryId?: string;
  categoryName?: string;
  status: FirebaseArticleStatus;
  filterIds?: string[];
  tags?: string[];
  featuredImage?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  searchableText?: string;
}

export interface FirebaseProgrammedReview {
  id: string;
  userId: string;
  contentId: string;
  contentType: FirebaseProgrammedReviewContentType;
  deckId?: string | null;
  originalAnswerCorrect?: boolean | null;
  lastReviewedAt: Timestamp | null;
  nextReviewAt: Timestamp;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  status: FirebaseProgrammedReviewStatus;
  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseErrorNotebook {
  id: string;
  userId: string;
  title?: string;
  description?: string | null;
  isPublic?: boolean;
  lastEntryAt?: Timestamp | null;
  entryCount?: number;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseErrorNotebookEntry {
  id: string;
  notebookId: string;
  questionId: string;
  userNotes?: string;
  addedAt?: Timestamp;
  srsInterval?: number;
  srsEaseFactor?: number;
  srsRepetitions?: number;
  srsLapses?: number;
  srsStatus?: FirebaseProgrammedReviewStatus;
  lastReviewedAt?: Timestamp | null;
  nextReviewAt?: Timestamp | null;
  programmedReviewId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseUserStatistics {
  id: string;
  userId: string;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  incorrectAnswers: number;
  simulatedExamsTaken: number;
  totalStudyTimeMinutes?: number;
  questionsPerDay?: { [date: string]: number };
  studyTimePerDay?: { [date: string]: number };
  accuracyPerDay?: { [date: string]: { correct: number; total: number } };
  accuracyPerFilter: { [filterId: string]: { correct: number; total: number } };
  accuracyPerDifficulty?: { [difficulty: string]: { correct: number; total: number } };
  streakDays?: number;
  lastStudyDate: Timestamp | null;
  strongestFilters?: string[];
  weakestFilters?: string[];
  improvementAreas?: string[];
  lastActivityAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type FirebaseUserStatisticsUpdatePayload = Partial<Omit<FirebaseUserStatistics, "id" | "userId" | "createdAt" | "updatedAt" | "totalQuestionsAnswered" | "correctAnswers" | "incorrectAnswers" | "simulatedExamsTaken" | "totalStudyTimeMinutes">> & {
  totalQuestionsAnswered?: number | FieldValue;
  correctAnswers?: number | FieldValue;
  incorrectAnswers?: number | FieldValue;
  simulatedExamsTaken?: number | FieldValue;
  totalStudyTimeMinutes?: number | FieldValue;
};

export interface FirebaseAchievementCriteria {
  type: FirebaseAchievementCriteriaType;
  threshold: number;
  minQuestionsAnswered?: number;
  minAccuracyInFilter?: { filterId: string; accuracy: number };
  minQuestionsInFilter?: number;
  minStreakDays?: number;
  minAccuracy?: number;
  minCompletedLists?: number;
  minMentorshipsCompleted?: number;
  customLogic?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseUserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  achievedAt: Timestamp;
  progress?: number;
  isClaimed?: boolean;
  claimedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseAchievement {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  criteria: FirebaseAchievementCriteria[];
  points?: number;
  badgeUrl?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: FirebaseNotificationType;
  priority?: FirebaseNotificationPriority;
  isRead: boolean;
  readAt?: Timestamp | null;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export enum FirebaseNotificationType {
  GENERAL = "GENERAL",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILURE = "PAYMENT_FAILURE",
  SUBSCRIPTION_REMINDER = "SUBSCRIPTION_REMINDER",
  NEW_CONTENT = "NEW_CONTENT",
  MENTORSHIP_UPDATE = "MENTORSHIP_UPDATE",
  ACHIEVEMENT_UNLOCKED = "ACHIEVEMENT_UNLOCKED",
  COMMUNITY_MENTION = "COMMUNITY_MENTION",
  SYSTEM_ALERT = "SYSTEM_ALERT"
}

export enum FirebaseNotificationPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH"
}

export interface FirebaseUserPlan {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  status: FirebaseUserPlanStatus;
  startDate: Timestamp;
  startedAt?: Timestamp; // Compatibilidade com código existente
  endsAt: Timestamp | null; // Renomeado de endDate e garantido que existe
  expiresAt?: Timestamp | null; // Compatibilidade com código existente
  autoRenew?: boolean; // Adicionado para alinhar com os serviços
  nextBillingDate?: Timestamp | null;
  cancellationDate?: Timestamp | null;
  cancelledAt?: Timestamp | null; // Adicionado para alinhar com os serviços
  cancellationReason?: string | null; // Adicionado para alinhar com os serviços
  paymentMethodId?: string | null;
  paymentMethod?: string | null; // Compatibilidade com código existente
  stripeSubscriptionId?: string | null;
  paymentGatewaySubscriptionId?: string | null; // Compatibilidade com código existente
  paymentId?: string | null; // Adicionado para alinhar com os serviços
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export enum FirebaseSimulatedExamDifficultyLevel {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
  MIXED = "MIXED"
}

export interface FirebaseSimulatedExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  order: number;
  points: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseSimulatedExamAnswer {
  id: string;
  examResultId: string;
  questionId: string;
  selectedAlternativeId?: string | null;
  isCorrect: boolean;
  essayResponse?: string | null;
  timeSpentSeconds?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseSimulatedExam {
  id: string;
  userId: string; // Adicionado para alinhar com os testes e lógica de criação
  title: string;
  description: string | null;
  questionIds: string[];
  durationMinutes: number;
  status: FirebaseSimulatedExamStatus;
  difficultyLevel: FirebaseSimulatedExamDifficultyLevel;
  filterIds: string[] | null;
  subFilterIds: string[] | null;
  createdBy: string; // User ID or "system"
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalQuestions?: number;
  passingScore?: number;
  instructions?: string;
  maxAttempts?: number;
  availableFrom?: Timestamp;
  availableUntil?: Timestamp;
  timeLimitMinutes: number;
  isPublic: boolean;
  scheduledAt: Timestamp | null;
  settings: Record<string, any> | null;
  tags: string[] | null;
  questionCount: number;
  totalAttempts?: number;
  averageScore: number | null;
  completedAttempts?: number;
  lastPublishedAt: Timestamp | null;
  creatorName: string | null;
  participantCount: number;
}

export interface FirebaseSimulatedExamResult {
  id: string;
  simulatedExamId: string;
  userId: string;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  status: FirebaseSimulatedExamResultStatus;
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  timeSpentSeconds: number;
  totalQuestions: number;
  answers: Array<{
    questionId: string;
    selectedAlternativeId: string | null;
    isCorrect: boolean;
    essayResponse?: string | null;
    timeSpentSeconds: number;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuestionResponse {
  id: string;
  userId: string;
  questionId: string;
  questionListId?: string;
  selectedAlternativeId?: string | null;
  selectedOptionId?: string | null;
  isCorrectOnFirstAttempt: boolean;
  reviewQuality?: ReviewQuality;
  answeredAt: Timestamp;
  responseTimeSeconds?: number;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  failStreak?: number;
  isLearning?: boolean;
  isLeech?: boolean;
  lastReviewQuality?: ReviewQuality;
  lastReviewedAt?: Timestamp | null;
  nextReviewDate?: Timestamp;
  programmedReviewId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseQuestionList {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: FirebaseQuestionListStatus;
  questionCount?: number;
  lastActivityAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  title?: string;
  viewCount?: number;
  favoriteCount?: number;
  lastStudyDate?: Timestamp | null;
  completionPercentage?: number;
  lastAddedAt?: Timestamp | null;
  isPublic?: boolean;
  tags?: string[];
}

export interface FirebaseQuestionListItem {
  id: string;
  questionListId: string;
  questionId: string;
  order: number;
  status: FirebaseQuestionListItemStatus;
  lastAttemptedAt?: Timestamp | null;
  notes?: string;
  personalNotes?: string | null;
  addedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isCompleted?: boolean;
  correctAttempts?: number;
  incorrectAttempts?: number;
}

export interface FirebaseQuestionListCreatePayload {
  userId: string;
  title: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface FirebaseQuestionListItemCreatePayload {
  questionListId: string;
  questionId: string;
  order: number;
  personalNotes?: string | null;
}

export interface FirebaseQuestionListItemUpdatePayload {
  order?: number;
  status?: FirebaseQuestionListItemStatus;
  personalNotes?: string | null;
}

export interface FirebaseUserFavoriteQuestionList {
  id: string;
  userId: string;
  questionListId: string;
  createdAt: Timestamp;
}

export type FirebaseQuestionListUpdatePayload = Partial<Omit<FirebaseQuestionList, "id" | "userId" | "createdAt" | "updatedAt">>;

// Já definido anteriormente
// export enum FirebaseSimulatedExamStatus {
//   DRAFT = "DRAFT",
//   PUBLISHED = "PUBLISHED",
//   SCHEDULED = "SCHEDULED",
//   COMPLETED = "COMPLETED",
//   ARCHIVED = "ARCHIVED"
// }

// export enum FirebaseSimulatedExamDifficultyLevel {
//   EASY = "EASY",
//   MEDIUM = "MEDIUM",
//   HARD = "HARD",
//   MIXED = "MIXED"
// }

// Já definido anteriormente
// export interface FirebaseSimulatedExam {
//   id: string;
//   userId: string;
//   creatorName: string | null;
//   title: string;
//   description: string | null;
//   questionCount: number;
//   timeLimitMinutes: number;
//   isPublic: boolean;
//   status: FirebaseSimulatedExamStatus;
//   difficultyLevel: FirebaseSimulatedExamDifficultyLevel;
//   scheduledAt: Timestamp | null;
//   settings: Record<string, any> | null;
//   filterIds: string[] | null;
//   subFilterIds: string[] | null;
//   tags: string[] | null;
//   questionIds: string[] | null;
//   participantCount: number;
//   averageScore: number | null;
//   lastPublishedAt: Timestamp | null;
//   createdAt: Timestamp;
//   updatedAt: Timestamp;
// }

export interface FirebaseSimulatedExamQuestion {
  id: string;
  simulatedExamId: string;
  questionId: string;
  order: number;
  points: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Removido para evitar conflito com a interface existente
// export interface FirebaseSimulatedExamAnswer {
//   questionId: string;
//   selectedAlternativeId: string | null;
//   isCorrect: boolean;
//   timeSpentSeconds: number;
//   answeredAt: Timestamp;
// }

// Já definido anteriormente
// export interface FirebaseSimulatedExamResult {
//   id: string;
//   userId: string;
//   simulatedExamId: string;
//   score: number;
//   totalQuestions: number;
//   correctAnswers: number;
//   incorrectAnswers: number;
//   unansweredQuestions: number;
//   timeSpentSeconds: number;
//   startedAt: Timestamp;
//   completedAt: Timestamp | null;
//   answers: FirebaseSimulatedExamAnswer[];
//   status: "in_progress" | "completed" | "abandoned";
//   createdAt: Timestamp;
//   updatedAt: Timestamp;
// }


// Interface para estatísticas de flashcards do usuário
// Removida a interface duplicada para resolver conflitos de declaração