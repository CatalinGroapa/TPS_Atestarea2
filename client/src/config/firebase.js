import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBEr6ZV8QGu_j6t3B2EzON8Vr16H4AjwAQ",
  authDomain: "pulceprice.firebaseapp.com",
  projectId: "pulceprice",
  storageBucket: "pulceprice.firebasestorage.app",
  messagingSenderId: "598518435359",
  appId: "1:598518435359:web:a4b313270f73826e6a8f2a"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
