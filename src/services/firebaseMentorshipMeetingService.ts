import admin, { firestore } from '../config/firebaseAdmin';
import { 
  FirebaseMentorshipMeeting, 
  FirebaseMeetingStatus, 
  FirebaseMeetingType 
} from '../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { recordMeetingCompletion } from './firebaseMentorshipService';

const db = firestore;

const COLLECTION_NAME = 'mentorship_meetings';

/**
 * Creates a new mentorship meeting
 */
export const createMentorshipMeeting = async (
  mentorshipId: string,
  scheduledDate: Date,
  duration: number,
  meetingType: FirebaseMeetingType,
  agenda: string,
  meetingLink?: string | null,
  meetingLocation?: string | null,
  rescheduledFromId?: string | null,
): Promise<FirebaseMentorshipMeeting> => {
  // Validate inputs
  if (duration < 5) {
    throw new Error('Meeting duration must be at least 5 minutes.');
  }

  if (agenda.trim() === '') {
    throw new Error('Agenda cannot be empty.');
  }

  // Validate meeting link or location based on type
  if ((meetingType === FirebaseMeetingType.VIDEO || meetingType === FirebaseMeetingType.AUDIO) && !meetingLink) {
    throw new Error('Meeting link must be provided for virtual meetings.');
  }

  if (meetingType === FirebaseMeetingType.IN_PERSON && !meetingLocation) {
    throw new Error('Meeting location must be provided for in-person meetings.');
  }

  // Check if mentorship exists
  const mentorshipDoc = await db.collection('mentorships').doc(mentorshipId).get();
  if (!mentorshipDoc.exists) {
    throw new Error(`Mentorship with ID ${mentorshipId} does not exist.`);
  }

  // Check if rescheduled meeting exists if provided
  if (rescheduledFromId) {
    const rescheduledFromDoc = await db.collection(COLLECTION_NAME).doc(rescheduledFromId).get();
    if (!rescheduledFromDoc.exists) {
      throw new Error(`Original meeting with ID ${rescheduledFromId} does not exist.`);
    }
  }

  const now = Timestamp.now();
  const id = uuidv4();
  const scheduledTimestamp = Timestamp.fromDate(scheduledDate);

  const meeting: FirebaseMentorshipMeeting = {
    id,
    mentorshipId,
    scheduledDate: scheduledTimestamp,
    duration,
    status: FirebaseMeetingStatus.SCHEDULED,
    meetingType,
    meetingLink: meetingLink || null,
    meetingLocation: meetingLocation || null,
    agenda,
    rescheduledFromId: rescheduledFromId || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(meeting);

  // If this is a rescheduled meeting, update the original meeting
  if (rescheduledFromId) {
    await db.collection(COLLECTION_NAME).doc(rescheduledFromId).update({
      status: FirebaseMeetingStatus.RESCHEDULED,
      rescheduledToId: id,
      updatedAt: now,
    });
  }

  return meeting;
};

/**
 * Retrieves a mentorship meeting by its ID
 */
export const getMentorshipMeeting = async (id: string): Promise<FirebaseMentorshipMeeting | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorshipMeeting;
};

/**
 * Updates a mentorship meeting with new data
 */
export const updateMentorshipMeeting = async (
  id: string,
  data: Partial<Omit<FirebaseMentorshipMeeting, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }

  const meeting = doc.data() as FirebaseMentorshipMeeting;

  // Validate updates
  if (data.duration !== undefined && data.duration < 5) {
    throw new Error('Meeting duration must be at least 5 minutes.');
  }

  if (data.agenda !== undefined && data.agenda.trim() === '') {
    throw new Error('Agenda cannot be empty.');
  }

  const meetingType = data.meetingType || meeting.meetingType;
  const meetingLink = data.meetingLink !== undefined ? data.meetingLink : meeting.meetingLink;
  const meetingLocation = data.meetingLocation !== undefined ? data.meetingLocation : meeting.meetingLocation;

  if ((meetingType === FirebaseMeetingType.VIDEO || meetingType === FirebaseMeetingType.AUDIO) && !meetingLink) {
    throw new Error('Meeting link must be provided for virtual meetings.');
  }

  if (meetingType === FirebaseMeetingType.IN_PERSON && !meetingLocation) {
    throw new Error('Meeting location must be provided for in-person meetings.');
  }

  const updateData = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  await meetingRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Deletes a mentorship meeting by its ID
 */
export const deleteMentorshipMeeting = async (id: string): Promise<boolean> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await meetingRef.delete();
  return true;
};

/**
 * Lists all meetings for a mentorship
 */
export const getMeetingsByMentorship = async (mentorshipId: string): Promise<FirebaseMentorshipMeeting[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('scheduledDate', 'asc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const meetings = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipMeeting);
  return meetings.sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis());
};

/**
 * Lists upcoming meetings for a mentorship
 */
export const getUpcomingMeetings = async (mentorshipId: string): Promise<FirebaseMentorshipMeeting[]> => {
  const now = Timestamp.now();
  
  // Primeiro, obter todas as reuniões agendadas para este mentorship
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    .where('status', '==', FirebaseMeetingStatus.SCHEDULED)
    .get();
  
  // Filtrar manualmente as reuniões futuras e ordenar
  const meetings = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipMeeting);
  return meetings
    .filter(meeting => meeting.scheduledDate.toMillis() >= now.toMillis())
    .sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis());
};

/**
 * Marks a meeting as completed
 */
export const completeMeeting = async (
  id: string,
  actualDate: Date,
  actualDuration: number,
  notes?: string | null,
  mentorFeedback?: string | null,
  studentFeedback?: string | null
): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const meeting = doc.data() as FirebaseMentorshipMeeting;
  
  if (meeting.status !== FirebaseMeetingStatus.SCHEDULED) {
    throw new Error('Only scheduled meetings can be completed.');
  }
  
  if (actualDuration < 0) {
    throw new Error('Actual duration cannot be negative.');
  }
  
  const now = Timestamp.now();
  const actualDateTimestamp = Timestamp.fromDate(actualDate);
  
  const updateData: any = {
    status: FirebaseMeetingStatus.COMPLETED,
    actualDate: actualDateTimestamp,
    actualDuration,
    updatedAt: now,
  };
  
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  
  if (mentorFeedback !== undefined) {
    updateData.mentorFeedback = mentorFeedback;
  }
  
  if (studentFeedback !== undefined) {
    updateData.studentFeedback = studentFeedback;
  }
  
  await meetingRef.update(updateData);
  
  // Update the parent mentorship's completed meetings count
  try {
    await recordMeetingCompletion(meeting.mentorshipId);
  } catch (error) {
    console.error(`Error updating mentorship ${meeting.mentorshipId} after meeting ${id} completion:`, error);
    // Continue anyway, as the meeting is already marked as completed
  }
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Cancels a scheduled meeting
 */
export const cancelMeeting = async (id: string, reason?: string | null): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const meeting = doc.data() as FirebaseMentorshipMeeting;
  
  if (meeting.status !== FirebaseMeetingStatus.SCHEDULED) {
    throw new Error('Only scheduled meetings can be cancelled.');
  }
  
  const now = Timestamp.now();
  const updateData: any = {
    status: FirebaseMeetingStatus.CANCELLED,
    updatedAt: now,
  };
  
  if (reason) {
    const cancellationNote = `Cancellation (${now.toDate().toISOString().split('T')[0]}): ${reason}`;
    updateData.notes = meeting.notes 
      ? `${meeting.notes}\n\n${cancellationNote}` 
      : cancellationNote;
  }
  
  await meetingRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Reschedules a meeting by creating a new meeting instance and linking them
 */
export const rescheduleMeeting = async (
  id: string,
  newDate: Date,
  newDuration?: number | null,
  newMeetingType?: FirebaseMeetingType | null,
  newMeetingLink?: string | null,
  newMeetingLocation?: string | null,
  newAgenda?: string | null,
  reason?: string | null
): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const meeting = doc.data() as FirebaseMentorshipMeeting;
  
  if (meeting.status !== FirebaseMeetingStatus.SCHEDULED) {
    throw new Error('Only scheduled meetings can be rescheduled.');
  }
  
  // Create the new meeting
  const newMeeting = await createMentorshipMeeting(
    meeting.mentorshipId,
    newDate,
    newDuration ?? meeting.duration,
    newMeetingType ?? meeting.meetingType,
    newAgenda ?? meeting.agenda,
    newMeetingLink === undefined ? meeting.meetingLink : newMeetingLink,
    newMeetingLocation === undefined ? meeting.meetingLocation : newMeetingLocation,
    meeting.id
  );
  
  // Update the original meeting with rescheduled status and reason
  if (reason) {
    const now = Timestamp.now();
    const rescheduleNote = `Rescheduled (${now.toDate().toISOString().split('T')[0]}): ${reason}`;
    
    await meetingRef.update({
      notes: meeting.notes 
        ? `${meeting.notes}\n\n${rescheduleNote}` 
        : rescheduleNote,
      updatedAt: now,
    });
  }
  
  return newMeeting;
};

/**
 * Adds notes to a meeting
 */
export const addNotes = async (id: string, notesToAdd: string): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const meeting = doc.data() as FirebaseMentorshipMeeting;
  
  const notes = meeting.notes 
    ? `${meeting.notes}\n\n${notesToAdd}` 
    : notesToAdd;
  
  await meetingRef.update({
    notes,
    updatedAt: Timestamp.now(),
  });
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Adds mentor feedback to a meeting
 */
export const addMentorFeedback = async (id: string, feedback: string): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  await meetingRef.update({
    mentorFeedback: feedback,
    updatedAt: Timestamp.now(),
  });
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Adds student feedback to a meeting
 */
export const addStudentFeedback = async (id: string, feedback: string): Promise<FirebaseMentorshipMeeting | null> => {
  const meetingRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await meetingRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  await meetingRef.update({
    studentFeedback: feedback,
    updatedAt: Timestamp.now(),
  });
  
  // Get the updated document
  const updatedDoc = await meetingRef.get();
  return updatedDoc.data() as FirebaseMentorshipMeeting;
};

/**
 * Checks if a meeting is upcoming (scheduled within the next 24 hours)
 */
export const isUpcoming = (meeting: FirebaseMentorshipMeeting): boolean => {
  if (meeting.status !== FirebaseMeetingStatus.SCHEDULED) {
    return false;
  }
  
  try {
    const now = new Date();
    const meetingDate = meeting.scheduledDate.toDate();
    const diffMillis = meetingDate.getTime() - now.getTime();
    const diffHours = diffMillis / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  } catch (error) {
    console.error(`Error checking if meeting ${meeting.id} is upcoming:`, error);
    return false;
  }
};

/**
 * Gets a summary of a meeting
 */
export const getMeetingSummary = (meeting: FirebaseMentorshipMeeting): any => {
  return {
    id: meeting.id,
    mentorshipId: meeting.mentorshipId,
    scheduledDate: meeting.scheduledDate,
    actualDate: meeting.actualDate,
    duration: meeting.duration,
    actualDuration: meeting.actualDuration,
    status: meeting.status,
    meetingType: meeting.meetingType,
    meetingLink: meeting.meetingLink,
    meetingLocation: meeting.meetingLocation,
    agenda: meeting.agenda,
    isUpcoming: isUpcoming(meeting),
    hasMentorFeedback: !!meeting.mentorFeedback,
    hasStudentFeedback: !!meeting.studentFeedback,
    rescheduledToId: meeting.rescheduledToId,
    rescheduledFromId: meeting.rescheduledFromId,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
};