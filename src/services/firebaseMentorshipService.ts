import { admin, firestore } from '../config/firebaseAdmin';
import { 
  FirebaseMentorship, 
  FirebaseMentorshipStatus, 
  FirebaseMeetingFrequency 
} from '../types/firebaseTypes';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = firestore;

const COLLECTION_NAME = 'mentorships';

/**
 * Creates a new mentorship relationship between a mentor and a student
 */
export const createMentorship = async (
  mentorId: string,
  studentId: string,
  title: string, // Added title parameter
  objectives: string[],
  meetingFrequency: FirebaseMeetingFrequency = FirebaseMeetingFrequency.WEEKLY,
  customFrequencyDays?: number,
  totalMeetings: number = 0,
): Promise<FirebaseMentorship> => {
  if (mentorId === studentId) {
    throw new Error('Mentor and student cannot be the same user.');
  }

  if (meetingFrequency === FirebaseMeetingFrequency.CUSTOM && !customFrequencyDays) {
    throw new Error('customFrequencyDays must be set when meetingFrequency is custom.');
  }

  // Check if users exist
  const mentorDoc = await db.collection('users').doc(mentorId).get();
  if (!mentorDoc.exists) {
    throw new Error(`Mentor with ID ${mentorId} does not exist.`);
  }

  const studentDoc = await db.collection('users').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new Error(`Student with ID ${studentId} does not exist.`);
  }

  // Check if there's already an active mentorship between these users
  const existingMentorships = await db.collection(COLLECTION_NAME)
    .where('mentorId', '==', mentorId)
    .where('studentId', '==', studentId)
    .where('status', 'in', [FirebaseMentorshipStatus.PENDING, FirebaseMentorshipStatus.ACTIVE])
    .get();

  if (!existingMentorships.empty) {
    throw new Error('An active or pending mentorship already exists between these users.');
  }

  const now = Timestamp.now();
  const id = uuidv4();

  const mentorship: FirebaseMentorship = {
    id,
    mentorId,
    menteeId: studentId,
    title, // Added title property
    status: FirebaseMentorshipStatus.PENDING,
    objectives,
    meetingFrequency,
    customFrequencyDays: meetingFrequency === FirebaseMeetingFrequency.CUSTOM ? (customFrequencyDays || undefined) : undefined,
    totalMeetings,
    completedMeetings: 0, // Initialized to 0
    startDate: now, // Added startDate, initialized with now
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(mentorship);
  return mentorship;
};

/**
 * Retrieves a mentorship by its ID
 */
export const getMentorship = async (id: string): Promise<FirebaseMentorship | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorship;
};

/**
 * Updates a mentorship with new data
 */
export const updateMentorship = async (
  id: string,
  data: Partial<Omit<FirebaseMentorship, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }

  const mentorship = doc.data() as FirebaseMentorship;

  // Validate updates
  if (data.mentorId && data.menteeId && data.mentorId === data.menteeId) {
    throw new Error('Mentor and student cannot be the same user.');
  }

  if (
    data.meetingFrequency === FirebaseMeetingFrequency.CUSTOM && 
    data.customFrequencyDays === undefined && 
    mentorship.customFrequencyDays === null
  ) {
    throw new Error('customFrequencyDays must be set when meetingFrequency is custom.');
  }

  if (
    data.completedMeetings !== undefined && 
    data.totalMeetings !== undefined && 
    data.completedMeetings > data.totalMeetings && 
    data.totalMeetings > 0
  ) {
    throw new Error('Completed meetings cannot exceed total planned meetings.');
  }

  const updateData = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Deletes a mentorship by its ID
 */
export const deleteMentorship = async (id: string): Promise<boolean> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await mentorshipRef.delete();
  return true;
};

/**
 * Lists all mentorships for a mentor
 */
export const getMentorshipsByMentor = async (mentorId: string): Promise<FirebaseMentorship[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorId', '==', mentorId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  return snapshot.docs.map((doc: any) => doc.data() as FirebaseMentorship);
};

/**
 * Lists all mentorships for a student
 */
export const getMentorshipsByStudent = async (studentId: string): Promise<FirebaseMentorship[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('studentId', '==', studentId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  return snapshot.docs.map((doc: any) => doc.data() as FirebaseMentorship);
};

/**
 * Lists all active mentorships
 */
export const getActiveMentorships = async (): Promise<FirebaseMentorship[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('status', '==', FirebaseMentorshipStatus.ACTIVE)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  return snapshot.docs.map((doc: any) => doc.data() as FirebaseMentorship);
};

/**
 * Accepts a pending mentorship request and activates it
 */
export const acceptMentorship = async (id: string): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  
  if (mentorship.status !== FirebaseMentorshipStatus.PENDING) {
    throw new Error('Only pending mentorships can be accepted.');
  }
  
  const now = Timestamp.now();
  const freqForCalcAccept = mentorship.meetingFrequency || FirebaseMeetingFrequency.WEEKLY;
  const nextMeetingDate = calculateNextMeetingDate(
    now,
    freqForCalcAccept,
    mentorship.customFrequencyDays
  );
  
  const updateData = {
    status: FirebaseMentorshipStatus.ACTIVE,
    startDate: now,
    nextMeetingDate,
    updatedAt: now,
  };
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Cancels an active or pending mentorship
 */
export const cancelMentorship = async (id: string, reason?: string): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  
  if (
    mentorship.status === FirebaseMentorshipStatus.COMPLETED || 
    mentorship.status === FirebaseMentorshipStatus.CANCELLED
  ) {
    throw new Error('Cannot cancel an already completed or cancelled mentorship.');
  }
  
  const now = Timestamp.now();
  const updateData: any = {
    status: FirebaseMentorshipStatus.CANCELLED,
    endDate: now,
    updatedAt: now,
  };
  
  if (reason) {
    const cancellationNote = `Cancellation (${now.toDate().toISOString().split('T')[0]}): ${reason}`;
    updateData.notes = mentorship.notes 
      ? `${mentorship.notes}\n\n${cancellationNote}` 
      : cancellationNote;
  }
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Completes an active mentorship
 */
export const completeMentorship = async (
  id: string, 
  rating?: number | null, 
  feedback?: string | null
): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  
  if (mentorship.status !== FirebaseMentorshipStatus.ACTIVE) {
    throw new Error('Only active mentorships can be completed.');
  }
  
  if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
    throw new Error('Rating must be between 1 and 5.');
  }
  
  const now = Timestamp.now();
  const updateData: any = {
    status: FirebaseMentorshipStatus.COMPLETED,
    endDate: now,
    updatedAt: now,
  };
  
  if (rating !== undefined && rating !== null) {
    updateData.rating = rating;
  }
  
  if (feedback !== undefined && feedback !== null) {
    updateData.feedback = feedback;
  }
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Records a completed meeting and updates the next meeting date
 */
export const recordMeetingCompletion = async (id: string): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  
  if (mentorship.status !== FirebaseMentorshipStatus.ACTIVE) {
    throw new Error('Cannot record meeting for non-active mentorship.');
  }
  
  const now = Timestamp.now();
  const freqForCalcRecord = mentorship.meetingFrequency || FirebaseMeetingFrequency.WEEKLY;
  const nextMeetingDate = calculateNextMeetingDate(
    now, 
    freqForCalcRecord, 
    mentorship.customFrequencyDays
  );
  
  const updateData = {
    completedMeetings: FieldValue.increment(1),
    nextMeetingDate,
    updatedAt: now,
  };
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Updates the objectives of a mentorship
 */
export const updateObjectives = async (id: string, objectives: string[]): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  
  if (
    mentorship.status !== FirebaseMentorshipStatus.ACTIVE && 
    mentorship.status !== FirebaseMentorshipStatus.PENDING
  ) {
    throw new Error('Objectives can only be updated for active or pending mentorships.');
  }
  
  const updateData = {
    objectives,
    updatedAt: Timestamp.now(),
  };
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Updates the meeting frequency and recalculates the next meeting date
 */
export const updateMeetingFrequency = async (
  id: string, 
  frequency: FirebaseMeetingFrequency, 
  customDays?: number | null
): Promise<FirebaseMentorship | null> => {
  const mentorshipRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await mentorshipRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  if (frequency === FirebaseMeetingFrequency.CUSTOM) {
    if (!customDays || customDays < 1) {
      throw new Error('Custom frequency requires a valid number of days (>= 1).');
    }
  }
  
  const mentorship = doc.data() as FirebaseMentorship;
  const now = Timestamp.now();
  
  const nextMeetingDate = calculateNextMeetingDate(
    now, 
    frequency, 
    frequency === FirebaseMeetingFrequency.CUSTOM ? customDays : null
  );
  
  const updateData: any = {
    meetingFrequency: frequency,
    customFrequencyDays: frequency === FirebaseMeetingFrequency.CUSTOM ? customDays : null,
    nextMeetingDate,
    updatedAt: now,
  };
  
  await mentorshipRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await mentorshipRef.get();
  return updatedDoc.data() as FirebaseMentorship;
};

/**
 * Calculates the next meeting date based on the current date and meeting frequency
 */
const calculateNextMeetingDate = (
  baseDate: Timestamp, 
  frequency: FirebaseMeetingFrequency, 
  customDays?: number | null
): Timestamp => {
  const date = baseDate.toDate();
  let daysToAdd: number;
  
  switch (frequency) {
    case FirebaseMeetingFrequency.WEEKLY:
      daysToAdd = 7;
      break;
    case FirebaseMeetingFrequency.BIWEEKLY:
      daysToAdd = 14;
      break;
    case FirebaseMeetingFrequency.MONTHLY:
      daysToAdd = 30;
      break;
    case FirebaseMeetingFrequency.CUSTOM:
      daysToAdd = customDays || 7;
      break;
    default:
      daysToAdd = 7;
  }
  
  // Ensure daysToAdd is at least 1
  daysToAdd = Math.max(1, daysToAdd);
  
  date.setDate(date.getDate() + daysToAdd);
  return Timestamp.fromDate(date);
};

/**
 * Gets the progress percentage of a mentorship
 */
export const getProgress = (mentorship: FirebaseMentorship): number | null => {
  const completed = mentorship.completedMeetings || 0; // Ensure completedMeetings is a number
  const total = mentorship.totalMeetings || 0;
  if (!total || total <= 0) {
    return null;
  }
  
  const progress = (completed / total) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

/**
 * Gets a summary of a mentorship
 */
export const getMentorshipSummary = (mentorship: FirebaseMentorship): any => {
  return {
    id: mentorship.id,
    mentorId: mentorship.mentorId,
    studentId: mentorship.menteeId,
    status: mentorship.status,
    startDate: mentorship.startDate,
    endDate: mentorship.endDate,
    objectives: mentorship.objectives,
    meetingFrequency: mentorship.meetingFrequency,
    customFrequencyDays: mentorship.customFrequencyDays,
    nextMeetingDate: mentorship.nextMeetingDate,
    totalMeetings: mentorship.totalMeetings,
    completedMeetings: mentorship.completedMeetings,
    progress: getProgress(mentorship),
    rating: mentorship.rating,
    createdAt: mentorship.createdAt,
    updatedAt: mentorship.updatedAt,
  };
};