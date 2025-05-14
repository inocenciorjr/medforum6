// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Comentado pois pode não ser usado no backend
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDc0PvLzGKFOFm1-wdINKn35U1CqPe2YGc",
  authDomain: "medforum-488ec.firebaseapp.com",
  projectId: "medforum-488ec",
  storageBucket: "medforum-488ec.firebasestorage.app",
  messagingSenderId: "149898653309",
  appId: "1:149898653309:web:395fbebd7b976820590b14",
  measurementId: "G-2V4NYH5WQ8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Comentado
export { app };

