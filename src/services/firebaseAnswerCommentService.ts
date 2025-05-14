import { db } from "../firebase_config/firebaseAdmin";
import { 
    FirebaseAnswerComment,
    FirebaseAnswerCommentStatus
} from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";
import { AppError } from "../utils/errors";

const ANSWER_COMMENTS_COLLECTION = "answerComments";

/**
 * Creates a new comment on a question.
 * @param authorId - The ID of the user creating the comment.
 * @param questionId - The ID of the question being commented on.
 * @param content - The text content of the comment.
 * @param parentId - Optional ID of the parent comment if this is a reply.
 * @returns The created FirebaseAnswerComment object.
 */
const createAnswerComment = async (
    authorId: string, 
    questionId: string, 
    content: string, 
    parentId?: string | null
): Promise<FirebaseAnswerComment> => {
    if (!authorId || !questionId || !content) {
        throw new AppError("Author ID, Question ID, and Content are required.", 400);
    }

    const newCommentRef = db.collection(ANSWER_COMMENTS_COLLECTION).doc();
    const now = Timestamp.now();

    const newCommentData: FirebaseAnswerComment = {
        id: newCommentRef.id,
        authorId,
        questionId,
        content,
        parentId: parentId || null,
        status: FirebaseAnswerCommentStatus.PENDING, // Default status
        createdAt: now,
        updatedAt: now,
    };

    await newCommentRef.set(newCommentData);
    return newCommentData;
};

/**
 * Retrieves a comment by its ID.
 * @param commentId - The ID of the comment.
 * @returns The FirebaseAnswerComment object or null if not found.
 */
const getAnswerCommentById = async (commentId: string): Promise<FirebaseAnswerComment | null> => {
    if (!commentId) {
        throw new AppError("Comment ID is required.", 400);
    }
    const commentDoc = await db.collection(ANSWER_COMMENTS_COLLECTION).doc(commentId).get();
    if (!commentDoc.exists) {
        return null;
    }
    return { id: commentDoc.id, ...commentDoc.data() } as FirebaseAnswerComment;
};

/**
 * Updates the content of a comment.
 * Only the author should be allowed to do this, or an admin.
 * @param commentId - The ID of the comment to update.
 * @param content - The new content for the comment.
 * @param requestingUserId - The ID of the user requesting the update (for permission check).
 * @returns The updated FirebaseAnswerComment object.
 */
const updateAnswerCommentContent = async (commentId: string, content: string, requestingUserId: string): Promise<FirebaseAnswerComment> => {
    if (!commentId || !content || !requestingUserId) {
        throw new AppError("Comment ID, content, and requesting User ID are required.", 400);
    }

    const commentRef = db.collection(ANSWER_COMMENTS_COLLECTION).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
        throw new AppError(`Comment with ID ${commentId} not found.`, 404);
    }

    const commentData = commentDoc.data() as FirebaseAnswerComment;
    if (commentData.authorId !== requestingUserId) {
        throw new AppError("User is not authorized to edit this comment.", 403);
    }

    const updates: Partial<FirebaseAnswerComment> = {
        content,
        updatedAt: Timestamp.now(),
    };

    await commentRef.update(updates);
    return { ...commentData, ...updates } as FirebaseAnswerComment;
};

/**
 * Updates the status of a comment (e.g., approve, reject, mark as spam).
 * Typically an admin/moderator action.
 * @param commentId - The ID of the comment.
 * @param status - The new status for the comment.
 * @returns The updated FirebaseAnswerComment object.
 */
const updateAnswerCommentStatus = async (commentId: string, status: FirebaseAnswerCommentStatus): Promise<FirebaseAnswerComment> => {
    if (!commentId || !status) {
        throw new AppError("Comment ID and status are required.", 400);
    }
    if (!Object.values(FirebaseAnswerCommentStatus).includes(status)) {
        throw new AppError("Invalid comment status provided.", 400);
    }

    const commentRef = db.collection(ANSWER_COMMENTS_COLLECTION).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
        throw new AppError(`Comment with ID ${commentId} not found.`, 404);
    }

    const updates: Partial<FirebaseAnswerComment> = {
        status,
        updatedAt: Timestamp.now(),
    };

    await commentRef.update(updates);
    return { ...(commentDoc.data() as FirebaseAnswerComment), ...updates } as FirebaseAnswerComment;
};

/**
 * Retrieves comments for a specific question.
 * Can be filtered by status and parentId (for top-level or replies to a specific comment).
 * Ordered by createdAt (asc or desc).
 * @param questionId - The ID of the question.
 * @param options - Optional filters and pagination.
 * @returns An array of FirebaseAnswerComment objects.
 */
const getAnswerCommentsByQuestionId = async (
    questionId: string,
    options?: {
        status?: FirebaseAnswerCommentStatus;
        parentId?: string | null; 
        orderBy?: "createdAt";
        orderDirection?: "asc" | "desc";
        limit?: number;
        startAfter?: FirebaseAnswerComment; 
    }
): Promise<FirebaseAnswerComment[]> => {
    if (!questionId) {
        throw new AppError("Question ID is required.", 400);
    }

    let query = db.collection(ANSWER_COMMENTS_COLLECTION).where("questionId", "==", questionId);

    if (options?.status) {
        query = query.where("status", "==", options.status);
    }

    if (options?.parentId !== undefined) { 
        query = query.where("parentId", "==", options.parentId);
    }

    const orderByField = options?.orderBy || "createdAt";
    const orderDirection = options?.orderDirection || "asc";
    query = query.orderBy(orderByField, orderDirection);

    if (options?.startAfter) {
        const startAfterValue = options.startAfter[orderByField as keyof FirebaseAnswerComment];
        if (startAfterValue) {
            query = query.startAfter(startAfterValue);
        }
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAnswerComment));
};

/**
 * Deletes a comment. 
 * Consider soft delete or admin-only hard delete based on application rules.
 * @param commentId - The ID of the comment to delete.
 * @param requestingUserId - The ID of the user requesting deletion (for permission check).
 * @param isAdmin - Boolean indicating if the requesting user is an admin.
 */
const deleteAnswerComment = async (commentId: string, requestingUserId: string, isAdmin: boolean = false): Promise<void> => {
    if (!commentId || !requestingUserId) {
        throw new AppError("Comment ID and requesting User ID are required.", 400);
    }

    const commentRef = db.collection(ANSWER_COMMENTS_COLLECTION).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
        throw new AppError(`Comment with ID ${commentId} not found for deletion.`, 404);
    }

    const commentData = commentDoc.data() as FirebaseAnswerComment;
    if (!isAdmin && commentData.authorId !== requestingUserId) {
        throw new AppError("User is not authorized to delete this comment.", 403);
    }

    await commentRef.delete();
};

export default {
    createAnswerComment,
    getAnswerCommentById,
    updateAnswerCommentContent,
    updateAnswerCommentStatus,
    getAnswerCommentsByQuestionId,
    deleteAnswerComment,
};
