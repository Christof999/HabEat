import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAmUr_DwhYsTmZ0G3rkevZILq1JNquVQUo",
  authDomain: "habeat-7da5c.firebaseapp.com",
  projectId: "habeat-7da5c",
  storageBucket: "habeat-7da5c.firebasestorage.app",
  messagingSenderId: "1000372185953",
  appId: "1:1000372185953:web:d26af3defd400e9aac3320"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
