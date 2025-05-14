const admin = require("firebase-admin");
const path = require("path");

// Caminho para o arquivo de credenciais do Firebase Admin SDK
// Ajuste este caminho se o arquivo estiver em um local diferente em seu ambiente de teste
const serviceAccountPath = path.resolve(__dirname, "src/config/firebaseServiceAccountKey.json");

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // projectId: "medforum-488ec", // Opcional, geralmente inferido da credencial
    });
    console.log("Firebase Admin SDK initialized successfully for testing with service account.");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK for testing:", error);
    // É crucial lançar o erro aqui para que os testes falhem se a inicialização não ocorrer.
    // Caso contrário, você terá erros de 'firestore is undefined' mais tarde.
    throw error;
  }
} else {
  console.log("Firebase Admin SDK already initialized.");
}

// Exportar a instância do firestore para que possa ser usada consistentemente
// module.exports = { firestore: admin.firestore() }; // Isso pode não ser a melhor forma de compartilhar

// É melhor que os módulos que usam firestore o importem de config/firebaseAdmin.ts
// Este arquivo (jest.setup.js) apenas garante a inicialização antes dos testes.

