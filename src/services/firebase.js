// src/services/firebase.js — PetConnect
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where,
  orderBy, limit, getDocs, updateDoc, addDoc, Timestamp,
  serverTimestamp, increment, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAeVrOoVkYzuw5jJVyF8RPe1nPVNY3rkL0",
  authDomain: "connecpet.firebaseapp.com",
  projectId: "connecpet",
  storageBucket: "connecpet.firebasestorage.app",
  messagingSenderId: "323479101975",
  appId: "1:323479101975:web:55650ce113479e5a87b252"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ===================== AUTH =====================
export async function registerUser(data) {
  const { email, password, name, phone, city, state } = data;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const user = {
    uid, name, email, phone: phone||'', city: city||'', state: state||'',
    registrationDate: Timestamp.fromDate(now),
    expirationDate: Timestamp.fromDate(expiry),
    isActive: true, isAdmin: false, isExpired: false, totalPets: 0
  };
  await setDoc(doc(db, 'pc_users', uid), user);
  return { ...user };
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'pc_users', cred.user.uid));
  if (!snap.exists()) throw new Error('USER_NOT_FOUND');
  const user = snap.data();
  if (!user.isAdmin) {
    if (!user.isActive) throw new Error('BLOCKED');
    const expiry = user.expirationDate?.toDate?.();
    if (expiry && expiry < new Date()) throw new Error('EXPIRED');
  }
  return user;
}

export async function getCurrentUser() {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await getDoc(doc(db, 'pc_users', u.uid));
  return snap.exists() ? snap.data() : null;
}

export async function logoutUser() { await signOut(auth); }
export function resetPassword(email) { return sendPasswordResetEmail(auth, email); }
export { onAuthStateChanged, Timestamp };

// ===================== PETS =====================
// No orderBy to avoid composite index requirement - sort in JS
export async function getPets(userId) {
  const q = query(collection(db, 'pc_pets'), where('ownerUid', '==', userId));
  const snap = await getDocs(q);
  const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return pets.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
}

export async function createPet(data, userId, userName) {
  const ref = await addDoc(collection(db, 'pc_pets'), {
    ...data, ownerUid: userId, ownerName: userName, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, 'pc_users', userId), { totalPets: increment(1) });
  return ref.id;
}

export async function updatePet(petId, data) {
  await updateDoc(doc(db, 'pc_pets', petId), data);
}

export async function deletePet(petId, userId) {
  await deleteDoc(doc(db, 'pc_pets', petId));
  await updateDoc(doc(db, 'pc_users', userId), { totalPets: increment(-1) });
}

// ===================== VACINAS =====================
export async function getVaccines(petId) {
  const q = query(collection(db, 'pc_vaccines'), where('petId', '==', petId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
}
export async function addVaccine(data) {
  await addDoc(collection(db, 'pc_vaccines'), { ...data, createdAt: serverTimestamp() });
}
export async function deleteVaccine(id) { await deleteDoc(doc(db, 'pc_vaccines', id)); }
export async function updateVaccine(id, data) { await updateDoc(doc(db, 'pc_vaccines', id), data); }

// ===================== CONSULTAS =====================
export async function getConsults(petId) {
  const q = query(collection(db, 'pc_consults'), where('petId', '==', petId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
}
export async function addConsult(data) {
  await addDoc(collection(db, 'pc_consults'), { ...data, createdAt: serverTimestamp() });
}
export async function deleteConsult(id) { await deleteDoc(doc(db, 'pc_consults', id)); }
export async function updateConsult(id, data) { await updateDoc(doc(db, 'pc_consults', id), data); }

// ===================== PESO =====================
export async function getWeights(petId) {
  const q = query(collection(db, 'pc_weights'), where('petId', '==', petId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
}
export async function addWeight(data) {
  await addDoc(collection(db, 'pc_weights'), { ...data, createdAt: serverTimestamp() });
}
export async function deleteWeight(id) { await deleteDoc(doc(db, 'pc_weights', id)); }

// ===================== FEED =====================
export async function getPosts(lim = 30) {
  const q = query(collection(db, 'pc_posts'), limit(lim));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
}
export async function createPost(content, category, authorUid, authorName) {
  await addDoc(collection(db, 'pc_posts'), {
    content, category, authorUid, authorName,
    likes: 0, likedBy: [], createdAt: serverTimestamp()
  });
}
export async function toggleLike(postId, uid) {
  const ref = doc(db, 'pc_posts', postId);
  const snap = await getDoc(ref);
  const liked = snap.data()?.likedBy?.includes(uid);
  await updateDoc(ref, {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likes: increment(liked ? -1 : 1)
  });
}
export async function updatePost(id, data) { await updateDoc(doc(db, 'pc_posts', id), data); }

// ===================== PERDIDOS & ADOÇÃO =====================
export async function getLostPets(type) {
  const q = query(collection(db, 'pc_lost'), limit(50));
  const snap = await getDocs(q);
  const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  if (!type || type === 'all') return sorted;
  return sorted.filter(x => x.type === type);
}
export async function createLostPost(data, ownerUid, ownerName) {
  await addDoc(collection(db, 'pc_lost'), { ...data, ownerUid, ownerName, createdAt: serverTimestamp() });
}
export async function updateLostPost(id, data) { await updateDoc(doc(db, 'pc_lost', id), data); }

// ===================== ADMIN =====================
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'pc_users'));
  return snap.docs.map(d => ({ ...d.data() }));
}
export async function toggleUserActive(uid, isActive) {
  await updateDoc(doc(db, 'pc_users', uid), { isActive });
}
export async function renewAccess(uid, days) {
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, 'pc_users', uid), {
    expirationDate: Timestamp.fromDate(expiry), isExpired: false, isActive: true
  });
}
export async function getAdminStats() {
  const users = await getAllUsers();
  const now = Date.now();
  return {
    total: users.length,
    active: users.filter(u => u.isActive && !u.isExpired).length,
    expiring: users.filter(u => {
      const d = u.expirationDate?.toDate?.();
      if (!d) return false;
      const diff = (d - now) / (1000*60*60*24);
      return diff >= 0 && diff <= 7;
    }).length,
    expired: users.filter(u => {
      const d = u.expirationDate?.toDate?.();
      return d && d < new Date();
    }).length
  };
}
export async function deleteItem(col, id) { await deleteDoc(doc(db, col, id)); }
export async function updateItem(col, id, data) { await updateDoc(doc(db, col, id), data); }