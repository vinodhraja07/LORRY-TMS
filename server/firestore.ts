import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
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
import embeddedFirebaseConfig from "../firebase-applet-config.json";

let dbInstance: Firestore | null = null;

function getFirestoreInstance(): Firestore {
  if (dbInstance) return dbInstance;

  let firebaseConfig: any = { ...embeddedFirebaseConfig };
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    try {
      const diskConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      firebaseConfig = { ...firebaseConfig, ...diskConfig };
    } catch (e) {
      console.warn("Notice: Using embedded Firebase config:", e);
    }
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const databaseId =
    firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? firebaseConfig.firestoreDatabaseId
      : undefined;

  try {
    dbInstance = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId
    );
  } catch {
    dbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }

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
  resolvedPhone?: string;
  password_hash?: string;
}

/**
 * Extracts a normalized 10-digit phone number from either phone or phone_cell.
 */
function extractUserPhone(data: any): string {
  const normDirect = normalizePhone(data.phone);
  if (normDirect && normDirect.length >= 7) return normDirect;
  const normCell = normalizePhone(data.phone_cell);
  if (normCell && normCell.length >= 7) return normCell;
  return normDirect || normCell || "";
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
      const resolved = extractUserPhone(data);
      return {
        docId: docSnap.id,
        username: data.username,
        email: data.email,
        name: data.name,
        phone: data.phone,
        phone_cell: data.phone_cell,
        resolvedPhone: resolved,
        password_hash: data.password_hash,
      };
    }
  }

  return null;
}

/**
 * Looks up a user in Firestore by username, email, or phone number.
 */
export async function findFirestoreUserByIdentifier(rawInput: string): Promise<FirestoreUserMatch | null> {
  if (!rawInput || typeof rawInput !== "string") return null;
  const cleanInput = rawInput.trim();
  if (!cleanInput) return null;

  const lowerInput = cleanInput.toLowerCase();
  const normDigits = normalizePhone(cleanInput);

  const db = getFirestoreInstance();
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const uUsername = (data.username || "").toString().trim().toLowerCase();
    const uEmail = (data.email || "").toString().trim().toLowerCase();
    const uPhone = normalizePhone(data.phone);
    const uPhoneCell = normalizePhone(data.phone_cell);

    const matchesUsername = uUsername && uUsername === lowerInput;
    const matchesEmail = uEmail && uEmail === lowerInput;
    const matchesPhone = normDigits && normDigits.length >= 7 && (uPhone === normDigits || uPhoneCell === normDigits);

    if (matchesUsername || matchesEmail || matchesPhone) {
      const resolved = extractUserPhone(data);
      return {
        docId: docSnap.id,
        username: data.username,
        email: data.email,
        name: data.name,
        phone: data.phone,
        phone_cell: data.phone_cell,
        resolvedPhone: resolved,
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
