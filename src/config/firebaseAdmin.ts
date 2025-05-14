import * as admin from "firebase-admin";
import { AppError } from "../utils/errors";

// Unificado o caminho para o arquivo da chave da conta de serviço
const serviceAccountPath = __dirname + "/firebaseServiceAccountKey.json"; 

let firestoreDb: admin.firestore.Firestore;
let storageInstance: admin.storage.Storage;

export function initializeAppIfNeeded() {
    try {
        if (admin.apps.length === 0) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK inicializado com sucesso a partir de firebaseAdmin.ts.");
            firestoreDb = admin.firestore(); // Moved here
            firestoreDb.settings({         // Moved here
                ignoreUndefinedProperties: true, 
            });
            // Inicializar o storage apenas se admin.storage for uma função
            if (typeof admin.storage === 'function') {
                storageInstance = admin.storage();
            } else {
                console.warn("admin.storage não é uma função. Storage não inicializado.");
            }
        } else {
            console.log("Firebase Admin SDK já inicializado (detectado em firebaseAdmin.ts).");
            // Ensure instances are assigned if already initialized elsewhere, though ideally this block means they are already set.
            if (!firestoreDb) firestoreDb = admin.firestore();
            // Inicializar o storage apenas se admin.storage for uma função
            if (!storageInstance && typeof admin.storage === 'function') {
                storageInstance = admin.storage();
            }
        }
    } catch (error: any) {
        console.error("Erro ao inicializar Firebase Admin SDK em firebaseAdmin.ts:", error.message);
        // Lançar o erro aqui é importante para que as falhas de inicialização sejam visíveis
        throw AppError.internal(`Falha na inicialização do Firebase Admin em firebaseAdmin.ts: ${error.message}`);
    }
}

// Chama a inicialização quando o módulo é carregado
initializeAppIfNeeded();

// Função utilitária para limpar coleções (usada em testes)
export async function clearCollection(collectionPath: string, queryFn?: (ref: admin.firestore.CollectionReference) => admin.firestore.Query): Promise<void> {
    // firestoreDb já deve estar inicializado neste ponto
    if (!firestoreDb) {
        // Esta linha não deveria ser alcançada se a inicialização no topo do módulo funcionar
        console.warn("Firestore não estava inicializado em clearCollection, tentando inicializar...");
        initializeAppIfNeeded(); 
    }
    const collectionRef = firestoreDb.collection(collectionPath);
    const finalQuery = queryFn ? queryFn(collectionRef) : collectionRef;
    const snapshot = await finalQuery.get();

    if (snapshot.empty) {
        return;
    }

    const batch = firestoreDb.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Coleção ${collectionPath} limpa (documentos correspondentes à query).`);
}

// Exporta a instância do Firestore e admin para ser usada em outros serviços
export { firestoreDb as firestore, admin, admin as firebaseAdmin, storageInstance as storage };

