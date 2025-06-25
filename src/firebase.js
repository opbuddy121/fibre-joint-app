// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDQDYD-_3iQLD1dAOPRIk58tENCzK8RQFA",
  authDomain: "jointcheckapp.firebaseapp.com",
  projectId: "jointcheckapp",
  storageBucket: "jointcheckapp.firebasestorage.app",
  messagingSenderId: "1095028707037",
  appId: "1:1095028707037:web:3ac433c1a8455f2cc71534",
  measurementId: "G-37EM525HB5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app; 