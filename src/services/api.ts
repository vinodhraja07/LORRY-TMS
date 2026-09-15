import {
  Lorry,
  Trip,
  IncomeExpense,
  ExpiriesSummary,
  ReportsData,
  User,
  TripMemo,
  TransportHeaderSettings,
} from "../types";
import {
  firebaseService,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  getStoredUser,
  setStoredUser,
} from "./firebaseService";

export { getStoredToken, setStoredToken, removeStoredToken, getStoredUser, setStoredUser };

/**
 * Safely extracts a string message from error payloads, preventing '[object Object]'
 */
function extractStringFromPayload(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : null;
  }
  if (typeof payload === "object") {
    if (typeof payload.error === "string") return extractStringFromPayload(payload.error);
    if (typeof payload.message === "string") return extractStringFromPayload(payload.message);
    if (payload.error && typeof payload.error === "object") return extractStringFromPayload(payload.error);
    if (payload.message && typeof payload.message === "object") return extractStringFromPayload(payload.message);
  }
  return null;
}

/**
 * Robust JSON fetch wrapper that gracefully handles HTML error pages,
 * server cold-starts, and network disconnects without throwing
 * "Unexpected token '<', '<!doctype '... is not valid JSON".
 */
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };

  try {
    res = await fetch(url, {
      ...options,
      headers: requestHeaders,
    });
  } catch (netErr: any) {
    throw new Error(
      netErr?.message?.includes("Failed to fetch")
        ? "Network error. Please check your internet connection or server status."
        : netErr?.message || "Connection failed. Please retry."
    );
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  let data: any = null;

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // If server returned HTML (e.g. <!doctype or <html>) or plain text
    const text = await res.text();
    if (text.trim().startsWith("<")) {
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status} (${res.statusText || "Service Unavailable"}). Please try again in a few moments.`);
      }
      throw new Error("Unable to reach the API service (received HTML instead of JSON). Please refresh the page and try again.");
    }
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const extracted =
      extractStringFromPayload(data?.error) ||
      extractStringFromPayload(data?.message) ||
      extractStringFromPayload(data);
    const errorMsg =
      extracted && extracted !== "[object Object]"
        ? extracted
        : `Request failed with status ${res.status} (${res.statusText || "Error"})`;
    throw new Error(errorMsg);
  }

  return (data || {}) as T;
}

export const api = {
  // Auth (Dedicated Username, Phone & Password)
  login: async (credentials: { username?: string; email?: string; phone?: string; password: string }) => {
    return firebaseService.loginUser(credentials);
  },
  register: async (userData: { username?: string; phone?: string; email?: string; password: string; name: string; company_name: string }) => {
    return firebaseService.registerUser(userData);
  },
  forgotPassword: async (data: { phone?: string; email?: string; username?: string } | string) => {
    const phoneInput = typeof data === "string" ? data : (data.phone || data.username || data.email || "");
    return safeFetchJson<{
      success?: boolean;
      message: string;
      phone?: string;
      delivered?: boolean;
      provider?: string;
      devOtp?: string;
      note?: string;
    }>("/api/auth/forgot-password-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneInput }),
    });
  },
  sendSms: async (data: { phone: string; code: string; message?: string }) => {
    return safeFetchJson<{ success: boolean; message?: string }>("/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  verifyResetCode: async (data: { phone?: string; email?: string; username?: string; code: string }) => {
    const phoneInput = data.phone || data.username || data.email || "";
    return safeFetchJson<{ verified: boolean; message?: string; resetToken?: string }>("/api/auth/verify-sms-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneInput, code: data.code }),
    });
  },
  resetPassword: async (data: {
    phone?: string;
    email?: string;
    username?: string;
    code?: string;
    resetToken?: string;
    newPassword: string;
  }) => {
    const phoneInput = data.phone || data.username || data.email || "";
    return safeFetchJson<{ message: string }>("/api/auth/reset-password-with-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneInput,
        resetToken: data.resetToken,
        newPassword: data.newPassword,
      }),
    });
  },
  getMe: async () => {
    const stored = getStoredUser();
    if (!stored) throw new Error("Not authenticated");
    const user = await firebaseService.getUserProfile(String(stored.id));
    if (!user) return { user: stored };
    return { user };
  },
  updateProfile: async (data: Partial<User>) => {
    const user = await firebaseService.updateUserProfile(data);
    return { message: "Profile updated successfully in Cloud Firestore", user };
  },
  deleteAccount: async () => {
    await firebaseService.deleteAccount();
    return { message: "Account deleted successfully" };
  },
  logout: async () => {
    await firebaseService.logoutUser();
    return { message: "Logged out successfully" };
  },

  // Lorries
  getLorries: async (params?: { search?: string; status?: string }) => {
    return firebaseService.getLorries(params);
  },
  getLorry: async (id: string | number) => {
    return firebaseService.getLorry(id);
  },
  createLorry: async (data: Partial<Lorry>) => {
    return firebaseService.createLorry(data);
  },
  updateLorry: async (id: string | number, data: Partial<Lorry>) => {
    return firebaseService.updateLorry(id, data);
  },
  deleteLorry: async (id: string | number) => {
    return firebaseService.deleteLorry(id);
  },
  getExpiriesSummary: async () => {
    return firebaseService.getExpiriesSummary();
  },

  // Trips
  getTrips: async (params?: { search?: string; vehicle_id?: string; from_date?: string; to_date?: string; page?: number; limit?: number }) => {
    return firebaseService.getTrips(params);
  },
  getNextSerialNumber: async () => {
    return firebaseService.getNextSerialNumber();
  },
  getTrip: async (id: string | number) => {
    return firebaseService.getTrip(id);
  },
  createTrip: async (data: any) => {
    return firebaseService.createTrip(data);
  },
  updateTrip: async (id: string | number, data: any) => {
    return firebaseService.updateTrip(id, data);
  },
  deleteTrip: async (id: string | number) => {
    return firebaseService.deleteTrip(id);
  },

  // Finances
  getFinances: async (params?: { search?: string; vehicle_id?: string; from_date?: string; to_date?: string; page?: number; limit?: number }) => {
    return firebaseService.getFinances(params);
  },
  getUnlinkedTrips: async () => {
    return firebaseService.getUnlinkedTrips();
  },
  getAvailableTrips: async () => {
    return firebaseService.getAvailableTrips();
  },
  getFinanceRecord: async (id: string | number) => {
    return firebaseService.getFinanceRecord(id);
  },
  createFinanceRecord: async (data: any) => {
    return firebaseService.saveFinanceRecord(data);
  },
  updateFinanceRecord: async (_id: string | number, data: any) => {
    return firebaseService.saveFinanceRecord(data);
  },
  deleteFinanceRecord: async (id: string | number) => {
    return firebaseService.deleteFinanceRecord(id);
  },

  // Reports
  getReports: async (params?: { from_date?: string; to_date?: string; vehicle_id?: string }) => {
    return firebaseService.getReports(params);
  },

  // Trip Memos & Vouchers (Printable Transport Bill Sheet)
  getMemoSettings: async () => {
    return firebaseService.getMemoSettings();
  },
  updateMemoSettings: async (settings: Partial<TransportHeaderSettings>) => {
    return firebaseService.updateMemoSettings(settings);
  },
  getNextMemoNumber: async () => {
    return firebaseService.getNextMemoNumber();
  },
  getMemos: async (params?: { search?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    return firebaseService.getMemos(params);
  },
  getMemo: async (id: string | number) => {
    return firebaseService.getMemo(id);
  },
  createMemo: async (data: Partial<TripMemo>) => {
    return firebaseService.createMemo(data);
  },
  updateMemo: async (id: string | number, data: Partial<TripMemo>) => {
    return firebaseService.updateMemo(id, data);
  },
  deleteMemo: async (id: string | number) => {
    return firebaseService.deleteMemo(id);
  },
};
