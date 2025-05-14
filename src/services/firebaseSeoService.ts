import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Definição de tipos para SEO
export interface FirebaseSeoMetadata {
  id: string;
  path: string;
  title: string;
  description: string;
  keywords?: string[] | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType?: string | null;
  twitterCard?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  noIndex?: boolean | null;
  noFollow?: boolean | null;
  structuredData?: Record<string, any> | null;
  priority?: number | null;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" | null;
  lastModified: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseSeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302 | 307 | 308;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const SEO_METADATA_COLLECTION = "seoMetadata";
const SEO_REDIRECTS_COLLECTION = "seoRedirects";

/**
 * Cria ou atualiza metadados de SEO para um caminho.
 */
export const setSeoMetadata = async (
  path: string,
  metadata: Omit<FirebaseSeoMetadata, "id" | "path" | "lastModified" | "createdAt" | "updatedAt">
): Promise<FirebaseSeoMetadata> => {
  try {
    // Normalizar o caminho
    const normalizedPath = normalizePath(path);
    
    // Verificar se já existem metadados para este caminho
    const existingMetadata = await getSeoMetadataByPath(normalizedPath);
    const now = Timestamp.now();
    
    if (existingMetadata) {
      // Atualizar metadados existentes
      const metadataRef = db.collection(SEO_METADATA_COLLECTION).doc(existingMetadata.id);
      
      const updatedMetadata: FirebaseSeoMetadata = {
        ...existingMetadata,
        ...metadata,
        lastModified: now,
        updatedAt: now
      };
      
      await metadataRef.update(updatedMetadata);
      console.log(`Metadados de SEO para o caminho '${normalizedPath}' atualizados com sucesso.`);
      
      return updatedMetadata;
    } else {
      // Criar novos metadados
      const metadataRef = db.collection(SEO_METADATA_COLLECTION).doc();
      
      const newMetadata: FirebaseSeoMetadata = {
        id: metadataRef.id,
        path: normalizedPath,
        ...metadata,
        lastModified: now,
        createdAt: now,
        updatedAt: now
      };
      
      await metadataRef.set(newMetadata);
      console.log(`Metadados de SEO para o caminho '${normalizedPath}' criados com sucesso.`);
      
      return newMetadata;
    }
  } catch (error) {
    console.error(`Erro ao definir metadados de SEO para o caminho '${path}':`, error);
    throw error;
  }
};

/**
 * Normaliza um caminho para garantir consistência.
 */
const normalizePath = (path: string): string => {
  // Remover barras duplicadas
  let normalizedPath = path.replace(/\/+/g, '/');
  
  // Garantir que o caminho comece com uma barra
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  
  // Remover a barra final, exceto para o caminho raiz
  if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  return normalizedPath;
};

/**
 * Busca metadados de SEO pelo ID.
 */
export const getSeoMetadataById = async (metadataId: string): Promise<FirebaseSeoMetadata | null> => {
  const docRef = db.collection(SEO_METADATA_COLLECTION).doc(metadataId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseSeoMetadata;
  }
  console.warn(`Metadados de SEO (ID: ${metadataId}) não encontrados.`);
  return null;
};

/**
 * Busca metadados de SEO por caminho.
 */
export const getSeoMetadataByPath = async (path: string): Promise<FirebaseSeoMetadata | null> => {
  try {
    // Normalizar o caminho
    const normalizedPath = normalizePath(path);
    
    const snapshot = await db.collection(SEO_METADATA_COLLECTION)
      .where("path", "==", normalizedPath)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseSeoMetadata;
  } catch (error) {
    console.error(`Erro ao buscar metadados de SEO para o caminho '${path}':`, error);
    throw error;
  }
};

/**
 * Busca metadados de SEO com opções de filtro.
 */
export const getSeoMetadata = async (
  options: {
    keyword?: string;
    noIndex?: boolean;
    noFollow?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'path' | 'lastModified' | 'priority';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ metadata: FirebaseSeoMetadata[]; total: number }> => {
  try {
    let query = db.collection(SEO_METADATA_COLLECTION);
    
    // Aplicar filtros
    if (options.noIndex !== undefined) {
      query = query.where("noIndex", "==", options.noIndex);
    }
    
    if (options.noFollow !== undefined) {
      query = query.where("noFollow", "==", options.noFollow);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'path';
    const orderDirection = options.orderDirection || 'asc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let metadata: FirebaseSeoMetadata[] = [];
    snapshot.forEach(doc => {
      metadata.push(doc.data() as FirebaseSeoMetadata);
    });
    
    // Filtrar por palavra-chave (client-side)
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      metadata = metadata.filter(meta => 
        meta.path.toLowerCase().includes(keyword) ||
        meta.title.toLowerCase().includes(keyword) ||
        meta.description.toLowerCase().includes(keyword) ||
        (meta.keywords && meta.keywords.some(k => k.toLowerCase().includes(keyword)))
      );
    }
    
    return { metadata, total };
  } catch (error) {
    console.error(`Erro ao buscar metadados de SEO:`, error);
    throw error;
  }
};

/**
 * Exclui metadados de SEO.
 */
export const deleteSeoMetadata = async (metadataId: string): Promise<void> => {
  const metadataRef = db.collection(SEO_METADATA_COLLECTION).doc(metadataId);
  try {
    await metadataRef.delete();
    console.log(`Metadados de SEO (ID: ${metadataId}) excluídos com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir metadados de SEO (ID: ${metadataId}):`, error);
    throw error;
  }
};

/**
 * Cria ou atualiza um redirecionamento de SEO.
 */
export const setSeoRedirect = async (
  fromPath: string,
  toPath: string,
  statusCode: 301 | 302 | 307 | 308 = 301,
  isActive: boolean = true
): Promise<FirebaseSeoRedirect> => {
  try {
    // Normalizar os caminhos
    const normalizedFromPath = normalizePath(fromPath);
    const normalizedToPath = normalizePath(toPath);
    
    // Verificar se já existe um redirecionamento para este caminho
    const existingRedirect = await getSeoRedirectByFromPath(normalizedFromPath);
    const now = Timestamp.now();
    
    if (existingRedirect) {
      // Atualizar redirecionamento existente
      const redirectRef = db.collection(SEO_REDIRECTS_COLLECTION).doc(existingRedirect.id);
      
      const updatedRedirect: FirebaseSeoRedirect = {
        ...existingRedirect,
        toPath: normalizedToPath,
        statusCode,
        isActive,
        updatedAt: now
      };
      
      await redirectRef.update(updatedRedirect);
      console.log(`Redirecionamento de SEO de '${normalizedFromPath}' para '${normalizedToPath}' atualizado com sucesso.`);
      
      return updatedRedirect;
    } else {
      // Criar novo redirecionamento
      const redirectRef = db.collection(SEO_REDIRECTS_COLLECTION).doc();
      
      const newRedirect: FirebaseSeoRedirect = {
        id: redirectRef.id,
        fromPath: normalizedFromPath,
        toPath: normalizedToPath,
        statusCode,
        isActive,
        createdAt: now,
        updatedAt: now
      };
      
      await redirectRef.set(newRedirect);
      console.log(`Redirecionamento de SEO de '${normalizedFromPath}' para '${normalizedToPath}' criado com sucesso.`);
      
      return newRedirect;
    }
  } catch (error) {
    console.error(`Erro ao definir redirecionamento de SEO de '${fromPath}' para '${toPath}':`, error);
    throw error;
  }
};

/**
 * Busca um redirecionamento de SEO pelo ID.
 */
export const getSeoRedirectById = async (redirectId: string): Promise<FirebaseSeoRedirect | null> => {
  const docRef = db.collection(SEO_REDIRECTS_COLLECTION).doc(redirectId);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    return docSnap.data() as FirebaseSeoRedirect;
  }
  console.warn(`Redirecionamento de SEO (ID: ${redirectId}) não encontrado.`);
  return null;
};

/**
 * Busca um redirecionamento de SEO pelo caminho de origem.
 */
export const getSeoRedirectByFromPath = async (fromPath: string): Promise<FirebaseSeoRedirect | null> => {
  try {
    // Normalizar o caminho
    const normalizedFromPath = normalizePath(fromPath);
    
    const snapshot = await db.collection(SEO_REDIRECTS_COLLECTION)
      .where("fromPath", "==", normalizedFromPath)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as FirebaseSeoRedirect;
  } catch (error) {
    console.error(`Erro ao buscar redirecionamento de SEO para o caminho '${fromPath}':`, error);
    throw error;
  }
};

/**
 * Busca redirecionamentos de SEO com opções de filtro.
 */
export const getSeoRedirects = async (
  options: {
    isActive?: boolean;
    statusCode?: 301 | 302 | 307 | 308;
    searchTerm?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'fromPath' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<{ redirects: FirebaseSeoRedirect[]; total: number }> => {
  try {
    let query = db.collection(SEO_REDIRECTS_COLLECTION);
    
    // Aplicar filtros
    if (options.isActive !== undefined) {
      query = query.where("isActive", "==", options.isActive);
    }
    
    if (options.statusCode) {
      query = query.where("statusCode", "==", options.statusCode);
    }
    
    // Contar o total antes de aplicar paginação
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // Aplicar ordenação
    const orderBy = options.orderBy || 'fromPath';
    const orderDirection = options.orderDirection || 'asc';
    query = query.orderBy(orderBy, orderDirection);
    
    // Aplicar paginação
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    
    let redirects: FirebaseSeoRedirect[] = [];
    snapshot.forEach(doc => {
      redirects.push(doc.data() as FirebaseSeoRedirect);
    });
    
    // Filtrar por termo de pesquisa (client-side)
    if (options.searchTerm) {
      const searchTerm = options.searchTerm.toLowerCase();
      redirects = redirects.filter(redirect => 
        redirect.fromPath.toLowerCase().includes(searchTerm) ||
        redirect.toPath.toLowerCase().includes(searchTerm)
      );
    }
    
    return { redirects, total };
  } catch (error) {
    console.error(`Erro ao buscar redirecionamentos de SEO:`, error);
    throw error;
  }
};

/**
 * Exclui um redirecionamento de SEO.
 */
export const deleteSeoRedirect = async (redirectId: string): Promise<void> => {
  const redirectRef = db.collection(SEO_REDIRECTS_COLLECTION).doc(redirectId);
  try {
    await redirectRef.delete();
    console.log(`Redirecionamento de SEO (ID: ${redirectId}) excluído com sucesso.`);
  } catch (error) {
    console.error(`Erro ao excluir redirecionamento de SEO (ID: ${redirectId}):`, error);
    throw error;
  }
};

/**
 * Gera um sitemap XML a partir dos metadados de SEO.
 */
export const generateSitemap = async (baseUrl: string): Promise<string> => {
  try {
    // Buscar todos os metadados de SEO que não estão marcados como noIndex
    const snapshot = await db.collection(SEO_METADATA_COLLECTION)
      .where("noIndex", "!=", true)
      .get();
    
    // Iniciar o XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Adicionar cada URL
    snapshot.forEach(doc => {
      const metadata = doc.data() as FirebaseSeoMetadata;
      
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${metadata.path}</loc>\n`;
      xml += `    <lastmod>${metadata.lastModified.toDate().toISOString()}</loc>\n`;
      
      if (metadata.changeFrequency) {
        xml += `    <changefreq>${metadata.changeFrequency}</changefreq>\n`;
      }
      
      if (metadata.priority !== null && metadata.priority !== undefined) {
        xml += `    <priority>${metadata.priority}</priority>\n`;
      }
      
      xml += '  </url>\n';
    });
    
    // Fechar o XML
    xml += '</urlset>';
    
    return xml;
  } catch (error) {
    console.error(`Erro ao gerar sitemap:`, error);
    throw error;
  }
};

/**
 * Gera um arquivo robots.txt.
 */
export const generateRobotsTxt = async (
  baseUrl: string,
  options: {
    allowAll?: boolean;
    disallowPaths?: string[];
    sitemapPath?: string;
    userAgents?: Array<{ name: string; allow?: string[]; disallow?: string[] }>;
  } = {}
): Promise<string> => {
  try {
    let robotsTxt = '';
    
    // Adicionar regras para user-agents específicos
    if (options.userAgents && options.userAgents.length > 0) {
      for (const agent of options.userAgents) {
        robotsTxt += `User-agent: ${agent.name}\n`;
        
        if (agent.allow && agent.allow.length > 0) {
          for (const path of agent.allow) {
            robotsTxt += `Allow: ${path}\n`;
          }
        }
        
        if (agent.disallow && agent.disallow.length > 0) {
          for (const path of agent.disallow) {
            robotsTxt += `Disallow: ${path}\n`;
          }
        }
        
        robotsTxt += '\n';
      }
    } else {
      // Regra padrão para todos os user-agents
      robotsTxt += 'User-agent: *\n';
      
      if (options.allowAll) {
        robotsTxt += 'Allow: /\n';
      } else if (options.disallowPaths && options.disallowPaths.length > 0) {
        for (const path of options.disallowPaths) {
          robotsTxt += `Disallow: ${path}\n`;
        }
      }
      
      robotsTxt += '\n';
    }
    
    // Adicionar caminho do sitemap
    if (options.sitemapPath) {
      robotsTxt += `Sitemap: ${baseUrl}${options.sitemapPath}\n`;
    }
    
    return robotsTxt;
  } catch (error) {
    console.error(`Erro ao gerar robots.txt:`, error);
    throw error;
  }
};