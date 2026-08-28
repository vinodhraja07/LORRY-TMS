export interface User {
  id: string | number;
  username: string;
  email?: string;
  name: string;
  company_name: string;
  company_id?: string;
  role?: "admin" | "manager" | "staff";
  phone?: string | null;
  address?: string | null;
  proprietor_name?: string | null;
  phone_cell?: string | null;
  devotional_line1?: string | null;
  devotional_line2?: string | null;
  vessel_name_default?: string | null;
  gstin?: string | null;
  memo_prefix?: string | null;
  memo_next_no?: number | null;
  deity_icon_left?: string | null;
  deity_icon_right?: string | null;
}

export type LorryStatus = "Available" | "On Trip" | "Inactive";

export interface DocumentStatus {
  expiryDate: string;
  daysRemaining: number;
  status: "Valid" | "Expiring Soon" | "Expired";
  formattedText: string;
}

export interface LorryDocuments {
  insurance: DocumentStatus;
  fc: DocumentStatus;
  permit: DocumentStatus;
  pollution: DocumentStatus;
  docHealth: "Valid" | "Expiring Soon" | "Expired";
}

export interface Lorry {
  id: string | number;
  company_id?: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity: number;
  insurance_expiry: string;
  fc_expiry: string;
  permit_expiry: string;
  pollution_expiry: string;
  status: LorryStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  documents?: LorryDocuments;
}

export interface Trip {
  id: string | number;
  company_id?: string;
  serial_number: string;
  vehicle_id: string | number;
  vehicle_number?: string;
  vehicle_type?: string;
  weight_of_load: number;
  cargo: string;
  bill_number: string;
  date: string;
  logistics?: string;
  vessel_name: string;
  from_location: string;
  to_location: string;
  total_ton: number;
  rate: number;
  total_amount: number;
  created_at?: string;
  updated_at?: string;
  finance_id?: string | number;
  diesel_expense?: number;
  toll_expense?: number;
  driver_salary?: number;
  loading_unloading_expense?: number;
  repair_expense?: number;
  other_expense?: number;
  total_expenses?: number;
  profit?: number;
}

export interface IncomeExpense {
  id: string | number;
  company_id?: string;
  trip_id: string | number;
  trip_income: number;
  diesel_expense: number;
  toll_expense: number;
  driver_salary: number;
  loading_unloading_expense: number;
  repair_expense: number;
  other_expense: number;
  total_expenses: number;
  profit: number;
  created_at?: string;
  updated_at?: string;
  serial_number?: string;
  bill_number?: string;
  trip_date?: string;
  cargo?: string;
  logistics?: string;
  from_location?: string;
  to_location?: string;
  total_ton?: number;
  rate?: number;
  vehicle_id?: string | number;
  vehicle_number?: string;
  vehicle_type?: string;
}

export interface ExpiryAlert {
  lorryId: string | number;
  vehicleNumber: string;
  docType: "Insurance" | "FC" | "Permit" | "Pollution";
  docTitle: string;
  expiryDate: string;
  daysRemaining: number;
  status: "Valid" | "Expiring Soon" | "Expired";
  formattedText: string;
}

export interface ExpiriesSummary {
  totalLorries: number;
  urgentCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  validCount: number;
  alerts: ExpiryAlert[];
  urgentAlerts: ExpiryAlert[];
}

export interface FinancialSummary {
  totalIncome: number;
  totalDiesel: number;
  totalToll: number;
  totalSalary: number;
  totalLoading: number;
  totalRepair: number;
  totalOther: number;
  totalExpenses: number;
  totalProfit: number;
}

export interface ReportsData {
  metrics: {
    totalTrips: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalTonnage: number;
    totalTons?: number;
    breakdown: {
      diesel: number;
      toll: number;
      salary: number;
      loading: number;
      repair: number;
      other: number;
    };
  };
  summary?: {
    totalTrips: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalTons: number;
    totalTonnage?: number;
  };
  dailyTrend: Array<{
    date: string;
    income: number;
    expenses: number;
    profit: number;
    trips: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expenses: number;
    profit: number;
    diesel: number;
    toll: number;
    salary: number;
    loading: number;
    repair: number;
    other: number;
    trips: number;
  }>;
  vehiclePerformance: Array<{
    vehicleId: string | number;
    vehicleNumber: string;
    vehicleType: string;
    tripsCount: number;
    totalTon: number;
    income: number;
    expenses: number;
    profit: number;
  }>;
  cargoDistribution: Array<{
    cargo: string;
    ton: number;
    trips: number;
    revenue: number;
  }>;
  expenseBreakdown: Array<{
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
  tripWiseRecords: IncomeExpense[];
}

export interface TripMemoItem {
  s_no: number | string;
  vehicle_no: string;
  weight?: number | string;     // Weights (Tons)
  rate?: number | string;       // Rate (₹ per ton)
  cargo: string;
  bill_no?: string;             // Bill No.
  amount: number | string;      // Total = Ton * Rate
  particulars?: string;
  no_of_trips?: number | string;
}

export interface TripMemo {
  id: string | number;
  owner_id?: string | number;
  company_id?: string;
  memo_number: string;
  date: string;
  party_name: string;
  vessel_name?: string;
  from_location?: string;
  to_location?: string;
  transport_name: string;
  address?: string;
  proprietor_info?: string;
  devotional_line1?: string;
  devotional_line2?: string;
  total_amount: number;
  total_ton?: number;
  amount_in_words?: string;
  notes?: string;
  items: TripMemoItem[];
  created_at?: string;
  updated_at?: string;
}

export interface TransportHeaderSettings {
  transport_name: string;
  proprietor_name: string;
  phone_cell: string;
  address: string;
  devotional_line1: string;
  devotional_line2: string;
  vessel_name_default?: string;
  gstin?: string;
  memo_prefix?: string;
  memo_next_no?: number;
  deity_icon_left?: string;
  deity_icon_right?: string;
}

export type NavTab = "dashboard" | "lorries" | "trips" | "finances" | "reports" | "memos";

