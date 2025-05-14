import admin, { firestore } from '../config/firebaseAdmin';
import { FirebaseMentorshipSimulatedExam } from '../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = firestore;

const COLLECTION_NAME = 'mentorship_simulated_exams';

/**
 * Creates a new mentorship simulated exam assignment
 */
export const createMentorshipSimulatedExam = async (
  mentorshipId: string,
  simulatedExamId: string,
  assignedByUserId: string,
  dueDate?: Date | null,
): Promise<FirebaseMentorshipSimulatedExam> => {
  // Check if mentorship exists
  const mentorshipDoc = await db.collection('mentorships').doc(mentorshipId).get();
  if (!mentorshipDoc.exists) {
    throw new Error(`Mentorship with ID ${mentorshipId} does not exist.`);
  }

  // Check if simulated exam exists
  const examDoc = await db.collection('simulated_exams').doc(simulatedExamId).get();
  if (!examDoc.exists) {
    throw new Error(`Simulated exam with ID ${simulatedExamId} does not exist.`);
  }

  // Check if user exists
  const userDoc = await db.collection('users').doc(assignedByUserId).get();
  if (!userDoc.exists) {
    throw new Error(`User with ID ${assignedByUserId} does not exist.`);
  }

  // Check if this exam is already assigned to this mentorship
  const existingAssignments = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    .where('simulatedExamId', '==', simulatedExamId)
    .get();

  if (!existingAssignments.empty) {
    throw new Error('This simulated exam is already assigned to this mentorship.');
  }

  const now = Timestamp.now();
  const id = uuidv4();

  const assignment: FirebaseMentorshipSimulatedExam = {
    id,
    mentorshipId,
    simulatedExamId,
    assignedByUserId,
    assignedDate: now,
    dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
    completedDate: null,
    score: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(assignment);
  return assignment;
};

/**
 * Retrieves a mentorship simulated exam assignment by its ID
 */
export const getMentorshipSimulatedExam = async (id: string): Promise<FirebaseMentorshipSimulatedExam | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorshipSimulatedExam;
};

/**
 * Updates a mentorship simulated exam assignment with new data
 */
export const updateMentorshipSimulatedExam = async (
  id: string,
  data: Partial<Omit<FirebaseMentorshipSimulatedExam, 'id' | 'mentorshipId' | 'simulatedExamId' | 'assignedByUserId' | 'assignedDate' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorshipSimulatedExam | null> => {
  const assignmentRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await assignmentRef.get();
  
  if (!doc.exists) {
    return null;
  }

  const updateData = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  await assignmentRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await assignmentRef.get();
  return updatedDoc.data() as FirebaseMentorshipSimulatedExam;
};

/**
 * Deletes a mentorship simulated exam assignment by its ID
 */
export const deleteMentorshipSimulatedExam = async (id: string): Promise<boolean> => {
  const assignmentRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await assignmentRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await assignmentRef.delete();
  return true;
};

/**
 * Lists all simulated exam assignments for a mentorship
 */
export const getSimulatedExamsByMentorship = async (mentorshipId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('assignedDate', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const exams = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipSimulatedExam);
  return exams.sort((a, b) => b.assignedDate.toMillis() - a.assignedDate.toMillis());
};

/**
 * Lists all mentorships that have a specific simulated exam assigned
 */
export const getMentorshipsBySimulatedExam = async (simulatedExamId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('simulatedExamId', '==', simulatedExamId)
    // .orderBy('assignedDate', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const exams = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipSimulatedExam);
  return exams.sort((a, b) => b.assignedDate.toMillis() - a.assignedDate.toMillis());
};

/**
 * Lists all simulated exam assignments made by a specific user
 */
export const getSimulatedExamsByAssignedUser = async (userId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('assignedByUserId', '==', userId)
    // .orderBy('assignedDate', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const exams = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipSimulatedExam);
  return exams.sort((a, b) => b.assignedDate.toMillis() - a.assignedDate.toMillis());
};

/**
 * Lists all pending (not completed) simulated exam assignments for a mentorship
 */
export const getPendingSimulatedExams = async (mentorshipId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  // Primeiro, obter todos os exames para este mentorship
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('assignedDate', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Filtrar manualmente os exames pendentes e ordenar
  const exams = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipSimulatedExam);
  return exams
    .filter(exam => exam.completedDate === null)
    .sort((a, b) => b.assignedDate.toMillis() - a.assignedDate.toMillis());
};

/**
 * Lists all completed simulated exam assignments for a mentorship
 */
export const getCompletedSimulatedExams = async (mentorshipId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  // Primeiro, obter todos os exames para este mentorship
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('completedDate', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Filtrar manualmente os exames completados e ordenar
  const exams = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipSimulatedExam);
  return exams
    .filter(exam => exam.completedDate !== null)
    .sort((a, b) => {
      // Garantir que completedDate existe antes de usar toMillis()
      if (a.completedDate && b.completedDate) {
        return b.completedDate.toMillis() - a.completedDate.toMillis();
      }
      return 0;
    });
};

/**
 * Lists all overdue simulated exam assignments for a mentorship
 */
export const getOverdueSimulatedExams = async (mentorshipId: string): Promise<FirebaseMentorshipSimulatedExam[]> => {
  const now = Timestamp.now();
  
  // Firebase doesn't support complex queries like "where completedDate is null AND dueDate < now"
  // So we'll fetch all pending assignments and filter them in memory
  const pendingExams = await getPendingSimulatedExams(mentorshipId);
  
  return pendingExams.filter(exam => 
    exam.dueDate !== null && 
    exam.dueDate !== undefined && 
    exam.dueDate.toMillis() < now.toMillis()
  );
};

/**
 * Marks a simulated exam assignment as completed
 */
export const completeSimulatedExam = async (
  id: string, 
  score: number
): Promise<FirebaseMentorshipSimulatedExam | null> => {
  const assignmentRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await assignmentRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const now = Timestamp.now();
  
  await assignmentRef.update({
    completedDate: now,
    score,
    updatedAt: now,
  });
  
  // Get the updated document
  const updatedDoc = await assignmentRef.get();
  return updatedDoc.data() as FirebaseMentorshipSimulatedExam;
};