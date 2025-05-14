import admin, { firestore } from '../config/firebaseAdmin';
import { FirebaseMentorshipObjective, FirebaseObjectiveStatus } from '../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = firestore;

const COLLECTION_NAME = 'mentorship_objectives';

/**
 * Creates a new mentorship objective
 */
export const createMentorshipObjective = async (
  mentorshipId: string,
  title: string,
  description?: string | null,
  targetDate?: Date | null,
  status: FirebaseObjectiveStatus = FirebaseObjectiveStatus.PENDING,
  progress: number = 0,
): Promise<FirebaseMentorshipObjective> => {
  // Validate inputs
  if (title.trim() === '') {
    throw new Error('Objective title cannot be empty.');
  }

  if (progress < 0 || progress > 100) {
    throw new Error('Progress must be between 0 and 100.');
  }

  // Check if mentorship exists
  const mentorshipDoc = await db.collection('mentorships').doc(mentorshipId).get();
  if (!mentorshipDoc.exists) {
    throw new Error(`Mentorship with ID ${mentorshipId} does not exist.`);
  }

  const now = Timestamp.now();
  const id = uuidv4();

  const objective: FirebaseMentorshipObjective = {
    id,
    mentorshipId,
    title,
    description: description || null,
    status,
    targetDate: targetDate ? Timestamp.fromDate(targetDate) : null,
    completedDate: null,
    progress,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(objective);
  return objective;
};

/**
 * Retrieves a mentorship objective by its ID
 */
export const getMentorshipObjective = async (id: string): Promise<FirebaseMentorshipObjective | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorshipObjective;
};

/**
 * Updates a mentorship objective with new data
 */
export const updateMentorshipObjective = async (
  id: string,
  data: Partial<Omit<FirebaseMentorshipObjective, 'id' | 'mentorshipId' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorshipObjective | null> => {
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return null;
  }

  // Validate updates
  if (data.title !== undefined && data.title.trim() === '') {
    throw new Error('Objective title cannot be empty.');
  }

  if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
    throw new Error('Progress must be between 0 and 100.');
  }

  // If status is being updated to completed, set completedDate if not provided
  const updateData: any = { ...data };
  if (data.status === FirebaseObjectiveStatus.COMPLETED && !data.completedDate) {
    updateData.completedDate = Timestamp.now();
  }

  // If progress is set to 100, update status to completed if not specified
  if (data.progress === 100 && !data.status) {
    updateData.status = FirebaseObjectiveStatus.COMPLETED;
    if (!data.completedDate && !updateData.completedDate) {
      updateData.completedDate = Timestamp.now();
    }
  }

  updateData.updatedAt = Timestamp.now();

  await objectiveRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await objectiveRef.get();
  return updatedDoc.data() as FirebaseMentorshipObjective;
};

/**
 * Deletes a mentorship objective by its ID
 */
export const deleteMentorshipObjective = async (id: string): Promise<boolean> => {
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await objectiveRef.delete();
  return true;
};

/**
 * Lists all objectives for a mentorship
 */
export const getObjectivesByMentorship = async (mentorshipId: string): Promise<FirebaseMentorshipObjective[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const objectives = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipObjective);
  return objectives.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all objectives for a mentorship with a specific status
 */
export const getObjectivesByStatus = async (
  mentorshipId: string, 
  status: FirebaseObjectiveStatus
): Promise<FirebaseMentorshipObjective[]> => {
  // Primeiro, obter todos os objetivos para este mentorship
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Filtrar manualmente por status e ordenar
  const objectives = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipObjective);
  return objectives
    .filter(objective => objective.status === status)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Updates the progress of an objective
 */
export const updateProgress = async (
  id: string, 
  progress: number
): Promise<FirebaseMentorshipObjective | null> => {
  if (progress < 0 || progress > 100) {
    throw new Error('Progress must be between 0 and 100.');
  }
  
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const objective = doc.data() as FirebaseMentorshipObjective;
  const now = Timestamp.now();
  
  const updateData: any = {
    progress,
    updatedAt: now,
  };
  
  // If progress is 100%, update status to completed if not already
  if (progress === 100 && objective.status !== FirebaseObjectiveStatus.COMPLETED) {
    updateData.status = FirebaseObjectiveStatus.COMPLETED;
    updateData.completedDate = now;
  }
  
  await objectiveRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await objectiveRef.get();
  return updatedDoc.data() as FirebaseMentorshipObjective;
};

/**
 * Marks an objective as completed
 */
export const completeObjective = async (id: string): Promise<FirebaseMentorshipObjective | null> => {
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const now = Timestamp.now();
  
  await objectiveRef.update({
    status: FirebaseObjectiveStatus.COMPLETED,
    progress: 100,
    completedDate: now,
    updatedAt: now,
  });
  
  // Get the updated document
  const updatedDoc = await objectiveRef.get();
  return updatedDoc.data() as FirebaseMentorshipObjective;
};

/**
 * Marks an objective as in progress
 */
export const startObjective = async (id: string): Promise<FirebaseMentorshipObjective | null> => {
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const objective = doc.data() as FirebaseMentorshipObjective;
  
  if (objective.status === FirebaseObjectiveStatus.COMPLETED) {
    throw new Error('Cannot start an already completed objective.');
  }
  
  await objectiveRef.update({
    status: FirebaseObjectiveStatus.IN_PROGRESS,
    updatedAt: Timestamp.now(),
  });
  
  // Get the updated document
  const updatedDoc = await objectiveRef.get();
  return updatedDoc.data() as FirebaseMentorshipObjective;
};

/**
 * Cancels an objective
 */
export const cancelObjective = async (id: string): Promise<FirebaseMentorshipObjective | null> => {
  const objectiveRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await objectiveRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  await objectiveRef.update({
    status: FirebaseObjectiveStatus.CANCELLED,
    updatedAt: Timestamp.now(),
  });
  
  // Get the updated document
  const updatedDoc = await objectiveRef.get();
  return updatedDoc.data() as FirebaseMentorshipObjective;
};