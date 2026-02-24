// src/security/Auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    setPersistence, browserLocalPersistence, browserSessionPersistence,
    signOut, updateProfile, sendEmailVerification,
    GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjr1e3AYjQ7ZGqagb23HWqMdGjZaYcAmU",
  authDomain: "my-universe-os.firebaseapp.com",
  projectId: "my-universe-os",
  storageBucket: "my-universe-os.firebasestorage.app",
  messagingSenderId: "190319305708",
  appId: "1:190319305708:web:0dd89920ad6b9e2f1416c9",
  measurementId: "G-VGBNGHQZWD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ★修正：Googleアカウントを複数持っている人のために、毎回選択画面を出す！
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function saveUserProfile(user, userName) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            name: userName || user.displayName || "名無し",
            email: user.email,
            plan: "free", 
            createdAt: new Date().toISOString()
        });
    }
}

export async function loginWithGoogle(rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const result = await signInWithPopup(auth, googleProvider);
        await saveUserProfile(result.user, result.user.displayName);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: "Googleログインに失敗しました: " + error.message };
    }
}

export async function loginToUniverse(email, password, rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: "メールの確認が完了していません。\n受信トレイのリンクをクリックしてください。" };
        }
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: "ログインに失敗しました。アドレスかパスワードが違います。" };
    }
}

export async function createUniverseAccount(email, password, userName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userName });
        await saveUserProfile(user, userName);
        await sendEmailVerification(user);
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function logoutFromUniverse() {
    await signOut(auth);
}