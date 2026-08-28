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

export const api = {
  // Auth (Dedicated Username, Phone & Password)
  login: async (credentials: { username?: string; email?: string; phone?: string; password: string }) => {
    return firebaseService.loginUser(credentials);
  },
  register: async (userData: { username?: string; phone?: string; email?: string; password: string; name: string; company_name: string }) => {
    return firebaseService.registerUser(userData);
  },
  forgotPassword: async (data: { phone?: string; email?: string; username?: string } | string) => {
    const res = await firebaseService.forgotPassword(data);
    // Also trigger server SMS gateway dispatch
    try {
      await fetch("/api/auth/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: res.phone, code: res.code }),
      });
    } catch (e) {
      // ignore network errors for sms dispatch
    }
    return res;
  },
  sendSms: async (data: { phone: string; code: string; message?: string }) => {
    const res = await fetch("/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  verifyResetCode: async (data: { phone?: string; email?: string; username?: string; code: string }) => {
    return firebaseService.verifyResetCode(data);
  },
  resetPassword: async (data: { phone?: string; email?: string; username?: string; code: string; newPassword: string }) => {
    return firebaseService.resetPassword(data);
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
