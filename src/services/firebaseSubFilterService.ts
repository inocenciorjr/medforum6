import { firestore } from "../config/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { FirebaseSubFilter, FirebaseFilterCategory, FirebaseFilter, FirebaseSubFilterStatus } from "../types/firebaseTypes"; // Changed FirebaseFilterStatus to FirebaseSubFilterStatus
import { getFilterById as getFilterByIdService } from "./firebaseFilterService";

const SUBFILTERS_COLLECTION = "subFilters";
const FILTERS_COLLECTION = "filters";

export const createSubFilter = async (data: {
  filterId: string;
  name: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  parentId?: string | null; // Added parentId
  status?: FirebaseSubFilterStatus; // Added status
}): Promise<FirebaseSubFilter> => {
  if (!data.filterId) throw new Error("O ID do filtro pai é obrigatório para criar um subfiltro.");
  if (!data.name) throw new Error("O nome do subfiltro é obrigatório.");

  const filterDocRef = firestore.collection(FILTERS_COLLECTION).doc(data.filterId);
  const filterDoc = await filterDocRef.get();
  if (!filterDoc.exists) {
    throw new Error(`Filtro pai com ID "${data.filterId}" não encontrado ao tentar criar subfiltro.`);
  }

  const newSubFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc();
  const now = Timestamp.now();

  const newSubFilter: FirebaseSubFilter = {
    id: newSubFilterRef.id,
    filterId: data.filterId,
    name: data.name,
    description: data.description || "",
    order: data.order === undefined ? 0 : data.order,
    isActive: data.isActive === undefined ? true : data.isActive,
    parentId: data.parentId !== undefined ? data.parentId : null, // Persist parentId
    status: data.status || FirebaseSubFilterStatus.ACTIVE, // Persist status, default to ACTIVE
    createdAt: now,
    updatedAt: now,
  };

  await firestore.runTransaction(async (transaction) => {
    transaction.set(newSubFilterRef, newSubFilter);
    transaction.update(filterDocRef, {
      subFilterCount: FieldValue.increment(1),
      updatedAt: now,
    });
  });

  return newSubFilter;
};

export const getSubFilterById = async (subFilterId: string): Promise<FirebaseSubFilter | null> => {
  const docRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as FirebaseSubFilter) : null;
};

export const updateSubFilter = async (
  subFilterId: string,
  updateData: Partial<Omit<FirebaseSubFilter, "id" | "createdAt" | "filterId">>
): Promise<FirebaseSubFilter | null> => {
  const subFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const docSnap = await subFilterRef.get();

  if (!docSnap.exists) {
    throw new Error(`Subfiltro com ID "${subFilterId}" não encontrado para atualização.`);
  }

  const dataToUpdate = { ...updateData, updatedAt: Timestamp.now() };
  await subFilterRef.update(dataToUpdate);

  const updatedDoc = await subFilterRef.get();
  return updatedDoc.exists ? (updatedDoc.data() as FirebaseSubFilter) : null;
};

export const deleteSubFilter = async (subFilterId: string): Promise<void> => {
  const subFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const subFilterDoc = await subFilterRef.get();

  if (!subFilterDoc.exists) {
    console.warn(`Subfiltro com ID "${subFilterId}" não encontrado para deleção.`);
    return;
  }

  const subFilterData = subFilterDoc.data() as FirebaseSubFilter;
  const filterDocRef = firestore.collection(FILTERS_COLLECTION).doc(subFilterData.filterId);

  await firestore.runTransaction(async (transaction) => {
    // Primeiro fazemos todas as leituras
    const parentFilterDoc = await transaction.get(filterDocRef);
    
    // Depois fazemos todas as escritas
    transaction.delete(subFilterRef);
    if (parentFilterDoc.exists) {
      transaction.update(filterDocRef, {
        subFilterCount: FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });
    }
  });
};

export const listSubFiltersByFilterId = async (
  filterId: string,
  options?: {
    isActive?: boolean;
    sortBy?: "name" | "order" | "createdAt" | "updatedAt";
    sortDirection?: "asc" | "desc";
    limit?: number;
    startAfter?: FirebaseSubFilter;
  }
): Promise<{ subFilters: FirebaseSubFilter[]; nextPageStartAfter?: FirebaseSubFilter }> => {
  if (!filterId) throw new Error("O ID do filtro pai é obrigatório para listar subfiltros.");

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = firestore
    .collection(SUBFILTERS_COLLECTION)
    .where("filterId", "==", filterId);

  if (options?.isActive !== undefined) {
    query = query.where("isActive", "==", options.isActive);
  }

  const sortBy = options?.sortBy || "order";
  const sortDirection = options?.sortDirection || "asc";
  query = query.orderBy(sortBy, sortDirection);
  
  if (sortBy !== "name") {
    query = query.orderBy("name", "asc"); 
  }

  if (options?.startAfter) {
    const startAfterDoc = await firestore.collection(SUBFILTERS_COLLECTION).doc(options.startAfter.id).get();
    if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    } else {
        console.warn(`Documento startAfter com ID ${options.startAfter.id} não encontrado para paginação.`);
    }
  }

  const limit = options?.limit || 20;
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const subFilters = snapshot.docs.map(doc => doc.data() as FirebaseSubFilter);

  let nextPageStartAfter: FirebaseSubFilter | undefined = undefined;
  if (subFilters.length > limit) {
    nextPageStartAfter = subFilters.pop(); 
  }

  return { subFilters, nextPageStartAfter };
};

export const getParentFilterCategory = async (subFilterId: string): Promise<FirebaseFilterCategory | null> => {
  const subFilter = await getSubFilterById(subFilterId);
  if (subFilter && subFilter.filterId) {
    const parentFilter = await getFilterByIdService(subFilter.filterId);
    return parentFilter ? parentFilter.category : null;
  }
  return null;
};

