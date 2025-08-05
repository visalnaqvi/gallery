// lib/firebaseClient.ts
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
   apiKey: "AIzaSyBZhtV-TZThLDFBRCQ3zuTHQ0grC_INmWQ",
  authDomain: "gallery-585ee.firebaseapp.com",
  projectId: "gallery-585ee",
  storageBucket: "gallery-585ee.firebasestorage.app",
  messagingSenderId: "659727654328",
  appId: "1:659727654328:web:84d7d328fefe9f2e20834d",
  measurementId: "G-V20HYXKSG4"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export { storage };
