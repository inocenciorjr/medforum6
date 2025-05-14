import { firestore as db } from "../config/firebaseAdmin";
import { Timestamp, DocumentSnapshot } from "firebase-admin/firestore";

// Definição de tipos para dispositivos
export interface FirebaseDevice {
  id: string;
  userId: string;
  deviceType: "ios" | "android" | "web" | "desktop";
  deviceModel?: string;
  deviceName?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string | null;
  fcmToken?: string | null;
  lastLoginAt: Timestamp;
  lastActiveAt: Timestamp;
  isActive: boolean;
  metadata?: Record<string, any> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const DEVICES_COLLECTION = "devices";

/**
 * Registra um novo dispositivo ou atualiza um existente.
 */
export const registerDevice = async (
  data: {
    userId: string;
    deviceType: FirebaseDevice["deviceType"];
    deviceModel?: string;
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    pushToken?: string;
    fcmToken?: string;
    metadata?: Record<string, any>;
  }
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    // Verificar se já existe um dispositivo com o mesmo pushToken ou fcmToken
    let existingDeviceId: string | null = null;
    
    if (data.pushToken) {
      const pushTokenSnapshot = await db.collection(DEVICES_COLLECTION)
        .where("pushToken", "==", data.pushToken)
        .limit(1)
        .get();
      
      if (!pushTokenSnapshot.empty) {
        existingDeviceId = pushTokenSnapshot.docs[0].id;
      }
    }
    
    if (!existingDeviceId && data.fcmToken) {
      const fcmTokenSnapshot = await db.collection(DEVICES_COLLECTION)
        .where("fcmToken", "==", data.fcmToken)
        .limit(1)
        .get();
      
      if (!fcmTokenSnapshot.empty) {
        existingDeviceId = fcmTokenSnapshot.docs[0].id;
      }
    }
    
    // Se encontrou um dispositivo existente, atualiza-o
    if (existingDeviceId) {
      const updateData = {
        userId: data.userId,
        deviceType: data.deviceType,
        lastLoginAt: now,
        lastActiveAt: now,
        isActive: true,
        updatedAt: now
      } as Record<string, any>;
      
      // Adicionar campos opcionais se fornecidos
      if (data.deviceModel) updateData.deviceModel = data.deviceModel;
      if (data.deviceName) updateData.deviceName = data.deviceName;
      if (data.osVersion) updateData.osVersion = data.osVersion;
      if (data.appVersion) updateData.appVersion = data.appVersion;
      if (data.pushToken) updateData.pushToken = data.pushToken;
      if (data.fcmToken) updateData.fcmToken = data.fcmToken;
      if (data.metadata) updateData.metadata = data.metadata;
      
      await db.collection(DEVICES_COLLECTION).doc(existingDeviceId).update(updateData);
      
      // Buscar o dispositivo atualizado
      const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(existingDeviceId).get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      } as FirebaseDevice;
    }
    
    // Caso contrário, cria um novo dispositivo
    const deviceData = {
      userId: data.userId,
      deviceType: data.deviceType,
      deviceModel: data.deviceModel || null,
      deviceName: data.deviceName || null,
      osVersion: data.osVersion || null,
      appVersion: data.appVersion || null,
      pushToken: data.pushToken || null,
      fcmToken: data.fcmToken || null,
      lastLoginAt: now,
      lastActiveAt: now,
      isActive: true,
      metadata: data.metadata || null,
      createdAt: now,
      updatedAt: now
    };
    
    const docRef = await db.collection(DEVICES_COLLECTION).add(deviceData);
    
    return {
      id: docRef.id,
      ...deviceData
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao registrar dispositivo:`, error);
    throw error;
  }
};

/**
 * Busca um dispositivo pelo ID.
 */
export const getDeviceById = async (
  id: string
): Promise<FirebaseDevice | null> => {
  try {
    const doc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao buscar dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Busca dispositivos com opções de filtro.
 */
export const getDevices = async (
  options: {
    userId?: string;
    deviceType?: FirebaseDevice["deviceType"];
    isActive?: boolean;
    hasPushToken?: boolean;
    hasFcmToken?: boolean;
    orderBy?: keyof FirebaseDevice;
    orderDirection?: "asc" | "desc";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ devices: FirebaseDevice[]; total: number }> => {
  try {
    // Devido a limitações de índices no Firestore, vamos buscar todos os dispositivos
    // e filtrar manualmente
    const snapshot = await db.collection(DEVICES_COLLECTION).get();
    
    let devices: FirebaseDevice[] = [];
    
    snapshot.forEach((doc: DocumentSnapshot) => {
      const data = doc.data();
      if (!data) return;
      
      const device = {
        id: doc.id,
        ...data
      } as FirebaseDevice;
      
      // Aplicar filtros manualmente
      let includeDevice = true;
      
      if (options.userId && device.userId !== options.userId) {
        includeDevice = false;
      }
      
      if (options.deviceType && device.deviceType !== options.deviceType) {
        includeDevice = false;
      }
      
      if (options.isActive !== undefined && device.isActive !== options.isActive) {
        includeDevice = false;
      }
      
      if (options.hasPushToken && !device.pushToken) {
        includeDevice = false;
      }
      
      if (options.hasFcmToken && !device.fcmToken) {
        includeDevice = false;
      }
      
      if (includeDevice) {
        devices.push(device);
      }
    });
    
    // Ordenar manualmente
    const orderBy = options.orderBy || "lastActiveAt";
    const orderDirection = options.orderDirection || "desc";
    
    devices.sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      if (aValue instanceof Timestamp && bValue instanceof Timestamp) {
        return orderDirection === "asc" 
          ? aValue.toMillis() - bValue.toMillis() 
          : bValue.toMillis() - aValue.toMillis();
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return orderDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return orderDirection === "asc"
          ? (aValue ? 1 : 0) - (bValue ? 1 : 0)
          : (bValue ? 1 : 0) - (aValue ? 1 : 0);
      }
      
      return 0;
    });
    
    const total = devices.length;
    
    // Aplicar paginação manualmente
    if (options.offset) {
      devices = devices.slice(options.offset);
    }
    
    if (options.limit) {
      devices = devices.slice(0, options.limit);
    }
    
    return { devices, total };
  } catch (error) {
    console.error(`Erro ao buscar dispositivos:`, error);
    throw error;
  }
};

/**
 * Atualiza um dispositivo pelo ID.
 */
export const updateDevice = async (
  id: string,
  data: Partial<Omit<FirebaseDevice, "id" | "createdAt" | "updatedAt">>
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    const updateData = {
      ...data,
      updatedAt: now
    };
    
    await db.collection(DEVICES_COLLECTION).doc(id).update(updateData);
    
    // Buscar o dispositivo atualizado
    const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!updatedDoc.exists) {
      throw new Error(`Dispositivo ${id} não encontrado após atualização`);
    }
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao atualizar dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Atualiza o timestamp de última atividade de um dispositivo.
 */
export const updateDeviceLastActive = async (
  id: string
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    await db.collection(DEVICES_COLLECTION).doc(id).update({
      lastActiveAt: now,
      updatedAt: now
    });
    
    // Buscar o dispositivo atualizado
    const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!updatedDoc.exists) {
      throw new Error(`Dispositivo ${id} não encontrado após atualização`);
    }
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao atualizar última atividade do dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Atualiza o token de push de um dispositivo.
 */
export const updateDevicePushToken = async (
  id: string,
  pushToken: string
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    await db.collection(DEVICES_COLLECTION).doc(id).update({
      pushToken,
      updatedAt: now
    });
    
    // Buscar o dispositivo atualizado
    const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!updatedDoc.exists) {
      throw new Error(`Dispositivo ${id} não encontrado após atualização`);
    }
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao atualizar token de push do dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Atualiza o token FCM de um dispositivo.
 */
export const updateDeviceFcmToken = async (
  id: string,
  fcmToken: string
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    await db.collection(DEVICES_COLLECTION).doc(id).update({
      fcmToken,
      updatedAt: now
    });
    
    // Buscar o dispositivo atualizado
    const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!updatedDoc.exists) {
      throw new Error(`Dispositivo ${id} não encontrado após atualização`);
    }
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao atualizar token FCM do dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Marca um dispositivo como inativo.
 */
export const deactivateDevice = async (
  id: string
): Promise<FirebaseDevice> => {
  try {
    const now = Timestamp.now();
    
    await db.collection(DEVICES_COLLECTION).doc(id).update({
      isActive: false,
      updatedAt: now
    });
    
    // Buscar o dispositivo atualizado
    const updatedDoc = await db.collection(DEVICES_COLLECTION).doc(id).get();
    
    if (!updatedDoc.exists) {
      throw new Error(`Dispositivo ${id} não encontrado após desativação`);
    }
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as FirebaseDevice;
  } catch (error) {
    console.error(`Erro ao desativar dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Exclui um dispositivo pelo ID.
 */
export const deleteDevice = async (
  id: string
): Promise<boolean> => {
  try {
    await db.collection(DEVICES_COLLECTION).doc(id).delete();
    return true;
  } catch (error) {
    console.error(`Erro ao excluir dispositivo ${id}:`, error);
    throw error;
  }
};

/**
 * Busca dispositivos ativos de um usuário.
 */
export const getUserActiveDevices = async (
  userId: string
): Promise<FirebaseDevice[]> => {
  try {
    const { devices } = await getDevices({
      userId,
      isActive: true
    });
    
    return devices;
  } catch (error) {
    console.error(`Erro ao buscar dispositivos ativos do usuário ${userId}:`, error);
    throw error;
  }
};

/**
 * Desativa todos os dispositivos de um usuário.
 */
export const deactivateAllUserDevices = async (
  userId: string
): Promise<number> => {
  try {
    const { devices } = await getDevices({
      userId,
      isActive: true
    });
    
    if (devices.length === 0) {
      return 0;
    }
    
    const now = Timestamp.now();
    const batch = db.batch();
    
    devices.forEach(device => {
      const docRef = db.collection(DEVICES_COLLECTION).doc(device.id);
      batch.update(docRef, {
        isActive: false,
        updatedAt: now
      });
    });
    
    await batch.commit();
    
    return devices.length;
  } catch (error) {
    console.error(`Erro ao desativar todos os dispositivos do usuário ${userId}:`, error);
    throw error;
  }
};

/**
 * Limpa tokens de push inválidos.
 */
export const cleanupInvalidPushTokens = async (
  invalidTokens: string[]
): Promise<number> => {
  try {
    if (invalidTokens.length === 0) {
      return 0;
    }
    
    let cleanedCount = 0;
    const now = Timestamp.now();
    const batch = db.batch();
    
    for (const token of invalidTokens) {
      const snapshot = await db.collection(DEVICES_COLLECTION)
        .where("pushToken", "==", token)
        .get();
      
      snapshot.forEach(doc => {
        const docRef = db.collection(DEVICES_COLLECTION).doc(doc.id);
        batch.update(docRef, {
          pushToken: null,
          updatedAt: now
        });
        cleanedCount++;
      });
    }
    
    if (cleanedCount > 0) {
      await batch.commit();
    }
    
    return cleanedCount;
  } catch (error) {
    console.error(`Erro ao limpar tokens de push inválidos:`, error);
    throw error;
  }
};

/**
 * Limpa tokens FCM inválidos.
 */
export const cleanupInvalidFcmTokens = async (
  invalidTokens: string[]
): Promise<number> => {
  try {
    if (invalidTokens.length === 0) {
      return 0;
    }
    
    let cleanedCount = 0;
    const now = Timestamp.now();
    const batch = db.batch();
    
    for (const token of invalidTokens) {
      const snapshot = await db.collection(DEVICES_COLLECTION)
        .where("fcmToken", "==", token)
        .get();
      
      snapshot.forEach(doc => {
        const docRef = db.collection(DEVICES_COLLECTION).doc(doc.id);
        batch.update(docRef, {
          fcmToken: null,
          updatedAt: now
        });
        cleanedCount++;
      });
    }
    
    if (cleanedCount > 0) {
      await batch.commit();
    }
    
    return cleanedCount;
  } catch (error) {
    console.error(`Erro ao limpar tokens FCM inválidos:`, error);
    throw error;
  }
};