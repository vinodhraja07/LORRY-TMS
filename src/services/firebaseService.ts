import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  User,
  Lorry,
  Trip,
  IncomeExpense,
  ExpiriesSummary,
  ReportsData,
  TripMemo,
  TransportHeaderSettings,
  DocumentStatus,
  ExpiryAlert,
} from "../types";

// Local storage session keys
const TOKEN_KEY = "lorry_auth_token";
const USER_KEY = "lorry_auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

// Password hashing utility using Web Crypto API SHA-256
async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_sri_transport_secure_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback for environments where subtle crypto might be restricted
    let hash = 0;
    const str = password + "_sri_salt";
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return "h_" + Math.abs(hash);
  }
}

export function computeDocStatus(dateStr: string, docName: string): DocumentStatus {
  if (!dateStr) {
    return {
      expiryDate: "",
      daysRemaining: 0,
      status: "Expired",
      formattedText: `${docName} Expiry: Not Set | Status: Expired`,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: "Valid" | "Expiring Soon" | "Expired" = "Valid";
  if (daysRemaining < 0) {
    status = "Expired";
  } else if (daysRemaining <= 30) {
    status = "Expiring Soon";
  } else {
    status = "Valid";
  }

  const parts = dateStr.split("-");
  const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;

  let remainingText = "";
  if (daysRemaining < 0) {
    remainingText = `Expired ${Math.abs(daysRemaining)} days ago`;
  } else if (daysRemaining === 0) {
    remainingText = "Expires Today";
  } else {
    remainingText = `${daysRemaining} days`;
  }

  const formattedText = `${docName} Expiry: ${formattedDate} | Remaining: ${remainingText} | Status: ${status}`;

  return {
    expiryDate: dateStr,
    daysRemaining,
    status,
    formattedText,
  };
}

export function enrichLorry(lorry: any): Lorry {
  const insurance = computeDocStatus(lorry.insurance_expiry, "Insurance");
  const fc = computeDocStatus(lorry.fc_expiry, "Fitness Certificate (FC)");
  const permit = computeDocStatus(lorry.permit_expiry, "National/State Permit");
  const pollution = computeDocStatus(lorry.pollution_expiry, "Pollution Certificate (PUC)");

  let docHealth: "Valid" | "Expiring Soon" | "Expired" = "Valid";
  if (
    insurance.status === "Expired" ||
    fc.status === "Expired" ||
    permit.status === "Expired" ||
    pollution.status === "Expired"
  ) {
    docHealth = "Expired";
  } else if (
    insurance.status === "Expiring Soon" ||
    fc.status === "Expiring Soon" ||
    permit.status === "Expiring Soon" ||
    pollution.status === "Expiring Soon"
  ) {
    docHealth = "Expiring Soon";
  }

  return {
    ...lorry,
    documents: {
      insurance,
      fc,
      permit,
      pollution,
      docHealth,
    },
  };
}

// Get current Company ID for the logged in user
export async function getCurrentCompanyId(): Promise<string> {
  const storedUser = getStoredUser();
  if (storedUser) {
    return storedUser.company_id || String(storedUser.id);
  }
  return "default_company";
}

export const firebaseService = {
  // ==========================================
  // Dedicated Username, Phone & Password Auth Operations
  // ==========================================

  registerUser: async (userData: {
    username?: string;
    phone?: string;
    email?: string;
    password: string;
    name: string;
    company_name: string;
  }): Promise<{ user: User; message: string; token: string }> => {
    const usernameClean = (userData.username || userData.email || "").trim().toLowerCase();
    const phoneClean = (userData.phone || "").trim();
    const emailClean = (userData.email || (usernameClean.includes("@") ? usernameClean : `${usernameClean}@lorrytms.local`)).trim().toLowerCase();
    const passwordClean = userData.password.trim();
    const nameClean = userData.name.trim();
    const companyClean = userData.company_name.trim();

    if (!nameClean) throw new Error("Your full name is required.");
    if (!companyClean) throw new Error("Transport company name is required.");
    if (!usernameClean) throw new Error("Username is required.");
    if (usernameClean.length < 3) throw new Error("Username must be at least 3 characters long.");
    if (!phoneClean) throw new Error("Phone number is required for password recovery.");
    
    // Validate phone number has at least 7 digits
    const phoneDigits = phoneClean.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      throw new Error("Please enter a valid phone number (at least 7-10 digits).");
    }

    if (!passwordClean || passwordClean.length < 4) {
      throw new Error("Password must be at least 4 characters long.");
    }

    // Check if user with username or phone already exists in Firestore
    const usersRef = collection(db, "users");
    const allUsersSnap = await getDocs(usersRef);
    const existing = allUsersSnap.docs.find((docSnap) => {
      const u = docSnap.data();
      const uName = (u.username || "").toLowerCase();
      const uPhone = (u.phone || "").replace(/\D/g, "");
      const uEmail = (u.email || "").toLowerCase();
      return (
        uName === usernameClean ||
        (phoneDigits && uPhone === phoneDigits) ||
        (emailClean && uEmail === emailClean)
      );
    });

    if (existing) {
      const uData = existing.data();
      if ((uData.username || "").toLowerCase() === usernameClean) {
        throw new Error(`Username '${usernameClean}' is already taken. Please choose another username.`);
      }
      if ((uData.phone || "").replace(/\D/g, "") === phoneDigits) {
        throw new Error(`An account with phone number ${phoneClean} already exists. Please sign in.`);
      }
      throw new Error(`An account with this username already exists. Please sign in.`);
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const passwordHashed = await hashPassword(passwordClean);

    // 1. Create Company in Cloud Firestore
    const companyRef = doc(db, "companies", companyId);
    const initialCompanyData = {
      id: companyId,
      name: companyClean,
      owner_id: userId,
      proprietor_name: `Prop. ${nameClean}`,
      phone_cell: `Cell : ${phoneClean}`,
      address: "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
      devotional_line1: "குருவே சரணம்",
      devotional_line2: "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      vessel_name_default: "MV Asian Glory",
      gstin: "33AAAAA0000A1Z5",
      memo_prefix: "No. ",
      memo_next_no: 787,
      deity_icon_left: "shiva",
      deity_icon_right: "venkateswara",
      created_at: now,
      updated_at: now,
    };
    await setDoc(companyRef, initialCompanyData);

    // 2. Create User Profile Doc in Cloud Firestore
    const userProfile: User = {
      id: userId,
      username: usernameClean,
      phone: phoneClean,
      email: emailClean,
      name: nameClean,
      company_name: companyClean,
      company_id: companyId,
      role: "admin",
      proprietor_name: `Prop. ${nameClean}`,
      phone_cell: `Cell : ${phoneClean}`,
      address: "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
      devotional_line1: "குருவே சரணம்",
      devotional_line2: "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      vessel_name_default: "MV Asian Glory",
      gstin: "33AAAAA0000A1Z5",
      memo_prefix: "No. ",
      memo_next_no: 787,
      deity_icon_left: "shiva",
      deity_icon_right: "venkateswara",
    };

    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, {
      ...userProfile,
      password_hash: passwordHashed,
      created_at: now,
      updated_at: now,
    });

    const token = `token_${userId}_${Date.now()}`;
    setStoredUser(userProfile);
    setStoredToken(token);

    return {
      user: userProfile,
      token,
      message: "Account created successfully.",
    };
  },

  loginUser: async (credentials: {
    username?: string;
    email?: string;
    phone?: string;
    password: string;
  }): Promise<{ user: User; token: string }> => {
    const inputIdentifier = (credentials.username || credentials.email || credentials.phone || "").trim();
    const identifierClean = inputIdentifier.toLowerCase();
    const inputDigits = inputIdentifier.replace(/\D/g, "");
    const passwordClean = (credentials.password || "").trim();

    if (!inputIdentifier) throw new Error("Username is required.");
    if (!passwordClean) throw new Error("Password is required.");

    const passwordHashed = await hashPassword(passwordClean);

    // Query user by username, email or phone
    const usersRef = collection(db, "users");
    const snap = await getDocs(usersRef);

    let matchedDoc: any = null;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const uName = (data.username || "").toLowerCase();
      const uEmail = (data.email || "").toLowerCase();
      const uPhone = (data.phone || "").replace(/\D/g, "");
      const uPhoneCell = (data.phone_cell || "").replace(/\D/g, "");

      if (
        uName === identifierClean ||
        uEmail === identifierClean ||
        (inputDigits.length >= 7 && (uPhone === inputDigits || uPhoneCell.includes(inputDigits) || inputDigits.includes(uPhone)))
      ) {
        matchedDoc = docSnap;
        break;
      }
    }

    if (!matchedDoc) {
      throw new Error("Invalid username or password. No registered account found with this username.");
    }

    const userData = matchedDoc.data();
    // Validate password hash (or fallback plaintext if legacy)
    const isPasswordValid =
      userData.password_hash === passwordHashed ||
      userData.password === passwordClean;

    if (!isPasswordValid) {
      throw new Error("Invalid password. Please check your password and try again.");
    }

    // Merge with company settings
    const companyId = userData.company_id || matchedDoc.id;
    let companyData: any = {};
    try {
      const compSnap = await getDoc(doc(db, "companies", companyId));
      if (compSnap.exists()) {
        companyData = compSnap.data();
      }
    } catch {
      // ignore
    }

    const userProfile: User = {
      id: matchedDoc.id,
      username: userData.username || userData.email || inputIdentifier,
      phone: userData.phone || companyData.phone || null,
      email: userData.email,
      name: userData.name || "Owner",
      company_name: companyData.name || userData.company_name || "Sri Transport",
      company_id: companyId,
      role: userData.role || "admin",
      proprietor_name: companyData.proprietor_name || userData.proprietor_name || `Prop. ${userData.name}`,
      phone_cell: companyData.phone_cell || userData.phone_cell || (userData.phone ? `Cell : ${userData.phone}` : "Cell : 98949 03533"),
      address: companyData.address || userData.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
      devotional_line1: companyData.devotional_line1 || userData.devotional_line1 || "குருவே சரணம்",
      devotional_line2: companyData.devotional_line2 || userData.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      vessel_name_default: companyData.vessel_name_default || userData.vessel_name_default || "MV Asian Glory",
      gstin: companyData.gstin || userData.gstin || "33AAAAA0000A1Z5",
      memo_prefix: companyData.memo_prefix || userData.memo_prefix || "No. ",
      memo_next_no: companyData.memo_next_no !== undefined ? companyData.memo_next_no : (userData.memo_next_no || 787),
      deity_icon_left: companyData.deity_icon_left || userData.deity_icon_left || "shiva",
      deity_icon_right: companyData.deity_icon_right || userData.deity_icon_right || "venkateswara",
    };

    const token = `token_${matchedDoc.id}_${Date.now()}`;
    setStoredUser(userProfile);
    setStoredToken(token);

    return {
      user: userProfile,
      token,
    };
  },

  forgotPassword: async (input: string | { phone?: string; email?: string; username?: string }): Promise<{ message: string; phone: string; username: string }> => {
    const rawInput = typeof input === "string" ? input : (input.phone || input.username || input.email || "");
    const inputClean = rawInput.trim().toLowerCase();
    const inputDigits = rawInput.replace(/\D/g, "");

    if (!inputClean && !inputDigits) {
      throw new Error("Invalid mobile number. Please enter your registered mobile number.");
    }

    const usersRef = collection(db, "users");
    const snap = await getDocs(usersRef);

    let userDoc: any = null;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const uPhone = (data.phone || "").replace(/\D/g, "");
      const uPhoneCell = (data.phone_cell || "").replace(/\D/g, "");
      const uName = (data.username || "").toLowerCase();
      const uEmail = (data.email || "").toLowerCase();

      if (
        (inputDigits.length >= 7 && (uPhone === inputDigits || uPhoneCell.includes(inputDigits) || inputDigits.includes(uPhone))) ||
        (inputClean && (uPhone === inputClean || uName === inputClean || uEmail === inputClean))
      ) {
        userDoc = docSnap;
        break;
      }
    }

    if (!userDoc) {
      throw new Error("Invalid mobile number. Please enter your registered mobile number.");
    }

    const uData = userDoc.data();
    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    await updateDoc(doc(db, "users", userDoc.id), {
      reset_code: verificationCode,
      reset_expiry: expiry,
      updated_at: new Date().toISOString(),
    });

    const userPhone = uData.phone || rawInput.trim();
    const userName = uData.username || uData.name || "User";

    return {
      message: `6-digit verification code sent to ${userPhone}.`,
      phone: userPhone,
      username: userName,
    };
  },

  verifyResetCode: async (data: { phone?: string; email?: string; username?: string; code: string }): Promise<{ verified: boolean; message: string }> => {
    const rawInput = (data.phone || data.username || data.email || "").trim().toLowerCase();
    const inputDigits = (data.phone || "").replace(/\D/g, "");
    const codeClean = data.code.trim();

    if (!codeClean) {
      throw new Error("Please enter the 6-digit verification code.");
    }

    const usersRef = collection(db, "users");
    const snap = await getDocs(usersRef);

    let userDoc: any = null;
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const uPhone = (d.phone || "").replace(/\D/g, "");
      const uPhoneCell = (d.phone_cell || "").replace(/\D/g, "");
      const uName = (d.username || "").toLowerCase();
      const uEmail = (d.email || "").toLowerCase();

      if (
        (inputDigits.length >= 7 && (uPhone === inputDigits || uPhoneCell.includes(inputDigits) || inputDigits.includes(uPhone))) ||
        (rawInput && (uPhone === rawInput || uName === rawInput || uEmail === rawInput))
      ) {
        userDoc = docSnap;
        break;
      }
    }

    if (!userDoc) {
      throw new Error("No registered account found with this phone number.");
    }

    const userData = userDoc.data();
    if (!userData.reset_code || userData.reset_code !== codeClean) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    if (userData.reset_expiry && Date.now() > userData.reset_expiry) {
      throw new Error("Verification code has expired. Please request a new code.");
    }

    return {
      verified: true,
      message: "Code verified successfully.",
    };
  },

  resetPassword: async (data: { phone?: string; email?: string; username?: string; code: string; newPassword: string }): Promise<{ message: string }> => {
    const rawInput = (data.phone || data.username || data.email || "").trim().toLowerCase();
    const inputDigits = (data.phone || "").replace(/\D/g, "");
    const codeClean = data.code.trim();
    const newPassClean = data.newPassword.trim();

    if (!newPassClean || newPassClean.length < 4) {
      throw new Error("Password must be at least 4 characters long.");
    }

    const usersRef = collection(db, "users");
    const snap = await getDocs(usersRef);

    let userDoc: any = null;
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const uPhone = (d.phone || "").replace(/\D/g, "");
      const uPhoneCell = (d.phone_cell || "").replace(/\D/g, "");
      const uName = (d.username || "").toLowerCase();
      const uEmail = (d.email || "").toLowerCase();

      if (
        (inputDigits.length >= 7 && (uPhone === inputDigits || uPhoneCell.includes(inputDigits) || inputDigits.includes(uPhone))) ||
        (rawInput && (uPhone === rawInput || uName === rawInput || uEmail === rawInput))
      ) {
        userDoc = docSnap;
        break;
      }
    }

    if (!userDoc) {
      throw new Error("No registered account found with this phone number.");
    }

    const userData = userDoc.data();

    if (!userData.reset_code || userData.reset_code !== codeClean) {
      throw new Error("Invalid or expired verification code.");
    }

    const newHash = await hashPassword(newPassClean);
    await updateDoc(doc(db, "users", userDoc.id), {
      password_hash: newHash,
      reset_code: null,
      reset_expiry: null,
      updated_at: new Date().toISOString(),
    });

    return {
      message: "Password reset successfully! Please sign in with your new password.",
    };
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) {
        const data = userSnap.data() as User;
        const companyId = data.company_id || userId;
        const compSnap = await getDoc(doc(db, "companies", companyId));
        if (compSnap.exists()) {
          const compData = compSnap.data();
          return {
            ...data,
            company_name: compData.name || data.company_name,
            address: compData.address || data.address,
            proprietor_name: compData.proprietor_name || data.proprietor_name,
            phone_cell: compData.phone_cell || data.phone_cell,
            devotional_line1: compData.devotional_line1 || data.devotional_line1,
            devotional_line2: compData.devotional_line2 || data.devotional_line2,
            vessel_name_default: compData.vessel_name_default || data.vessel_name_default,
            gstin: compData.gstin || data.gstin,
            memo_prefix: compData.memo_prefix || data.memo_prefix,
            memo_next_no: compData.memo_next_no !== undefined ? compData.memo_next_no : data.memo_next_no,
            deity_icon_left: compData.deity_icon_left || data.deity_icon_left,
            deity_icon_right: compData.deity_icon_right || data.deity_icon_right,
          };
        }
        return data;
      }
      return null;
    } catch (e) {
      console.warn("Could not fetch user doc:", e);
      return null;
    }
  },

  updateUserProfile: async (data: Partial<User>): Promise<User> => {
    const currentProfile = getStoredUser();
    if (!currentProfile) throw new Error("Not authenticated");

    const userId = String(currentProfile.id);
    const companyId = currentProfile.company_id || userId;

    const updatedProfile: User = {
      ...currentProfile,
      ...data,
      id: userId,
    };

    // Update in users collection
    await setDoc(
      doc(db, "users", userId),
      {
        ...updatedProfile,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update in companies collection
    const companyUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (data.company_name) companyUpdates.name = data.company_name;
    if (data.proprietor_name !== undefined) companyUpdates.proprietor_name = data.proprietor_name;
    if (data.phone_cell !== undefined) companyUpdates.phone_cell = data.phone_cell;
    if (data.address !== undefined) companyUpdates.address = data.address;
    if (data.devotional_line1 !== undefined) companyUpdates.devotional_line1 = data.devotional_line1;
    if (data.devotional_line2 !== undefined) companyUpdates.devotional_line2 = data.devotional_line2;
    if (data.vessel_name_default !== undefined) companyUpdates.vessel_name_default = data.vessel_name_default;
    if (data.gstin !== undefined) companyUpdates.gstin = data.gstin;
    if (data.memo_prefix !== undefined) companyUpdates.memo_prefix = data.memo_prefix;
    if (data.memo_next_no !== undefined) companyUpdates.memo_next_no = data.memo_next_no;
    if (data.deity_icon_left !== undefined) companyUpdates.deity_icon_left = data.deity_icon_left;
    if (data.deity_icon_right !== undefined) companyUpdates.deity_icon_right = data.deity_icon_right;

    await setDoc(doc(db, "companies", companyId), companyUpdates, { merge: true });

    setStoredUser(updatedProfile);
    return updatedProfile;
  },

  logoutUser: async (): Promise<void> => {
    removeStoredToken();
  },

  deleteAccount: async (): Promise<void> => {
    const currentProfile = getStoredUser();
    if (!currentProfile) throw new Error("Not authenticated");

    const userId = String(currentProfile.id);
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch {
      // ignore
    }
    removeStoredToken();
  },

  // ==========================================
  // Lorries Fleet Operations
  // ==========================================

  getLorries: async (params?: { search?: string; status?: string }): Promise<{ lorries: Lorry[]; total: number }> => {
    const companyId = await getCurrentCompanyId();
    const lorriesRef = collection(db, "companies", companyId, "lorries");

    const snapshot = await getDocs(lorriesRef);
    let lorries: Lorry[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      lorries.push(enrichLorry({ id: docSnap.id, ...data }));
    });

    if (params?.status && params.status !== "ALL") {
      lorries = lorries.filter((l) => l.status === params.status);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      lorries = lorries.filter(
        (l) =>
          l.vehicle_number?.toLowerCase().includes(q) ||
          l.vehicle_type?.toLowerCase().includes(q) ||
          l.notes?.toLowerCase().includes(q)
      );
    }

    lorries.sort((a, b) => a.vehicle_number.localeCompare(b.vehicle_number));

    return {
      lorries,
      total: lorries.length,
    };
  },

  getLorry: async (id: string | number): Promise<{ lorry: Lorry; trips: Trip[]; stats: { totalTrips: number; totalRevenue: number; totalProfit: number } }> => {
    const companyId = await getCurrentCompanyId();
    const lorryRef = doc(db, "companies", companyId, "lorries", String(id));
    const lorrySnap = await getDoc(lorryRef);

    if (!lorrySnap.exists()) {
      throw new Error("Lorry not found");
    }

    const lorry = enrichLorry({ id: lorrySnap.id, ...lorrySnap.data() });

    const tripsRef = collection(db, "companies", companyId, "trips");
    const tripsSnap = await getDocs(tripsRef);
    const trips: Trip[] = [];

    tripsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (String(data.vehicle_id) === String(id)) {
        trips.push({ id: docSnap.id, ...data } as Trip);
      }
    });

    trips.sort((a, b) => b.date.localeCompare(a.date));

    const totalTrips = trips.length;
    const totalRevenue = trips.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalProfit = trips.reduce((sum, t) => sum + (t.profit || 0), 0);

    return {
      lorry,
      trips,
      stats: {
        totalTrips,
        totalRevenue,
        totalProfit,
      },
    };
  },

  createLorry: async (data: Partial<Lorry>): Promise<{ lorry: Lorry; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const formattedVehNo = (data.vehicle_number || "").trim().toUpperCase();

    if (!formattedVehNo) throw new Error("Vehicle number is required.");
    if (!data.capacity || Number(data.capacity) <= 0) throw new Error("Valid capacity is required.");

    const lorriesRef = collection(db, "companies", companyId, "lorries");
    const existingSnap = await getDocs(lorriesRef);
    const duplicate = existingSnap.docs.find(
      (d) => (d.data().vehicle_number || "").toUpperCase() === formattedVehNo
    );

    if (duplicate) {
      throw new Error(`A lorry with Vehicle Number ${formattedVehNo} already exists.`);
    }

    const lorryDocId = formattedVehNo.replace(/[^A-Z0-9]/g, "");
    const now = new Date().toISOString();

    const lorryData = {
      vehicle_number: formattedVehNo,
      vehicle_type: (data.vehicle_type || "10-wheeler tipper").trim(),
      capacity: Number(data.capacity),
      insurance_expiry: data.insurance_expiry || "",
      fc_expiry: data.fc_expiry || "",
      permit_expiry: data.permit_expiry || "",
      pollution_expiry: data.pollution_expiry || "",
      status: data.status || "Available",
      notes: data.notes ? data.notes.trim() : "",
      company_id: companyId,
      created_at: now,
      updated_at: now,
    };

    const newDocRef = doc(db, "companies", companyId, "lorries", lorryDocId);
    await setDoc(newDocRef, lorryData);

    const created = enrichLorry({ id: lorryDocId, ...lorryData });
    return {
      lorry: created,
      message: "Lorry added successfully to Cloud Firestore",
    };
  },

  updateLorry: async (id: string | number, data: Partial<Lorry>): Promise<{ lorry: Lorry; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const lorryRef = doc(db, "companies", companyId, "lorries", String(id));
    const lorrySnap = await getDoc(lorryRef);

    if (!lorrySnap.exists()) {
      throw new Error("Lorry not found");
    }

    const formattedVehNo = (data.vehicle_number || "").trim().toUpperCase();

    if (formattedVehNo) {
      const lorriesRef = collection(db, "companies", companyId, "lorries");
      const existingSnap = await getDocs(lorriesRef);
      const duplicate = existingSnap.docs.find(
        (d) => d.id !== String(id) && (d.data().vehicle_number || "").toUpperCase() === formattedVehNo
      );
      if (duplicate) {
        throw new Error(`Vehicle Number ${formattedVehNo} is already in use by another lorry.`);
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (formattedVehNo) updateData.vehicle_number = formattedVehNo;
    if (data.vehicle_type) updateData.vehicle_type = data.vehicle_type.trim();
    if (data.capacity !== undefined) updateData.capacity = Number(data.capacity);
    if (data.insurance_expiry !== undefined) updateData.insurance_expiry = data.insurance_expiry;
    if (data.fc_expiry !== undefined) updateData.fc_expiry = data.fc_expiry;
    if (data.permit_expiry !== undefined) updateData.permit_expiry = data.permit_expiry;
    if (data.pollution_expiry !== undefined) updateData.pollution_expiry = data.pollution_expiry;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes.trim();

    await updateDoc(lorryRef, updateData);

    const updatedSnap = await getDoc(lorryRef);
    const updated = enrichLorry({ id: updatedSnap.id, ...updatedSnap.data() });

    return {
      lorry: updated,
      message: "Lorry updated successfully in Cloud Firestore",
    };
  },

  deleteLorry: async (id: string | number): Promise<{ message: string }> => {
    const companyId = await getCurrentCompanyId();
    const lorryRef = doc(db, "companies", companyId, "lorries", String(id));
    await deleteDoc(lorryRef);

    return {
      message: "Lorry deleted successfully from Cloud Firestore",
    };
  },

  getExpiriesSummary: async (): Promise<ExpiriesSummary> => {
    const { lorries } = await firebaseService.getLorries();
    const allAlerts: ExpiryAlert[] = [];

    for (const lorry of lorries) {
      const enriched = enrichLorry(lorry);
      if (enriched.documents) {
        const docs = [
          { type: "Insurance" as const, title: "Insurance", info: enriched.documents.insurance },
          { type: "FC" as const, title: "Fitness Certificate (FC)", info: enriched.documents.fc },
          { type: "Permit" as const, title: "Permit", info: enriched.documents.permit },
          { type: "Pollution" as const, title: "Pollution Certificate", info: enriched.documents.pollution },
        ];

        for (const d of docs) {
          allAlerts.push({
            lorryId: lorry.id,
            vehicleNumber: lorry.vehicle_number,
            docType: d.type,
            docTitle: d.title,
            expiryDate: d.info.expiryDate,
            daysRemaining: d.info.daysRemaining,
            status: d.info.status,
            formattedText: d.info.formattedText,
          });
        }
      }
    }

    allAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    const urgentAlerts = allAlerts.filter((a) => a.status === "Expired" || a.status === "Expiring Soon");

    return {
      totalLorries: lorries.length,
      urgentCount: urgentAlerts.length,
      expiredCount: allAlerts.filter((a) => a.status === "Expired").length,
      expiringSoonCount: allAlerts.filter((a) => a.status === "Expiring Soon").length,
      validCount: allAlerts.filter((a) => a.status === "Valid").length,
      alerts: allAlerts,
      urgentAlerts,
    };
  },

  // ==========================================
  // Trips Operations
  // ==========================================

  getNextSerialNumber: async (): Promise<{ nextSerialNumber: string }> => {
    const companyId = await getCurrentCompanyId();
    const tripsRef = collection(db, "companies", companyId, "trips");
    const snapshot = await getDocs(tripsRef);
    let maxNum = 0;
    snapshot.forEach((docSnap) => {
      const sno = docSnap.data().serial_number;
      const num = parseInt(String(sno), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    const nextNumber = Math.max(snapshot.size, maxNum) + 1;
    return { nextSerialNumber: String(nextNumber) };
  },

  getTrips: async (params?: {
    search?: string;
    vehicle_id?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
  }): Promise<{ trips: Trip[]; total: number; page: number; pageSize: number; totalPages: number }> => {
    const companyId = await getCurrentCompanyId();
    const tripsRef = collection(db, "companies", companyId, "trips");
    const snapshot = await getDocs(tripsRef);

    let trips: Trip[] = [];
    snapshot.forEach((docSnap) => {
      trips.push({ id: docSnap.id, ...docSnap.data() } as Trip);
    });

    if (params?.vehicle_id && params.vehicle_id !== "ALL") {
      trips = trips.filter((t) => String(t.vehicle_id) === String(params.vehicle_id));
    }

    if (params?.from_date) {
      trips = trips.filter((t) => t.date >= params.from_date!);
    }

    if (params?.to_date) {
      trips = trips.filter((t) => t.date <= params.to_date!);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      trips = trips.filter(
        (t) =>
          t.vehicle_number?.toLowerCase().includes(q) ||
          t.bill_number?.toLowerCase().includes(q) ||
          t.cargo?.toLowerCase().includes(q) ||
          t.logistics?.toLowerCase().includes(q) ||
          t.vessel_name?.toLowerCase().includes(q) ||
          t.from_location?.toLowerCase().includes(q) ||
          t.to_location?.toLowerCase().includes(q) ||
          t.serial_number?.toLowerCase().includes(q)
      );
    }

    trips.sort((a, b) => b.date.localeCompare(a.date));

    const total = trips.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, params?.limit || 50);
    const startIndex = (page - 1) * pageSize;
    const paginated = trips.slice(startIndex, startIndex + pageSize);

    return {
      trips: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  getTrip: async (id: string | number): Promise<{ trip: Trip }> => {
    const companyId = await getCurrentCompanyId();
    const tripRef = doc(db, "companies", companyId, "trips", String(id));
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      throw new Error("Trip not found");
    }

    return { trip: { id: tripSnap.id, ...tripSnap.data() } as Trip };
  },

  createTrip: async (data: any): Promise<{ trip: Trip; message: string }> => {
    const companyId = await getCurrentCompanyId();

    const vehicleIdStr = String(data.vehicle_id || "").trim();
    if (!vehicleIdStr) {
      throw new Error("Please select a vehicle for this trip.");
    }

    const lorryRef = doc(db, "companies", companyId, "lorries", vehicleIdStr);
    let lorrySnap = await getDoc(lorryRef);
    let lorryData: any = null;
    let actualLorryRef = lorryRef;

    if (lorrySnap.exists()) {
      lorryData = lorrySnap.data();
    } else {
      // Fallback: search by id or vehicle_number across the company's lorries collection
      const lorriesRef = collection(db, "companies", companyId, "lorries");
      const snapshot = await getDocs(lorriesRef);
      const matched = snapshot.docs.find(
        (d) =>
          d.id.toLowerCase() === vehicleIdStr.toLowerCase() ||
          (d.data().vehicle_number || "").toUpperCase() === vehicleIdStr.toUpperCase()
      );
      if (matched) {
        lorryData = matched.data();
        actualLorryRef = doc(db, "companies", companyId, "lorries", matched.id);
      }
    }

    const vehicleNumber = lorryData?.vehicle_number || vehicleIdStr;
    const vehicleType = lorryData?.vehicle_type || "10-wheeler tipper";

    const numTotalTon = parseFloat(data.total_ton || data.weight_of_load) || 0;
    const numRate = parseFloat(data.rate) || 0;
    const numWeight = parseFloat(data.weight_of_load || data.total_ton) || 0;
    const computedTotalAmount = Number((numTotalTon * numRate).toFixed(2));

    const now = new Date().toISOString();
    const tripDocId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const tripData = {
      serial_number: (data.serial_number || "").trim(),
      vehicle_id: vehicleIdStr,
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      weight_of_load: numWeight,
      cargo: (data.cargo || "").trim(),
      bill_number: (data.bill_number || "").trim(),
      date: (data.date || "").trim(),
      logistics: (data.logistics || "").trim(),
      vessel_name: (data.vessel_name || "Direct Transport").trim(),
      from_location: (data.from_location || "").trim(),
      to_location: (data.to_location || "").trim(),
      total_ton: numTotalTon,
      rate: numRate,
      total_amount: computedTotalAmount,
      diesel_expense: 0,
      toll_expense: 0,
      driver_salary: 0,
      loading_unloading_expense: 0,
      repair_expense: 0,
      other_expense: 0,
      total_expenses: 0,
      profit: computedTotalAmount,
      company_id: companyId,
      created_at: now,
      updated_at: now,
    };

    const tripRef = doc(db, "companies", companyId, "trips", tripDocId);
    await setDoc(tripRef, tripData);

    const financeRef = doc(db, "companies", companyId, "income_expenses", tripDocId);
    await setDoc(financeRef, {
      trip_id: tripDocId,
      trip_income: computedTotalAmount,
      diesel_expense: 0,
      toll_expense: 0,
      driver_salary: 0,
      loading_unloading_expense: 0,
      repair_expense: 0,
      other_expense: 0,
      total_expenses: 0,
      profit: computedTotalAmount,
      company_id: companyId,
      created_at: now,
      updated_at: now,
    });

    if (data.update_lorry_status && lorryData && data.update_lorry_status !== lorryData.status) {
      try {
        await updateDoc(actualLorryRef, {
          status: data.update_lorry_status,
          updated_at: now,
        });
      } catch (e) {
        // ignore non-blocking lorry status update failure
      }
    }

    const createdTrip = { id: tripDocId, ...tripData } as Trip;
    return {
      trip: createdTrip,
      message: "Trip logged successfully in Cloud Firestore",
    };
  },

  updateTrip: async (id: string | number, data: any): Promise<{ trip: Trip; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const tripRef = doc(db, "companies", companyId, "trips", String(id));
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      throw new Error("Trip not found");
    }

    const numTotalTon = parseFloat(data.total_ton || data.weight_of_load) || 0;
    const numRate = parseFloat(data.rate) || 0;
    const numWeight = parseFloat(data.weight_of_load || data.total_ton) || 0;
    const computedTotalAmount = Number((numTotalTon * numRate).toFixed(2));

    const existingTrip = tripSnap.data();
    const existingExpenses = existingTrip.total_expenses || 0;
    const computedProfit = Number((computedTotalAmount - existingExpenses).toFixed(2));

    let vehicleNumber = existingTrip.vehicle_number;
    let vehicleType = existingTrip.vehicle_type;

    if (data.vehicle_id && String(data.vehicle_id) !== String(existingTrip.vehicle_id)) {
      const vId = String(data.vehicle_id);
      const lSnap = await getDoc(doc(db, "companies", companyId, "lorries", vId));
      if (lSnap.exists()) {
        vehicleNumber = lSnap.data().vehicle_number;
        vehicleType = lSnap.data().vehicle_type;
      } else {
        const lorriesRef = collection(db, "companies", companyId, "lorries");
        const snapshot = await getDocs(lorriesRef);
        const matched = snapshot.docs.find(
          (d) =>
            d.id.toLowerCase() === vId.toLowerCase() ||
            (d.data().vehicle_number || "").toUpperCase() === vId.toUpperCase()
        );
        if (matched) {
          vehicleNumber = matched.data().vehicle_number;
          vehicleType = matched.data().vehicle_type;
        }
      }
    }

    const updateData = {
      serial_number: data.serial_number ? data.serial_number.trim() : existingTrip.serial_number,
      vehicle_id: String(data.vehicle_id || existingTrip.vehicle_id),
      vehicle_number: vehicleNumber,
      vehicle_type: vehicleType,
      weight_of_load: numWeight,
      cargo: data.cargo ? data.cargo.trim() : existingTrip.cargo,
      bill_number: data.bill_number ? data.bill_number.trim() : existingTrip.bill_number,
      date: data.date ? data.date.trim() : existingTrip.date,
      logistics: data.logistics !== undefined ? data.logistics.trim() : existingTrip.logistics,
      vessel_name: data.vessel_name !== undefined ? data.vessel_name.trim() : existingTrip.vessel_name,
      from_location: data.from_location ? data.from_location.trim() : existingTrip.from_location,
      to_location: data.to_location ? data.to_location.trim() : existingTrip.to_location,
      total_ton: numTotalTon,
      rate: numRate,
      total_amount: computedTotalAmount,
      profit: computedProfit,
      updated_at: new Date().toISOString(),
    };

    await updateDoc(tripRef, updateData);

    const financeRef = doc(db, "companies", companyId, "income_expenses", String(id));
    const financeSnap = await getDoc(financeRef);
    if (financeSnap.exists()) {
      await updateDoc(financeRef, {
        trip_income: computedTotalAmount,
        profit: computedProfit,
        updated_at: new Date().toISOString(),
      });
    }

    const updatedSnap = await getDoc(tripRef);
    const updatedTrip = { id: updatedSnap.id, ...updatedSnap.data() } as Trip;

    return {
      trip: updatedTrip,
      message: "Trip updated successfully in Cloud Firestore",
    };
  },

  deleteTrip: async (id: string | number): Promise<{ message: string }> => {
    const companyId = await getCurrentCompanyId();
    await deleteDoc(doc(db, "companies", companyId, "trips", String(id)));
    try {
      await deleteDoc(doc(db, "companies", companyId, "income_expenses", String(id)));
    } catch {
      // ignore
    }

    return {
      message: "Trip deleted successfully from Cloud Firestore",
    };
  },

  // ==========================================
  // Finances & Ledger Operations
  // ==========================================

  getAvailableTrips: async (): Promise<{ availableTrips: any[]; unlinkedTrips: any[] }> => {
    const { trips } = await firebaseService.getTrips();
    return { availableTrips: trips, unlinkedTrips: trips };
  },

  getUnlinkedTrips: async (): Promise<{ unlinkedTrips: any[]; availableTrips: any[] }> => {
    const { trips } = await firebaseService.getTrips();
    return { unlinkedTrips: trips, availableTrips: trips };
  },

  getFinances: async (params?: {
    search?: string;
    vehicle_id?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    records: IncomeExpense[];
    summary: any;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const companyId = await getCurrentCompanyId();
    const tripsRef = collection(db, "companies", companyId, "trips");
    const tripsSnap = await getDocs(tripsRef);

    const records: IncomeExpense[] = [];

    tripsSnap.forEach((docSnap) => {
      const t = docSnap.data();
      records.push({
        id: docSnap.id,
        trip_id: docSnap.id,
        trip_income: t.total_amount || 0,
        diesel_expense: t.diesel_expense || 0,
        toll_expense: t.toll_expense || 0,
        driver_salary: t.driver_salary || 0,
        loading_unloading_expense: t.loading_unloading_expense || 0,
        repair_expense: t.repair_expense || 0,
        other_expense: t.other_expense || 0,
        total_expenses: t.total_expenses || 0,
        profit: t.profit !== undefined ? t.profit : (t.total_amount || 0) - (t.total_expenses || 0),
        serial_number: t.serial_number,
        bill_number: t.bill_number,
        trip_date: t.date,
        cargo: t.cargo,
        from_location: t.from_location,
        to_location: t.to_location,
        total_ton: t.total_ton,
        rate: t.rate,
        vehicle_id: t.vehicle_id,
        vehicle_number: t.vehicle_number,
        vehicle_type: t.vehicle_type,
        company_id: companyId,
        created_at: t.created_at,
        updated_at: t.updated_at,
      });
    });

    let filtered = records;

    if (params?.vehicle_id && params.vehicle_id !== "ALL") {
      filtered = filtered.filter((r) => String(r.vehicle_id) === String(params.vehicle_id));
    }

    if (params?.from_date) {
      filtered = filtered.filter((r) => (r.trip_date || "") >= params.from_date!);
    }

    if (params?.to_date) {
      filtered = filtered.filter((r) => (r.trip_date || "") <= params.to_date!);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.serial_number?.toLowerCase().includes(q) ||
          r.bill_number?.toLowerCase().includes(q) ||
          r.vehicle_number?.toLowerCase().includes(q) ||
          r.cargo?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => (b.trip_date || "").localeCompare(a.trip_date || ""));

    const summary = filtered.reduce(
      (acc, row) => {
        acc.totalIncome += row.trip_income || 0;
        acc.totalDiesel += row.diesel_expense || 0;
        acc.totalToll += row.toll_expense || 0;
        acc.totalSalary += row.driver_salary || 0;
        acc.totalLoading += row.loading_unloading_expense || 0;
        acc.totalRepair += row.repair_expense || 0;
        acc.totalOther += row.other_expense || 0;
        acc.totalExpenses += row.total_expenses || 0;
        acc.totalProfit += row.profit || 0;
        return acc;
      },
      {
        totalIncome: 0,
        totalDiesel: 0,
        totalToll: 0,
        totalSalary: 0,
        totalLoading: 0,
        totalRepair: 0,
        totalOther: 0,
        totalExpenses: 0,
        totalProfit: 0,
      }
    );

    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, params?.limit || 50);
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      records: paginated,
      summary,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  getFinanceRecord: async (id: string | number): Promise<{ record: IncomeExpense }> => {
    const companyId = await getCurrentCompanyId();
    const tripSnap = await getDoc(doc(db, "companies", companyId, "trips", String(id)));
    if (!tripSnap.exists()) throw new Error("Financial record not found");

    const t = tripSnap.data();
    return {
      record: {
        id: tripSnap.id,
        trip_id: tripSnap.id,
        trip_income: t.total_amount || 0,
        diesel_expense: t.diesel_expense || 0,
        toll_expense: t.toll_expense || 0,
        driver_salary: t.driver_salary || 0,
        loading_unloading_expense: t.loading_unloading_expense || 0,
        repair_expense: t.repair_expense || 0,
        other_expense: t.other_expense || 0,
        total_expenses: t.total_expenses || 0,
        profit: t.profit !== undefined ? t.profit : (t.total_amount || 0) - (t.total_expenses || 0),
        serial_number: t.serial_number,
        bill_number: t.bill_number,
        trip_date: t.date,
        cargo: t.cargo,
        from_location: t.from_location,
        to_location: t.to_location,
        total_ton: t.total_ton,
        rate: t.rate,
        vehicle_number: t.vehicle_number,
        vehicle_type: t.vehicle_type,
      },
    };
  },

  saveFinanceRecord: async (data: any): Promise<{ record: IncomeExpense; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const tripId = String(data.trip_id);

    const tripRef = doc(db, "companies", companyId, "trips", tripId);
    const tripSnap = await getDoc(tripRef);
    if (!tripSnap.exists()) throw new Error("Associated trip does not exist");

    const tripData = tripSnap.data();
    const income = data.trip_income !== undefined && !isNaN(parseFloat(data.trip_income))
      ? parseFloat(data.trip_income)
      : tripData.total_amount;

    const diesel = Math.max(0, parseFloat(data.diesel_expense) || 0);
    const toll = Math.max(0, parseFloat(data.toll_expense) || 0);
    const salary = Math.max(0, parseFloat(data.driver_salary) || 0);
    const loading = Math.max(0, parseFloat(data.loading_unloading_expense) || 0);
    const repair = Math.max(0, parseFloat(data.repair_expense) || 0);
    const other = Math.max(0, parseFloat(data.other_expense) || 0);

    const totalExp = Number((diesel + toll + salary + loading + repair + other).toFixed(2));
    const netProfit = Number((income - totalExp).toFixed(2));
    const now = new Date().toISOString();

    await updateDoc(tripRef, {
      total_amount: income,
      diesel_expense: diesel,
      toll_expense: toll,
      driver_salary: salary,
      loading_unloading_expense: loading,
      repair_expense: repair,
      other_expense: other,
      total_expenses: totalExp,
      profit: netProfit,
      updated_at: now,
    });

    const financeRef = doc(db, "companies", companyId, "income_expenses", tripId);
    await setDoc(financeRef, {
      trip_id: tripId,
      trip_income: income,
      diesel_expense: diesel,
      toll_expense: toll,
      driver_salary: salary,
      loading_unloading_expense: loading,
      repair_expense: repair,
      other_expense: other,
      total_expenses: totalExp,
      profit: netProfit,
      company_id: companyId,
      updated_at: now,
    }, { merge: true });

    const updatedSnap = await getDoc(tripRef);
    const t = updatedSnap.data()!;

    return {
      record: {
        id: tripId,
        trip_id: tripId,
        trip_income: income,
        diesel_expense: diesel,
        toll_expense: toll,
        driver_salary: salary,
        loading_unloading_expense: loading,
        repair_expense: repair,
        other_expense: other,
        total_expenses: totalExp,
        profit: netProfit,
        serial_number: t.serial_number,
        bill_number: t.bill_number,
        trip_date: t.date,
        vehicle_number: t.vehicle_number,
      },
      message: "Financial expenses saved successfully to Cloud Firestore",
    };
  },

  deleteFinanceRecord: async (id: string | number): Promise<{ message: string }> => {
    const companyId = await getCurrentCompanyId();
    const tripRef = doc(db, "companies", companyId, "trips", String(id));
    const tripSnap = await getDoc(tripRef);

    if (tripSnap.exists()) {
      const tripData = tripSnap.data();
      const income = tripData.total_amount || 0;
      await updateDoc(tripRef, {
        diesel_expense: 0,
        toll_expense: 0,
        driver_salary: 0,
        loading_unloading_expense: 0,
        repair_expense: 0,
        other_expense: 0,
        total_expenses: 0,
        profit: income,
        updated_at: new Date().toISOString(),
      });
    }

    try {
      await deleteDoc(doc(db, "companies", companyId, "income_expenses", String(id)));
    } catch {
      // ignore
    }

    return { message: "Financial expenses reset successfully" };
  },

  // ==========================================
  // Reports Operations
  // ==========================================

  getReports: async (params?: { from_date?: string; to_date?: string; vehicle_id?: string }): Promise<ReportsData> => {
    const companyId = await getCurrentCompanyId();
    const tripsRef = collection(db, "companies", companyId, "trips");
    const snapshot = await getDocs(tripsRef);

    let rows: any[] = [];
    snapshot.forEach((docSnap) => {
      const t = docSnap.data();
      rows.push({
        id: docSnap.id,
        trip_income: t.total_amount || 0,
        diesel_expense: t.diesel_expense || 0,
        toll_expense: t.toll_expense || 0,
        driver_salary: t.driver_salary || 0,
        loading_unloading_expense: t.loading_unloading_expense || 0,
        repair_expense: t.repair_expense || 0,
        other_expense: t.other_expense || 0,
        total_expenses: t.total_expenses || 0,
        profit: t.profit !== undefined ? t.profit : (t.total_amount || 0) - (t.total_expenses || 0),
        serial_number: t.serial_number,
        bill_number: t.bill_number,
        trip_date: t.date,
        cargo: t.cargo,
        from_location: t.from_location,
        to_location: t.to_location,
        total_ton: t.total_ton,
        rate: t.rate,
        vehicle_id: t.vehicle_id,
        vehicle_number: t.vehicle_number,
        vehicle_type: t.vehicle_type,
      });
    });

    if (params?.from_date) {
      rows = rows.filter((r) => (r.trip_date || "") >= params.from_date!);
    }
    if (params?.to_date) {
      rows = rows.filter((r) => (r.trip_date || "") <= params.to_date!);
    }
    if (params?.vehicle_id && params.vehicle_id !== "ALL") {
      rows = rows.filter((r) => String(r.vehicle_id) === String(params.vehicle_id));
    }

    rows.sort((a, b) => (a.trip_date || "").localeCompare(b.trip_date || ""));

    let totalIncome = 0;
    let totalDiesel = 0;
    let totalToll = 0;
    let totalSalary = 0;
    let totalLoading = 0;
    let totalRepair = 0;
    let totalOther = 0;
    let totalExpenses = 0;
    let totalProfit = 0;
    let totalTonnage = 0;

    const dailyMap: Record<string, any> = {};
    const monthlyMap: Record<string, any> = {};
    const vehicleMap: Record<string, any> = {};
    const cargoMap: Record<string, any> = {};

    for (const r of rows) {
      const inc = r.trip_income || 0;
      const die = r.diesel_expense || 0;
      const tol = r.toll_expense || 0;
      const sal = r.driver_salary || 0;
      const loa = r.loading_unloading_expense || 0;
      const rep = r.repair_expense || 0;
      const oth = r.other_expense || 0;
      const exp = r.total_expenses || 0;
      const pro = r.profit || 0;
      const ton = r.total_ton || 0;

      totalIncome += inc;
      totalDiesel += die;
      totalToll += tol;
      totalSalary += sal;
      totalLoading += loa;
      totalRepair += rep;
      totalOther += oth;
      totalExpenses += exp;
      totalProfit += pro;
      totalTonnage += ton;

      const d = r.trip_date || "Unknown";
      if (!dailyMap[d]) {
        dailyMap[d] = { date: d, income: 0, expenses: 0, profit: 0, trips: 0 };
      }
      dailyMap[d].income += inc;
      dailyMap[d].expenses += exp;
      dailyMap[d].profit += pro;
      dailyMap[d].trips += 1;

      const m = d.length >= 7 ? d.substring(0, 7) : "Unknown";
      if (!monthlyMap[m]) {
        monthlyMap[m] = {
          month: m,
          income: 0,
          expenses: 0,
          profit: 0,
          diesel: 0,
          toll: 0,
          salary: 0,
          loading: 0,
          repair: 0,
          other: 0,
          trips: 0,
        };
      }
      monthlyMap[m].income += inc;
      monthlyMap[m].expenses += exp;
      monthlyMap[m].profit += pro;
      monthlyMap[m].diesel += die;
      monthlyMap[m].toll += tol;
      monthlyMap[m].salary += sal;
      monthlyMap[m].loading += loa;
      monthlyMap[m].repair += rep;
      monthlyMap[m].other += oth;
      monthlyMap[m].trips += 1;

      const vKey = r.vehicle_number || "Unknown";
      if (!vehicleMap[vKey]) {
        vehicleMap[vKey] = {
          vehicleId: r.vehicle_id,
          vehicleNumber: r.vehicle_number,
          vehicleType: r.vehicle_type,
          tripsCount: 0,
          totalTon: 0,
          income: 0,
          expenses: 0,
          profit: 0,
        };
      }
      vehicleMap[vKey].tripsCount += 1;
      vehicleMap[vKey].totalTon += ton;
      vehicleMap[vKey].income += inc;
      vehicleMap[vKey].expenses += exp;
      vehicleMap[vKey].profit += pro;

      const cKey = r.cargo || "General Cargo";
      if (!cargoMap[cKey]) {
        cargoMap[cKey] = { cargo: cKey, ton: 0, trips: 0, revenue: 0 };
      }
      cargoMap[cKey].ton += ton;
      cargoMap[cKey].trips += 1;
      cargoMap[cKey].revenue += inc;
    }

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    const vehiclePerformance = Object.values(vehicleMap).sort((a, b) => b.profit - a.profit);
    const cargoDistribution = Object.values(cargoMap).sort((a, b) => b.revenue - a.revenue);

    const profitMargin = totalIncome > 0 ? Number(((totalProfit / totalIncome) * 100).toFixed(1)) : 0;

    const expenseBreakdown = [
      { name: "Diesel Fuel", amount: totalDiesel, percentage: totalExpenses > 0 ? Math.round((totalDiesel / totalExpenses) * 100) : 0, color: "#f59e0b" },
      { name: "Driver Salary & Bata", amount: totalSalary, percentage: totalExpenses > 0 ? Math.round((totalSalary / totalExpenses) * 100) : 0, color: "#3b82f6" },
      { name: "Toll Gate Charges", amount: totalToll, percentage: totalExpenses > 0 ? Math.round((totalToll / totalExpenses) * 100) : 0, color: "#8b5cf6" },
      { name: "Loading / Unloading", amount: totalLoading, percentage: totalExpenses > 0 ? Math.round((totalLoading / totalExpenses) * 100) : 0, color: "#10b981" },
      { name: "Repairs & Maintenance", amount: totalRepair, percentage: totalExpenses > 0 ? Math.round((totalRepair / totalExpenses) * 100) : 0, color: "#ef4444" },
      { name: "Other Operational Costs", amount: totalOther, percentage: totalExpenses > 0 ? Math.round((totalOther / totalExpenses) * 100) : 0, color: "#64748b" },
    ].filter((item) => item.amount > 0);

    return {
      metrics: {
        totalTrips: rows.length,
        totalIncome,
        totalExpenses,
        netProfit: totalProfit,
        profitMargin,
        totalTonnage: Number(totalTonnage.toFixed(2)),
        totalTons: Number(totalTonnage.toFixed(2)),
        breakdown: {
          diesel: totalDiesel,
          toll: totalToll,
          salary: totalSalary,
          loading: totalLoading,
          repair: totalRepair,
          other: totalOther,
        },
      },
      summary: {
        totalTrips: rows.length,
        totalIncome,
        totalExpenses,
        netProfit: totalProfit,
        profitMargin,
        totalTons: Number(totalTonnage.toFixed(2)),
        totalTonnage: Number(totalTonnage.toFixed(2)),
      },
      dailyTrend,
      monthlyTrend,
      vehiclePerformance,
      cargoDistribution,
      expenseBreakdown,
      tripWiseRecords: rows,
    };
  },

  // ==========================================
  // Trip Memos & Printable Transport Bill Sheets
  // ==========================================

  getMemoSettings: async (): Promise<{ settings: TransportHeaderSettings }> => {
    const companyId = await getCurrentCompanyId();
    const compSnap = await getDoc(doc(db, "companies", companyId));
    const comp = compSnap.exists() ? compSnap.data() : {};

    return {
      settings: {
        transport_name: comp.name || "SRI TRANSPORT",
        proprietor_name: comp.proprietor_name || "Prop. Vinodh Raja",
        phone_cell: comp.phone_cell || "Cell : 98949 03533",
        address: comp.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
        devotional_line1: comp.devotional_line1 || "குருவே சரணம்",
        devotional_line2: comp.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
        vessel_name_default: comp.vessel_name_default || "MV Asian Glory",
        gstin: comp.gstin || "33AAAAA0000A1Z5",
        memo_prefix: comp.memo_prefix || "No. ",
        memo_next_no: comp.memo_next_no !== undefined ? comp.memo_next_no : 787,
        deity_icon_left: comp.deity_icon_left || "shiva",
        deity_icon_right: comp.deity_icon_right || "venkateswara",
      },
    };
  },

  updateMemoSettings: async (settings: Partial<TransportHeaderSettings>): Promise<{ message: string }> => {
    const companyId = await getCurrentCompanyId();
    const companyRef = doc(db, "companies", companyId);

    const updateObj: any = {
      updated_at: new Date().toISOString(),
    };
    if (settings.transport_name) updateObj.name = settings.transport_name;
    if (settings.proprietor_name !== undefined) updateObj.proprietor_name = settings.proprietor_name;
    if (settings.phone_cell !== undefined) updateObj.phone_cell = settings.phone_cell;
    if (settings.address !== undefined) updateObj.address = settings.address;
    if (settings.devotional_line1 !== undefined) updateObj.devotional_line1 = settings.devotional_line1;
    if (settings.devotional_line2 !== undefined) updateObj.devotional_line2 = settings.devotional_line2;
    if (settings.vessel_name_default !== undefined) updateObj.vessel_name_default = settings.vessel_name_default;
    if (settings.gstin !== undefined) updateObj.gstin = settings.gstin;
    if (settings.memo_prefix !== undefined) updateObj.memo_prefix = settings.memo_prefix;
    if (settings.memo_next_no !== undefined) updateObj.memo_next_no = Number(settings.memo_next_no);
    if (settings.deity_icon_left !== undefined) updateObj.deity_icon_left = settings.deity_icon_left;
    if (settings.deity_icon_right !== undefined) updateObj.deity_icon_right = settings.deity_icon_right;

    await setDoc(companyRef, updateObj, { merge: true });
    return { message: "Transport bill header settings saved to Cloud Firestore" };
  },

  getNextMemoNumber: async (): Promise<{ memo_number: string }> => {
    const companyId = await getCurrentCompanyId();
    const compSnap = await getDoc(doc(db, "companies", companyId));
    const comp = compSnap.exists() ? compSnap.data() : {};

    const prefix = comp.memo_prefix !== undefined ? comp.memo_prefix : "No. ";
    const nextNo = comp.memo_next_no !== undefined ? Number(comp.memo_next_no) : 787;

    return {
      memo_number: `${prefix}${nextNo}`,
    };
  },

  getMemos: async (params?: { search?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<{ memos: TripMemo[]; total: number; page: number; totalPages: number }> => {
    const companyId = await getCurrentCompanyId();
    const memosRef = collection(db, "companies", companyId, "trip_memos");
    const snapshot = await getDocs(memosRef);

    let memos: TripMemo[] = [];
    snapshot.forEach((docSnap) => {
      memos.push({ id: docSnap.id, ...docSnap.data() } as TripMemo);
    });

    if (params?.startDate) {
      memos = memos.filter((m) => m.date >= params.startDate!);
    }
    if (params?.endDate) {
      memos = memos.filter((m) => m.date <= params.endDate!);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      memos = memos.filter(
        (m) =>
          m.memo_number?.toLowerCase().includes(q) ||
          m.party_name?.toLowerCase().includes(q) ||
          m.vessel_name?.toLowerCase().includes(q) ||
          m.from_location?.toLowerCase().includes(q) ||
          m.to_location?.toLowerCase().includes(q)
      );
    }

    memos.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const total = memos.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, params?.limit || 20);
    const startIndex = (page - 1) * pageSize;
    const paginated = memos.slice(startIndex, startIndex + pageSize);

    return {
      memos: paginated,
      total,
      page,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  getMemo: async (id: string | number): Promise<{ memo: TripMemo }> => {
    const companyId = await getCurrentCompanyId();
    const memoRef = doc(db, "companies", companyId, "trip_memos", String(id));
    const memoSnap = await getDoc(memoRef);

    if (!memoSnap.exists()) {
      throw new Error("Trip memo not found");
    }

    return { memo: { id: memoSnap.id, ...memoSnap.data() } as TripMemo };
  },

  createMemo: async (data: Partial<TripMemo>): Promise<{ memo: TripMemo; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const memoId = `memo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const memoDoc = {
      memo_number: data.memo_number || "No. 787",
      date: data.date || now.split("T")[0],
      party_name: data.party_name || "",
      vessel_name: data.vessel_name || "MV Asian Glory",
      from_location: data.from_location || "",
      to_location: data.to_location || "",
      transport_name: data.transport_name || "SRI TRANSPORT",
      address: data.address || "122E, Polepettai, Ettayapuram Road, Thoothukudi - 628002",
      proprietor_info: data.proprietor_info || "Prop. Vinodh Raja",
      devotional_line1: data.devotional_line1 || "குருவே சரணம்",
      devotional_line2: data.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
      total_amount: Number(data.total_amount || 0),
      amount_in_words: data.amount_in_words || "",
      notes: data.notes || "",
      items: data.items || [],
      company_id: companyId,
      created_at: now,
      updated_at: now,
    };

    const memoRef = doc(db, "companies", companyId, "trip_memos", memoId);
    await setDoc(memoRef, memoDoc);

    // Increment company next memo number
    try {
      const compSnap = await getDoc(doc(db, "companies", companyId));
      if (compSnap.exists()) {
        const comp = compSnap.data();
        const currentNext = comp.memo_next_no !== undefined ? Number(comp.memo_next_no) : 787;
        await updateDoc(doc(db, "companies", companyId), {
          memo_next_no: currentNext + 1,
        });
      }
    } catch {
      // ignore
    }

    return {
      memo: { id: memoId, ...memoDoc } as TripMemo,
      message: "Trip memo created and saved successfully to Cloud Firestore",
    };
  },

  updateMemo: async (id: string | number, data: Partial<TripMemo>): Promise<{ memo: TripMemo; message: string }> => {
    const companyId = await getCurrentCompanyId();
    const memoRef = doc(db, "companies", companyId, "trip_memos", String(id));
    const memoSnap = await getDoc(memoRef);

    if (!memoSnap.exists()) {
      throw new Error("Trip memo not found");
    }

    const updateDocData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.memo_number !== undefined) updateDocData.memo_number = data.memo_number;
    if (data.date !== undefined) updateDocData.date = data.date;
    if (data.party_name !== undefined) updateDocData.party_name = data.party_name;
    if (data.vessel_name !== undefined) updateDocData.vessel_name = data.vessel_name;
    if (data.from_location !== undefined) updateDocData.from_location = data.from_location;
    if (data.to_location !== undefined) updateDocData.to_location = data.to_location;
    if (data.transport_name !== undefined) updateDocData.transport_name = data.transport_name;
    if (data.address !== undefined) updateDocData.address = data.address;
    if (data.proprietor_info !== undefined) updateDocData.proprietor_info = data.proprietor_info;
    if (data.devotional_line1 !== undefined) updateDocData.devotional_line1 = data.devotional_line1;
    if (data.devotional_line2 !== undefined) updateDocData.devotional_line2 = data.devotional_line2;
    if (data.total_amount !== undefined) updateDocData.total_amount = Number(data.total_amount);
    if (data.amount_in_words !== undefined) updateDocData.amount_in_words = data.amount_in_words;
    if (data.notes !== undefined) updateDocData.notes = data.notes;
    if (data.items !== undefined) updateDocData.items = data.items;

    await updateDoc(memoRef, updateDocData);

    const updatedSnap = await getDoc(memoRef);
    return {
      memo: { id: updatedSnap.id, ...updatedSnap.data() } as TripMemo,
      message: "Trip memo updated successfully in Cloud Firestore",
    };
  },

  deleteMemo: async (id: string | number): Promise<{ message: string }> => {
    const companyId = await getCurrentCompanyId();
    await deleteDoc(doc(db, "companies", companyId, "trip_memos", String(id)));
    return {
      message: "Trip memo deleted successfully from Cloud Firestore",
    };
  },
};
