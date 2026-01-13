// firebase-init.js
// Importing from your local lib folder
import { initializeApp } from './lib/firebase-app.js';
import { getFirestore } from './lib/firebase-firestore.js';
import { getAuth } from './lib/firebase-auth.js';

// TODO: Replace with your actual project config from Firebase Console
// Go to: Project Settings > General > Your apps > SDK setup and configuration > Config
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDR0EK0OULam0xsB9yVp_8qno8NV2ivF6Q",
  authDomain: "tfgcp-project-01.firebaseapp.com",
  projectId: "tfgcp-project-01",
  storageBucket: "tfgcp-project-01.firebasestorage.app",
  messagingSenderId: "789113929254",
  appId: "1:789113929254:web:d4ac06a817349e34aef0e7",
  measurementId: "G-ZEQNZ284W0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export them so popup.js can use them
export { db, auth };
