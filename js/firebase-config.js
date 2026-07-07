// Unico punto in cui cambiare config per un nuovo progetto
const firebaseConfig = {
  apiKey: "AIzaSyDXs5j6iXN6bmyqvG0zzwEKRli5Hq343lM",
  authDomain: "sitomatrimonio-7e66e.firebaseapp.com",
  projectId: "sitomatrimonio-7e66e",
  storageBucket: "sitomatrimonio-7e66e.firebasestorage.app",
  messagingSenderId: "935471034954",
  appId: "1:935471034954:web:b428ee9682a35bd557ecb3"
};

firebase.initializeApp(firebaseConfig);

export const db      = firebase.firestore();
export const storage = firebase.storage();
export const auth    = firebase.auth();
