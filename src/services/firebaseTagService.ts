import { Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { FirebaseTag, FirebaseTagScope } from "../types/firebaseTypes";

// Função para inicializar o serviço com a instância do Firestore
let db: Firestore;
export const initTagService = (firestoreInstance: Firestore) => {
  db = firestoreInstance;
};

// Função auxiliar para gerar slugs (semelhante à usada em CategoryService)
const generateSlug = (name: string): string => {
  if (!name) return "";
  return name
    .toString()
    .normalize("NFKD") // Normaliza para decompor caracteres acentuados
    .replace(/[\u0300-\u036f]/g, "") // Remove diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Substitui espaços por hífens
    .replace(/[^\w-]+/g, "") // Remove caracteres não alfanuméricos (exceto hífens)
    .replace(/--+/g, "-"); // Remove múltiplos hífens
};

/**
 * Cria uma nova tag no Firestore.
 * @param tagData Dados para a nova tag.
 * @returns A tag criada.
 */
export const createTag = async (tagData: Omit<FirebaseTag, "id" | "slug" | "createdAt" | "updatedAt" | "usageCount" | "isActive"> & { slug?: string, isActive?: boolean, usageCount?: number, description?: string, relatedTags?: string[] | null, isFeatured?: boolean, color?: string, icon?: string, scope?: FirebaseTagScope }): Promise<FirebaseTag> => {
  if (!db) throw new Error("TagService não inicializado. Chame initTagService primeiro.");
  if (!tagData.name) {
    throw new Error("O nome da tag é obrigatório.");
  }

  const slug = tagData.slug ? generateSlug(tagData.slug) : generateSlug(tagData.name);

  // Verifica unicidade do nome
  const nameQuery = await db.collection("tags").where("name", "==", tagData.name).limit(1).get();
  if (!nameQuery.empty) {
    throw new Error(`Uma tag com o nome "${tagData.name}" já existe.`);
  }

  // Verifica unicidade do slug
  const slugQuery = await db.collection("tags").where("slug", "==", slug).limit(1).get();
  if (!slugQuery.empty) {
    throw new Error(`Uma tag com o slug "${slug}" já existe.`);
  }

  const newTagRef = db.collection("tags").doc();
  const now = Timestamp.now();

  const newTag: FirebaseTag = {
    id: newTagRef.id,
    name: tagData.name,
    slug: slug,
    description: tagData.description || "",
    isActive: typeof tagData.isActive === 'boolean' ? tagData.isActive : true,
    usageCount: typeof tagData.usageCount === 'number' ? tagData.usageCount : 0,
    relatedTags: tagData.relatedTags || null,
    isFeatured: typeof tagData.isFeatured === 'boolean' ? tagData.isFeatured : false,
    color: tagData.color || "",
    icon: tagData.icon || "",
    scope: tagData.scope || FirebaseTagScope.ALL, // Default scope
    createdAt: now,
    updatedAt: now,
  };

  await newTagRef.set(newTag);
  return newTag;
};

/**
 * Busca uma tag pelo ID.
 * @param id ID da tag.
 * @returns A tag encontrada ou null.
 */
export const getTagById = async (id: string): Promise<FirebaseTag | null> => {
  if (!db) throw new Error("TagService não inicializado.");
  const docRef = db.collection("tags").doc(id);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return docSnap.data() as FirebaseTag;
  }
  return null;
};

/**
 * Busca uma tag pelo slug.
 * @param slug Slug da tag.
 * @returns A tag encontrada ou null.
 */
export const getTagBySlug = async (slug: string): Promise<FirebaseTag | null> => {
  if (!db) throw new Error("TagService não inicializado.");
  const querySnap = await db.collection("tags").where("slug", "==", slug).limit(1).get();
  if (!querySnap.empty) {
    return querySnap.docs[0].data() as FirebaseTag;
  }
  return null;
};

/**
 * Atualiza uma tag existente.
 * @param id ID da tag a ser atualizada.
 * @param updateData Dados para atualizar a tag.
 * @returns A tag atualizada.
 */
export const updateTag = async (id: string, updateData: Partial<Omit<FirebaseTag, "id" | "createdAt" | "updatedAt" | "slug"> & { slug?: string }>): Promise<FirebaseTag> => {
  if (!db) throw new Error("TagService não inicializado.");
  const tagRef = db.collection("tags").doc(id);
  const tagDoc = await tagRef.get();

  if (!tagDoc.exists) {
    throw new Error(`Tag com ID "${id}" não encontrada.`);
  }

  const currentData = tagDoc.data() as FirebaseTag;
  let newSlug = currentData.slug;

  if (updateData.name && updateData.name !== currentData.name && !updateData.slug) {
    newSlug = generateSlug(updateData.name);
  } else if (updateData.slug && updateData.slug !== currentData.slug) {
    newSlug = generateSlug(updateData.slug);
  }

  if (updateData.name && updateData.name !== currentData.name) {
    const nameQuery = await db.collection("tags").where("name", "==", updateData.name).limit(1).get();
    if (!nameQuery.empty && nameQuery.docs[0].id !== id) {
      throw new Error(`Uma tag com o nome "${updateData.name}" já existe.`);
    }
  }

  if (newSlug !== currentData.slug) {
    const slugQuery = await db.collection("tags").where("slug", "==", newSlug).limit(1).get();
    if (!slugQuery.empty && slugQuery.docs[0].id !== id) {
      throw new Error(`Uma tag com o slug "${newSlug}" já existe.`);
    }
  }

  const dataToUpdate: Partial<FirebaseTag> = {
    ...updateData,
    slug: newSlug,
    updatedAt: Timestamp.now(),
  };

  await tagRef.update(dataToUpdate);
  const updatedDoc = await tagRef.get();
  return updatedDoc.data() as FirebaseTag;
};

/**
 * Deleta uma tag.
 * @param id ID da tag a ser deletada.
 */
export const deleteTag = async (id: string): Promise<void> => {
  if (!db) throw new Error("TagService não inicializado.");
  const tagRef = db.collection("tags").doc(id);
  const tagDoc = await tagRef.get();

  if (!tagDoc.exists) {
    throw new Error(`Tag com ID "${id}" não encontrada.`);
  }
  
  await tagRef.delete();
};

/**
 * Lista todas as tags com opções de filtro e paginação.
 */
export const listTags = async (options?: {
  limit?: number;
  startAfter?: FirebaseTag;
  sortBy?: keyof FirebaseTag;
  sortDirection?: "asc" | "desc";
  scope?: FirebaseTagScope | FirebaseTagScope[];
  isActive?: boolean;
  isFeatured?: boolean;
  nameStartsWith?: string;
}): Promise<{ tags: FirebaseTag[]; nextPageStartAfter?: FirebaseTag }> => {
  if (!db) throw new Error("TagService não inicializado.");
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("tags");

  if (options?.isActive !== undefined) {
    query = query.where("isActive", "==", options.isActive);
  }
  if (options?.isFeatured !== undefined) {
    query = query.where("isFeatured", "==", options.isFeatured);
  }
  if (options?.scope) {
    if (Array.isArray(options.scope)) {
      query = query.where("scope", "array-contains-any", options.scope);
    } else {
      query = query.where("scope", "==", options.scope);
    }
  }
  if (options?.nameStartsWith) {
    query = query.where("name", ">=", options.nameStartsWith).where("name", "<=", options.nameStartsWith + '\uf8ff');
  }

  const sortBy = options?.sortBy || "createdAt";
  const sortDirection = options?.sortDirection || "desc";
  query = query.orderBy(sortBy, sortDirection);

  if (options?.startAfter) {
    const startAfterDoc = await db.collection("tags").doc(options.startAfter.id).get();
    if(startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
    }
  }

  const limit = options?.limit || 20;
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const tags = snapshot.docs.map(doc => doc.data() as FirebaseTag);
  
  let nextPageStartAfter: FirebaseTag | undefined = undefined;
  if (tags.length > limit) {
    nextPageStartAfter = tags.pop();
  }

  return { tags, nextPageStartAfter };
};

/**
 * Incrementa o contador de uso de uma tag.
 * @param tagId ID da tag.
 * @param amount Quantidade a incrementar (padrão: 1).
 */
export const incrementTagUsageCount = async (tagId: string, amount: number = 1): Promise<void> => {
  if (!db) throw new Error("TagService não inicializado.");
  const tagRef = db.collection("tags").doc(tagId);
  await tagRef.update({ usageCount: FieldValue.increment(amount), updatedAt: Timestamp.now() });
};

/**
 * Decrementa o contador de uso de uma tag.
 * @param tagId ID da tag.
 * @param amount Quantidade a decrementar (padrão: 1).
 */
export const decrementTagUsageCount = async (tagId: string, amount: number = 1): Promise<void> => {
  if (!db) throw new Error("TagService não inicializado.");
  const tagRef = db.collection("tags").doc(tagId);
  const currentTag = await getTagById(tagId);
  const currentUsageCount = currentTag?.usageCount || 0;
  if (currentUsageCount - amount < 0) {
     await tagRef.update({ usageCount: 0, updatedAt: Timestamp.now() });
  } else {
     await tagRef.update({ usageCount: FieldValue.increment(-amount), updatedAt: Timestamp.now() });
  }
};

