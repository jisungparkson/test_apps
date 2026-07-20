import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCuAacIZkk44EW2LcQ6hptQiYXC3WAi6zM',
  authDomain: 'restduy.firebaseapp.com',
  projectId: 'restduy',
  storageBucket: 'restduy.firebasestorage.app',
  messagingSenderId: '142685114134',
  appId: '1:142685114134:web:4dfbdd5539839aa5aa4a37',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
