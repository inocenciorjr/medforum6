import { firestore as db } from "../config/firebaseAdmin";
import { FirebaseCategory, FirebaseCategoryStatus, FirebaseFilterType } from "../types/firebaseTypes";
import { Timestamp } from "firebase-admin/firestore";

const CATEGORIES_COLLECTION = "categories";

// Helper to generate slug (similar to Sequelize hook)
const generateSlug = (name: string): string => {
  if (!name) return "";
  return name
    .toString()
    .normalize("NFKD") // Normalize to decompose combined graphemes (e.g., "í" to "i" + "´")
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w-]+/g, "") // Remove all non-word chars (alphanumeric & underscore) except hyphens
    .replace(/--+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+/, "") // Trim hyphen from start of text
    .replace(/-+$/, ""); // Trim hyphen from end of text
};

/**
 * Creates a new category in Firestore.
 * Includes logic for slug generation and uniqueness checks for name+parentId and slug.
 */
export const createCategory = async (
  // Corrected: Added slug?: string to the input type definition
  data: Partial<Omit<FirebaseCategory, "id" | "createdAt" | "updatedAt" | "slug">> & { name: string, filterType: FirebaseFilterType, slug?: string }
): Promise<FirebaseCategory> => {
  const now = Timestamp.now();
  
  // Logic remains the same: use provided slug or generate it
  const slug = data.slug || generateSlug(data.name);
  const parentId = data.parentId === undefined ? null : data.parentId;

  // Check for slug uniqueness
  const slugQuery = db.collection(CATEGORIES_COLLECTION).where("slug", "==", slug);
  const slugSnapshot = await slugQuery.get();
  if (!slugSnapshot.empty) {
    throw new Error(`Slug '${slug}' already exists.`);
  }

  // Check for name + parentId uniqueness
  let nameQuery = db.collection(CATEGORIES_COLLECTION).where("name", "==", data.name);
  if (parentId === null) {
    nameQuery = nameQuery.where("parentId", "==", null);
  } else {
    nameQuery = nameQuery.where("parentId", "==", parentId);
  }
  const nameSnapshot = await nameQuery.get();
  if (!nameSnapshot.empty) {
    throw new Error(`Category name '${data.name}' already exists under the specified parent.`);
  }

  const categoryRef = db.collection(CATEGORIES_COLLECTION).doc();
  
  const newCategoryData: Omit<FirebaseCategory, "id" | "createdAt" | "updatedAt"> = {
    name: data.name,
    slug: slug,
    description: data.description || "", 
    parentId: parentId,
    isActive: data.isActive !== undefined ? data.isActive : true,
    displayOrder: data.displayOrder || 0,
    status: data.status || FirebaseCategoryStatus.ACTIVE,
    filterType: data.filterType, 
  };

  const newCategory: FirebaseCategory = {
    id: categoryRef.id,
    ...newCategoryData,
    createdAt: now,
    updatedAt: now,
  };

  await categoryRef.set(newCategory);
  return newCategory;
};

export const getCategoryById = async (categoryId: string): Promise<FirebaseCategory | null> => {
  const doc = await db.collection(CATEGORIES_COLLECTION).doc(categoryId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as FirebaseCategory;
};

export const getCategoryBySlug = async (slug: string): Promise<FirebaseCategory | null> => {
  const snapshot = await db.collection(CATEGORIES_COLLECTION).where("slug", "==", slug).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0].data() as FirebaseCategory;
};

export const updateCategory = async (
  categoryId: string,
  updateData: Partial<Omit<FirebaseCategory, "id" | "createdAt" | "updatedAt">>
): Promise<FirebaseCategory> => {
  const categoryRef = db.collection(CATEGORIES_COLLECTION).doc(categoryId);
  const categoryDoc = await categoryRef.get();

  if (!categoryDoc.exists) {
    throw new Error(`Category with ID ${categoryId} not found.`);
  }

  const existingCategory = categoryDoc.data() as FirebaseCategory;
  const dataToUpdateForFirestore: Partial<FirebaseCategory> = {}; 

  let newSlug = existingCategory.slug;
  if (updateData.name && updateData.slug === undefined) {
    newSlug = generateSlug(updateData.name);
  } else if (updateData.slug !== undefined) {
    newSlug = updateData.slug;
  }

  if (newSlug !== existingCategory.slug) {
    const slugQuery = db.collection(CATEGORIES_COLLECTION).where("slug", "==", newSlug);
    const slugSnapshot = await slugQuery.get();
    if (!slugSnapshot.empty) {
      let duplicateFound = false;
      slugSnapshot.forEach(doc => {
        if (doc.id !== categoryId) { duplicateFound = true; }
      });
      if (duplicateFound) {
        const nameForErrorMessage = updateData.name || existingCategory.name;
        throw new Error(`Generated slug '${newSlug}' from name '${nameForErrorMessage}' already exists for another category.`); 
      }
    }
  }
  if (updateData.slug !== undefined || (updateData.name && updateData.slug === undefined)){
      dataToUpdateForFirestore.slug = newSlug;
  }

  const finalName = updateData.name !== undefined ? updateData.name : existingCategory.name;
  let finalParentId: string | null | undefined = existingCategory.parentId;
  if (updateData.hasOwnProperty("parentId")) {
    finalParentId = updateData.parentId;
  }
  
  const nameChanged = updateData.name !== undefined && updateData.name !== existingCategory.name;
  const parentIdChanged = updateData.hasOwnProperty("parentId") && updateData.parentId !== existingCategory.parentId;

  if (nameChanged || parentIdChanged) {
    let nameQuery = db.collection(CATEGORIES_COLLECTION).where("name", "==", finalName);
    if (finalParentId === null || finalParentId === undefined) {
      nameQuery = nameQuery.where("parentId", "==", null);
    } else {
      nameQuery = nameQuery.where("parentId", "==", finalParentId);
    }
    const nameSnapshot = await nameQuery.get();
    if (!nameSnapshot.empty) {
      let duplicateFound = false;
      nameSnapshot.forEach(doc => {
        if (doc.id !== categoryId) { duplicateFound = true; }
      });
      if (duplicateFound) {
        throw new Error(`Category name '${finalName}' already exists under the specified parent.`);
      }
    }
  }

  if (updateData.name !== undefined) dataToUpdateForFirestore.name = updateData.name;
  if (updateData.description !== undefined) dataToUpdateForFirestore.description = updateData.description || ""; 
  if (updateData.hasOwnProperty("parentId")) dataToUpdateForFirestore.parentId = updateData.parentId;
  if (updateData.isActive !== undefined) dataToUpdateForFirestore.isActive = updateData.isActive;
  if (updateData.displayOrder !== undefined) dataToUpdateForFirestore.displayOrder = updateData.displayOrder;
  if (updateData.status !== undefined) dataToUpdateForFirestore.status = updateData.status;
  if (updateData.filterType !== undefined) dataToUpdateForFirestore.filterType = updateData.filterType;
  
  if (Object.keys(dataToUpdateForFirestore).length === 0) {
    return existingCategory; 
  }
  
  dataToUpdateForFirestore.updatedAt = Timestamp.now();

  await categoryRef.update(dataToUpdateForFirestore);
  const updatedDoc = await categoryRef.get();
  return updatedDoc.data() as FirebaseCategory;
};

export const deleteCategory = async (id: string): Promise<boolean> => {
  const categoryRef = db.collection(CATEGORIES_COLLECTION).doc(id);
  const doc = await categoryRef.get();
  if (!doc.exists) {
    console.warn(`Category ${id} not found for deletion, but proceeding as if successful for cleanup.`);
    return true; 
  }
  await categoryRef.delete();
  return true;
};

export const getAllCategories = async (filters?: { isActive?: boolean; parentId?: string | null }): Promise<FirebaseCategory[]> => {
  let query: FirebaseFirestore.Query = db.collection(CATEGORIES_COLLECTION);
  if (filters) {
    if (filters.isActive !== undefined) {
      query = query.where("isActive", "==", filters.isActive);
    }
    if (filters.hasOwnProperty("parentId")) { 
      query = query.where("parentId", "==", filters.parentId);
    }
  }
  query = query.orderBy("displayOrder", "asc").orderBy("name", "asc");
  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data() as FirebaseCategory);
};

export const getChildCategories = async (parentId: string): Promise<FirebaseCategory[]> => {
  const snapshot = await db.collection(CATEGORIES_COLLECTION)
    .where("parentId", "==", parentId)
    .orderBy("displayOrder", "asc")
    .orderBy("name", "asc")
    .get();
  return snapshot.docs.map(doc => doc.data() as FirebaseCategory);
};

export const getTopLevelCategories = async (): Promise<FirebaseCategory[]> => {
  const snapshot = await db.collection(CATEGORIES_COLLECTION)
    .where("parentId", "==", null)
    .orderBy("displayOrder", "asc")
    .orderBy("name", "asc")
    .get();
  return snapshot.docs.map(doc => doc.data() as FirebaseCategory);
};

