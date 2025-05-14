import admin, { firestore } from '../config/firebaseAdmin';
import { FirebaseMentorshipResource, FirebaseResourceType } from '../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = firestore;

const COLLECTION_NAME = 'mentorship_resources';

/**
 * Creates a new mentorship resource
 */
export const createMentorshipResource = async (
  mentorshipId: string,
  addedByUserId: string,
  title: string,
  type: FirebaseResourceType,
  url: string,
  description?: string | null,
): Promise<FirebaseMentorshipResource> => {
  // Validate inputs
  if (title.trim() === '') {
    throw new Error('Resource title cannot be empty.');
  }

  if (url.trim() === '') {
    throw new Error('Resource URL cannot be empty.');
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    throw new Error('Invalid URL format.');
  }

  // Check if mentorship exists
  const mentorshipDoc = await db.collection('mentorships').doc(mentorshipId).get();
  if (!mentorshipDoc.exists) {
    throw new Error(`Mentorship with ID ${mentorshipId} does not exist.`);
  }

  // Check if user exists
  const userDoc = await db.collection('users').doc(addedByUserId).get();
  if (!userDoc.exists) {
    throw new Error(`User with ID ${addedByUserId} does not exist.`);
  }

  const now = Timestamp.now();
  const id = uuidv4();

  const resource: FirebaseMentorshipResource = {
    id,
    mentorshipId,
    addedByUserId,
    title,
    type,
    url,
    description: description || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).doc(id).set(resource);
  return resource;
};

/**
 * Retrieves a mentorship resource by its ID
 */
export const getMentorshipResource = async (id: string): Promise<FirebaseMentorshipResource | null> => {
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as FirebaseMentorshipResource;
};

/**
 * Updates a mentorship resource with new data
 */
export const updateMentorshipResource = async (
  id: string,
  data: Partial<Omit<FirebaseMentorshipResource, 'id' | 'mentorshipId' | 'addedByUserId' | 'createdAt' | 'updatedAt'>>
): Promise<FirebaseMentorshipResource | null> => {
  const resourceRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await resourceRef.get();
  
  if (!doc.exists) {
    return null;
  }

  // Validate updates
  if (data.title !== undefined && data.title.trim() === '') {
    throw new Error('Resource title cannot be empty.');
  }

  if (data.url !== undefined) {
    if (data.url.trim() === '') {
      throw new Error('Resource URL cannot be empty.');
    }

    // Basic URL validation
    try {
      new URL(data.url);
    } catch (error) {
      throw new Error('Invalid URL format.');
    }
  }

  const updateData = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  await resourceRef.update(updateData);
  
  // Get the updated document
  const updatedDoc = await resourceRef.get();
  return updatedDoc.data() as FirebaseMentorshipResource;
};

/**
 * Deletes a mentorship resource by its ID
 */
export const deleteMentorshipResource = async (id: string): Promise<boolean> => {
  const resourceRef = db.collection(COLLECTION_NAME).doc(id);
  const doc = await resourceRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await resourceRef.delete();
  return true;
};

/**
 * Lists all resources for a mentorship
 */
export const getResourcesByMentorship = async (mentorshipId: string): Promise<FirebaseMentorshipResource[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const resources = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipResource);
  return resources.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all resources added by a user
 */
export const getResourcesByUser = async (userId: string): Promise<FirebaseMentorshipResource[]> => {
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('addedByUserId', '==', userId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Ordenar manualmente
  const resources = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipResource);
  return resources.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Lists all resources of a specific type for a mentorship
 */
export const getResourcesByType = async (
  mentorshipId: string, 
  type: FirebaseResourceType
): Promise<FirebaseMentorshipResource[]> => {
  // Primeiro, obter todos os recursos para este mentorship
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    // .orderBy('createdAt', 'desc') // Comentado para evitar erro de índice
    .get();
  
  // Filtrar manualmente por tipo e ordenar
  const resources = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipResource);
  return resources
    .filter(resource => resource.type === type)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
};

/**
 * Searches for resources by title or description
 */
export const searchResources = async (
  mentorshipId: string, 
  searchTerm: string
): Promise<FirebaseMentorshipResource[]> => {
  // Firebase doesn't support text search directly, so we'll fetch all resources
  // for the mentorship and filter them in memory
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('mentorshipId', '==', mentorshipId)
    .get();
  
  const resources = snapshot.docs.map(doc => doc.data() as FirebaseMentorshipResource);
  
  // Filter resources that contain the search term in title or description
  return resources.filter(resource => {
    const titleMatch = resource.title.toLowerCase().includes(searchTerm.toLowerCase());
    const descriptionMatch = resource.description 
      ? resource.description.toLowerCase().includes(searchTerm.toLowerCase()) 
      : false;
    
    return titleMatch || descriptionMatch;
  });
};