import admin, { firestore } from '../config/firebaseAdmin';
import { FirebaseMentorshipFeedback } from '../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = firestore;

const COLLECTION_NAME = 'mentorship_feedbacks';

/**
 * Creates a new mentorship feedback
 */
export const createMentorshipFeedback = async (
  mentorshipId: string,
  fromUserId: string,
  toUserId: string,
  content: string,
  rating?: number | null,
  meetingId?: string | null,
  isAnonymous: boolean = false,
): Promise<FirebaseMentorshipFeedback> => {
  // Validate inputs
  if (fromUserId === toUserId) {
    throw new Error('Feedback sender and receiver cannot be the same user.');
  }

  if (content.trim() === '') {
    throw new Error('Feedback content cannot be empty.');
  }

  if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5.');
  }

  // Check if mentorship exists
  const mentorshipDoc = await db.collection('mentorships').doc(mentorshipId).get();
  if (!mentorshipDoc.exists) {
    throw new Error(`Mentorship with ID ${mentorshipId} does not exist.`);
  }

  // Check if meeting exists if provided
  if (meetingId) {
    const meetingDoc = await db.collection('mentorship_meetings').doc(meetingId).get();
    if (!meetingDoc.exists) {
      throw new Error(`Meeting with ID ${meetingId} does not exist.`);
    }
  }

  // Check if users exist
  const fromUserDoc = await db.collection('users').doc(fromUserId).get();
  if (!fromUserDoc.exists) {
    throw new Error(`User with ID ${fromUserId} does not exist.`);
  }

  const toUserDoc = await db.collection('users').doc(toUserId).get();
  if (!toUserDoc.exists) {
    throw new Error(`User with ID ${toUserId} does not exist.`);
  }

  const now = Timestamp.now();
  const id = uuidv4();

  const feedback: FirebaseMentorshipFeedback = {
    id,
    mentorshipId,
    fromUserId,
    toUserId,
    content,
    rating: rating || null,
    meetingId: meetingId || null,
    isAnonymous,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(feedback);
  return feedback;
};

/**
 * Retrieves a mentorship feedback by its ID
 */
export const getMentorshipFeedback = async (id: string): Promise<FirebaseMentorshipFeedback | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorshipFeedback;
};

/**
 * Updates a mentorship feedback with new data
 */
export const updateMentorshipFeedback = async (
  id: string,
  data: Partial<Omit<FirebaseMentorshipFeedback, 'id' | 'mentorshipId' | 'fromUserId' | 'toUserId' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorshipFeedback | null> => {
  const feedbackRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await feedbackRef.get();
  
  if (!doc.exists) {
    return null;
  }

  // Validate updates
  if (data.content !== undefined && data.content.trim() === '') {
    throw new Error('Feedback content cannot be empty.');
  }

  if (data.rating !== undefined && data.rating !== null && (data.rating < 1 || data.rating > 5)) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const updateData = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  await feedbackRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await feedbackRef.get();
  return updatedDoc.data() as FirebaseMentorshipFeedback;
};

/**
 * Deletes a mentorship feedback by its ID
 */
export const deleteMentorshipFeedback = async (id: string): Promise<boolean> => {
  const feedbackRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await feedbackRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await feedbackRef.delete();
  return true;
};

/**
 * Lists all feedback for a mentorship
 */
export const getFeedbackByMentorship = async (mentorshipId: string): Promise<FirebaseMentorshipFeedback[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const feedbacks = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipFeedback);
  return feedbacks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all feedback for a meeting
 */
export const getFeedbackByMeeting = async (meetingId: string): Promise<FirebaseMentorshipFeedback[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('meetingId', '==', meetingId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const feedbacks = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipFeedback);
  return feedbacks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all feedback given by a user
 */
export const getFeedbackGivenByUser = async (userId: string): Promise<FirebaseMentorshipFeedback[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('fromUserId', '==', userId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const feedbacks = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipFeedback);
  return feedbacks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all feedback received by a user
 */
export const getFeedbackReceivedByUser = async (userId: string): Promise<FirebaseMentorshipFeedback[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('toUserId', '==', userId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const feedbacks = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipFeedback);
  return feedbacks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Gets the average rating received by a user
 */
export const getAverageRatingForUser = async (userId: string): Promise<number | null> => {
  // Não podemos usar .where('rating', '!=', null) com outro filtro sem índice composto
  // Então vamos buscar todos os feedbacks para o usuário e filtrar manualmente
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('toUserId', '==', userId)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const feedbacks = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipFeedback);
  const validRatings = feedbacks.filter(f => f.rating !== null && f.rating !== undefined);
  
  if (validRatings.length === 0) {
    return null;
  }
  
  const sum = validRatings.reduce((acc, feedback) => acc + (feedback.rating || 0), 0);
  return parseFloat((sum / validRatings.length).toFixed(1));
};