import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "flowfocus-79f2e.firebasestorage.app",
  messagingSenderId: "886511220201",
  appId: "1:886511220201:web:ed80e54100942185128778"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // Esta es nuestra conexión a la base de datos
//autentificacion y el proveedor de google
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();