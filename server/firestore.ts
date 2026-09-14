import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  Firestore,
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { normalizePhone } from "./phoneUtils";

let dbInstance: Firestore | null = null;

function getFirestoreInstance(): Firestore {
  if (dbInstance) return dbInstance;

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let firebaseConfig: any = {};
  if (fs.existsSync(configPath)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      console.warn("Failed to parse firebase-applet-config.json:", e);
    }
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  dbInstance =
    firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);

  return dbInstance;
}

/**
 * Hashing utility matching frontend firebaseService SHA-256 implementation
 */
export function hashFirestorePassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "_sri_transport_secure_salt_2026")
    .digest("hex");
}

export interface FirestoreUserMatch {
  docId: string;
  username?: string;
  email?: string;
  name?: string;
  phone?: string;
  phone_cell?: string;
  password_hash?: string;
}

/**
 * Looks up a user in Firestore's users collection by normalized phone or phone_cell
 */
export async function findFirestoreUserByPhone(rawPhone: string): Promise<FirestoreUserMatch | null> {
  const normTarget = normalizePhone(rawPhone);
  if (!normTarget || normTarget.length < 7) return null;

  const db = getFirestoreInstance();
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const uPhone = normalizePhone(data.phone);
    const uPhoneCell = normalizePhone(data.phone_cell);

    if (uPhone === normTarget || uPhoneCell === normTarget) {
      return {
        docId: docSnap.id,
        username: data.username,
        email: data.email,
        name: data.name,
        phone: data.phone,
        phone_cell: data.phone_cell,
        password_hash: data.password_hash,
      };
    }
  }

  return null;
}

/**
 * Updates a user's password in Firestore
 */
export async function updateFirestoreUserPassword(docId: string, newPasswordHash: string): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "users", docId);
  await updateDoc(userRef, {
    password_hash: newPasswordHash,
    reset_code: null,
    reset_expiry: null,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Reverts a user's password in Firestore if a dual-write fails (compensating write)
 */
export async function revertFirestoreUserPassword(docId: string, oldPasswordHash: string): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "users", docId);
  await updateDoc(userRef, {
    password_hash: oldPasswordHash,
    updated_at: new Date().toISOString(),
  });
}
