import { firestore } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { FirebaseFilter, FirebaseSubFilter, FirebaseFilterCategory, FirebaseFilterType, FirebaseFilterStatus } from "../types/firebaseTypes";

export const COLLECTION_NAME = "filters";
const SUBFILTERS_COLLECTION = "subFilters";

export type FirebaseFilterCreatePayload = Omit<FirebaseFilter, "id" | "createdAt" | "updatedAt">;
export type FirebaseSubFilterCreatePayload = Omit<FirebaseSubFilter, "id" | "createdAt" | "updatedAt">;

export const createFilter = async (data: FirebaseFilterCreatePayload): Promise<FirebaseFilter> => {
  if (data.category && !Object.values(FirebaseFilterCategory).includes(data.category)) {
    throw new Error(`Valor inválido para category: ${data.category}. Valores permitidos são: ${Object.values(FirebaseFilterCategory).join(", ")}.`);
  }

  const newFilterRef = firestore.collection(COLLECTION_NAME).doc();
  const now = Timestamp.now();
  const newFilter: FirebaseFilter = {
    id: newFilterRef.id,
    ...data,
    isGlobal: typeof data.isGlobal === 'boolean' ? data.isGlobal : false,
    filterType: data.filterType || FirebaseFilterType.CONTENT,
    status: data.status || FirebaseFilterStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };
  await newFilterRef.set(newFilter);
  return newFilter;
};

export const getFilterById = async (filterId: string): Promise<FirebaseFilter | null> => {
  const docRef = firestore.collection(COLLECTION_NAME).doc(filterId);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as FirebaseFilter) : null;
};

export const listFilters = async (options?: {
  category?: FirebaseFilterCategory;
  isGlobal?: boolean;
  status?: string;
  limit?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}): Promise<FirebaseFilter[]> => {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = firestore.collection(COLLECTION_NAME);

  if (options?.category) {
    query = query.where("category", "==", options.category);
  }
  if (typeof options?.isGlobal === 'boolean') {
    query = query.where("isGlobal", "==", options.isGlobal);
  }
  if (options?.status) {
    query = query.where("status", "==", options.status);
  }
  if (options?.orderBy && options?.orderDirection) {
    query = query.orderBy(options.orderBy, options.orderDirection);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => doc.data() as FirebaseFilter);
};

export const updateFilter = async (filterId: string, updateDataInput: Partial<Omit<FirebaseFilter, "id" | "createdAt" | "updatedAt" | "category">>): Promise<FirebaseFilter | null> => {
  const filterRef = firestore.collection(COLLECTION_NAME).doc(filterId);
  const docSnap = await filterRef.get();

  if (!docSnap.exists) {
    throw new Error(`Filtro com ID "${filterId}" não encontrado.`);
  }

  // Cria uma cópia do objeto de entrada para evitar mutação do original e para manipulação segura.
  const updatePayload = { ...updateDataInput };
  
  // Remove explicitamente a propriedade 'category' do payload de atualização,
  // caso ela tenha sido passada (apesar da tipagem que a proíbe).
  // Isso garante que a categoria do filtro não seja alterada.
  delete (updatePayload as any).category;

  const finalUpdateData = {
    ...updatePayload,
    updatedAt: Timestamp.now()
  };

  await filterRef.update(finalUpdateData);
  const updatedDoc = await filterRef.get();
  return updatedDoc.exists ? (updatedDoc.data() as FirebaseFilter) : null;
};

export const deleteFilter = async (filterId: string): Promise<void> => {
  const filterRef = firestore.collection(COLLECTION_NAME).doc(filterId);
  const docSnap = await filterRef.get();

  if (!docSnap.exists) {
    throw new Error(`Filtro com ID "${filterId}" não encontrado para exclusão.`);
  }

  const subFiltersSnapshot = await firestore.collection(SUBFILTERS_COLLECTION).where("filterId", "==", filterId).get();
  if (!subFiltersSnapshot.empty) {
    const batch = firestore.batch();
    subFiltersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Subfiltros associados ao filtro ${filterId} foram deletados.`);
  }

  await filterRef.delete();
  console.log(`Filtro ${filterId} deletado com sucesso.`);
};

export const createSubFilter = async (data: FirebaseSubFilterCreatePayload): Promise<FirebaseSubFilter> => {
  const newSubFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc();
  const now = Timestamp.now();
  const newSubFilter: FirebaseSubFilter = {
    id: newSubFilterRef.id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await newSubFilterRef.set(newSubFilter);
  return newSubFilter;
};

export const getSubFilterById = async (subFilterId: string): Promise<FirebaseSubFilter | null> => {
  const docRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as FirebaseSubFilter) : null;
};

export const updateSubFilter = async (subFilterId: string, updateData: Partial<Omit<FirebaseSubFilter, "id" | "createdAt" | "updatedAt">>): Promise<FirebaseSubFilter | null> => {
  const subFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const docSnap = await subFilterRef.get();

  if (!docSnap.exists) {
    throw new Error(`Subfiltro com ID "${subFilterId}" não encontrado.`);
  }

  const dataToUpdate = { ...updateData, updatedAt: Timestamp.now() };
  await subFilterRef.update(dataToUpdate);
  const updatedDoc = await subFilterRef.get();
  return updatedDoc.exists ? (updatedDoc.data() as FirebaseSubFilter) : null;
};

export const deleteSubFilter = async (subFilterId: string): Promise<void> => {
  const subFilterRef = firestore.collection(SUBFILTERS_COLLECTION).doc(subFilterId);
  const docSnap = await subFilterRef.get();

  if (!docSnap.exists) {
    console.warn(`Subfiltro com ID "${subFilterId}" não encontrado para deleção.`);
    return;
  }

  await subFilterRef.delete();
};

