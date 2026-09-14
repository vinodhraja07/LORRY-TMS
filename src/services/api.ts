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
    const errorMsg =
      data?.error || data?.message || `Request failed with status ${res.status} (${res.statusText || "Error"})`;
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
    const input = typeof data === "string" ? data : (data.phone || data.username || data.email || "");
    try {
      return await safeFetchJson<{
        success?: boolean;
        message: string;
        phone?: string;
        resolvedPhone?: string;
        delivered?: boolean;
        provider?: string;
        devOtp?: string;
        note?: string;
      }>("/api/auth/forgot-password-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: input, identifier: input }),
      });
    } catch (apiErr: any) {
      console.warn("Notice: SMS route unavailable or returned error, using direct Firestore OTP fallback:", apiErr?.message);
      const fsRes = await firebaseService.forgotPassword(input);
      return {
        success: true,
        message: fsRes.message,
        phone: fsRes.phone,
        resolvedPhone: fsRes.phone,
        provider: "firebase",
        delivered: true,
        devOtp: fsRes.devOtp,
        note: fsRes.note,
      };
    }
  },
  sendSms: async (data: { phone: string; code: string; message?: string }) => {
    return safeFetchJson<{ success: boolean; message?: string }>("/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  verifyResetCode: async (data: { phone?: string; email?: string; username?: string; code: string }) => {
    const input = data.phone || data.username || data.email || "";
    try {
      return await safeFetchJson<{ verified: boolean; message?: string; resetToken?: string }>("/api/auth/verify-sms-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: input, identifier: input, code: data.code }),
      });
    } catch (apiErr: any) {
      console.warn("Notice: Verify route unavailable or returned error, using direct Firestore fallback:", apiErr?.message);
      const fsRes = await firebaseService.verifyResetCode(data);
      return {
        verified: fsRes.verified,
        message: fsRes.message,
        resetToken: `fs_token_${Date.now()}`,
      };
    }
  },
  resetPassword: async (data: {
    phone?: string;
    email?: string;
    username?: string;
    code?: string;
    resetToken?: string;
    newPassword: string;
  }) => {
    const input = data.phone || data.username || data.email || "";
    try {
      return await safeFetchJson<{ message: string }>("/api/auth/reset-password-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: input,
          identifier: input,
          resetToken: data.resetToken,
          code: data.code,
          newPassword: data.newPassword,
        }),
      });
    } catch (apiErr: any) {
      console.warn("Notice: Reset route unavailable or returned error, using direct Firestore fallback:", apiErr?.message);
      return await firebaseService.resetPassword({
        phone: input,
        code: data.code || "",
        newPassword: data.newPassword,
      });
    }
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
