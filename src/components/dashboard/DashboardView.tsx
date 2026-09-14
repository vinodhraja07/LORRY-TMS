import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";
import { Lorry, Trip, ExpiriesSummary, ReportsData, NavTab } from "../../types";
import { StatusBadge } from "../common/StatusBadge";
import {
  Truck,
  Route,
  ReceiptIndianRupee,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
  onOpenNewTrip?: () => void;
  onOpenNewLorry?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onOpenNewTrip,
  onOpenNewLorry,
}) => {
  const [loading, setLoading] = useState(true);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expiries, setExpiries] = useState<ExpiriesSummary | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [docFilter, setDocFilter] = useState<"ALL" | "URGENT" | "EXPIRED" | "EXPIRING_SOON">("URGENT");

  const loadData = async () => {
    setLoading(true);
    try {
      const [lorryRes, tripRes, expiryRes, reportRes] = await Promise.all([
        api.getLorries(),
        api.getTrips({ limit: 6 }),
        api.getExpiriesSummary(),
        api.getReports(),
      ]);
      setLorries(lorryRes.lorries);
      setTrips(tripRes.trips);
      setExpiries(expiryRes);
      setReports(reportRes);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fleet Statistics
  const totalLorries = lorries.length;
  const availableLorries = lorries.filter((l) => l.status === "Available").length;
  const onTripLorries = lorries.filter((l) => l.status === "On Trip").length;
  const inactiveLorries = lorries.filter((l) => l.status === "Inactive").length;

  // Financial Summary from Reports
  const totalIncome = reports?.metrics?.totalIncome ?? 0;
  const totalExpenses = reports?.metrics?.totalExpenses ?? 0;
  const totalProfit = reports?.metrics?.netProfit ?? 0;
  const totalTrips = reports?.metrics?.totalTrips ?? trips.length;

  // Document Alert filtering
  const filteredAlerts = useMemo(() => {
    if (!expiries) return [];
    if (docFilter === "URGENT") return expiries.urgentAlerts;
    if (docFilter === "EXPIRED") return expiries.alerts.filter((a) => a.status === "Expired");
    if (docFilter === "EXPIRING_SOON") return expiries.alerts.filter((a) => a.status === "Expiring Soon");
    return expiries.alerts;
  }, [expiries, docFilter]);

  // Chart Data
  const fleetPieData = [
    { name: "Available", value: availableLorries, color: "#10b981" },
    { name: "On Trip", value: onTripLorries, color: "#3b82f6" },
    { name: "Inactive", value: inactiveLorries, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const monthlyBarData = (reports?.monthlyTrend || []).map((m) => ({
    name: m.month,
    Income: m.income,
    Expenses: m.expenses,
    Profit: m.profit,
  }));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Loading Transport Analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b] p-5 rounded-2xl border border-white/10 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Fleet Operations Overview
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time status of lorries, ongoing trips, financial metrics, and statutory document renewals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab("memos")}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs shadow-indigo-500/20 flex items-center gap-1.5 transition-colors"
          >
            <ReceiptIndianRupee className="w-4 h-4" />
            <span>Trip Bill Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab("trips")}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs shadow-blue-500/20 flex items-center gap-1.5 transition-colors"
          >
            <Route className="w-4 h-4" />
            <span>Manage Trips</span>
          </button>
          <button
            onClick={() => setActiveTab("lorries")}
            className="px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>View Fleet</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards (7 Required Core Metrics) */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Lorries */}
        <div
          onClick={() => setActiveTab("lorries")}
          className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Fleet</span>
            <div className="p-2 bg-blue-950/60 text-blue-400 border border-blue-800/40 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalLorries}</span>
            <span className="text-xs text-zinc-400">Lorries Registered</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-zinc-800 text-zinc-400">
            <span>{availableLorries} Available</span>
            <span className="text-blue-400 font-semibold">{onTripLorries} On Trip</span>
          </div>
        </div>

        {/* Available Lorries */}
        <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Available For Trip</span>
            <div className="p-2 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{availableLorries}</span>
            <span className="text-xs text-zinc-400">Ready to dispatch</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] pt-2 border-t border-zinc-800 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Operational Capacity</span>
          </div>
        </div>

        {/* Lorries on Trip */}
        <div className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Lorries On Trip</span>
            <div className="p-2 bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 rounded-xl">
              <Route className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-400">{onTripLorries}</span>
            <span className="text-xs text-zinc-400">Active transit</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-zinc-800 text-zinc-400">
            <span>In Transit Routes</span>
            <span className="text-indigo-400 font-semibold">{totalTrips} Total Trips</span>
          </div>
        </div>

        {/* Total Trips */}
        <div
          onClick={() => setActiveTab("trips")}
          className="bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Logged Trips</span>
            <div className="p-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl group-hover:bg-zinc-700 group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalTrips}</span>
            <span className="text-xs text-zinc-400">Trips Recorded</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-zinc-800 text-blue-400 font-semibold">
            <span>View Trip History</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Trip Income */}
        <div className="bg-gradient-to-br from-blue-950/80 via-[#18181b] to-[#121215] border border-blue-900/40 text-white p-4 sm:p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-medium text-blue-300">Total Trip Revenue</span>
            <div className="p-2 bg-blue-900/40 text-blue-300 rounded-xl border border-blue-800/40">
              <ReceiptIndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
              {formatCurrency(totalIncome)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Calculated across all logged cargo freight</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-rose-950/80 via-[#18181b] to-[#121215] border border-rose-900/40 text-white p-4 sm:p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-medium text-rose-300">Total Operating Expenses</span>
            <div className="p-2 bg-rose-900/40 text-rose-300 rounded-xl border border-rose-800/40">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-rose-400 font-mono">
              {formatCurrency(totalExpenses)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Diesel, Tolls, Salaries, Repairs & Others</p>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-gradient-to-br from-emerald-950/80 via-[#18181b] to-[#121215] border border-emerald-900/40 text-white p-4 sm:p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-medium text-emerald-300">Net Fleet Profit</span>
            <div className="p-2 bg-emerald-900/40 text-emerald-300 rounded-xl border border-emerald-800/40">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-400 font-mono">
              {formatCurrency(totalProfit)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Net Profit Margin: {reports?.metrics?.profitMargin ?? 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Document Expiry Alerts (Prominent Required Feature) */}
      <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950/60 text-amber-400 border border-amber-800/40 rounded-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Document Expiry Reminders & Alerts
              </h3>
              <p className="text-xs text-zinc-400">
                Real-time compliance tracking for Insurance, Fitness Certificate (FC), Permit, and Pollution Certificate (PUC)
              </p>
            </div>
          </div>

          {/* Expiry Filter Tabs with Horizontal Scroll */}
          <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl text-xs font-medium border border-zinc-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setDocFilter("URGENT")}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                docFilter === "URGENT"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Action Required ({expiries?.urgentCount || 0})
            </button>
            <button
              onClick={() => setDocFilter("EXPIRED")}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                docFilter === "EXPIRED"
                  ? "bg-rose-600 text-white font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Expired ({expiries?.expiredCount || 0})
            </button>
            <button
              onClick={() => setDocFilter("EXPIRING_SOON")}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                docFilter === "EXPIRING_SOON"
                  ? "bg-amber-600 text-white font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Expiring Soon ({expiries?.expiringSoonCount || 0})
            </button>
            <button
              onClick={() => setDocFilter("ALL")}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                docFilter === "ALL"
                  ? "bg-zinc-800 text-white shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Documents ({expiries?.alerts.length || 0})
            </button>
          </div>
        </div>

        {/* Expiry Items List */}
        <div className="p-4 sm:p-6">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-zinc-200">All Fleet Documents in Order</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                No certificates requiring immediate renewal in this filter category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              {filteredAlerts.slice(0, 8).map((alert, idx) => (
                <div
                  key={`${alert.lorryId}-${alert.docType}-${idx}`}
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 sm:gap-3 transition-all ${
                    alert.status === "Expired"
                      ? "bg-rose-950/30 border-rose-900/50 text-rose-200"
                      : alert.status === "Expiring Soon"
                      ? "bg-amber-950/30 border-amber-900/50 text-amber-200"
                      : "bg-zinc-900/80 border-zinc-800 text-zinc-200"
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold font-mono text-xs sm:text-sm text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        {alert.vehicleNumber}
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">{alert.docTitle}</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-400 font-mono">{alert.formattedText}</p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge
                      status={alert.status}
                      daysRemaining={alert.daysRemaining}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredAlerts.length > 8 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setActiveTab("lorries")}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300"
              >
                View all {filteredAlerts.length} document records in Lorry Management →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visual Charts: Monthly Financials & Fleet Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-[#18181b] p-6 rounded-2xl border border-white/10 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Monthly Revenue vs Expenses</h3>
              <p className="text-xs text-zinc-400">Comparison of Freight Income and Operational Costs</p>
            </div>
            <button
              onClick={() => setActiveTab("reports")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Full Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val)), ""]}
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Availability Donut */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Fleet Deployment</h3>
            <p className="text-xs text-zinc-400">Real-time availability distribution</p>
          </div>
          <div className="h-48 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {fleetPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-300">Available</span>
              </span>
              <span className="font-bold text-white">{availableLorries} units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-zinc-300">On Active Trip</span>
              </span>
              <span className="font-bold text-white">{onTripLorries} units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-300">Inactive / Workshop</span>
              </span>
              <span className="font-bold text-white">{inactiveLorries} units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trips Table */}
      <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div>
            <h3 className="text-base font-bold text-white">Recent Logistics Trips</h3>
            <p className="text-xs text-zinc-400">Latest completed and in-progress transport orders</p>
          </div>
          <button
            onClick={() => setActiveTab("trips")}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>All Trips</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">S.No</th>
                <th className="py-3 px-4">Vehicle No</th>
                <th className="py-3 px-4">Cargo</th>
                <th className="py-3 px-4">Route (From → To)</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Total Ton</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    No trips logged yet. Click "Manage Trips" to create your first entry.
                  </td>
                </tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-blue-400">
                      {t.serial_number}
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-white">
                      {t.vehicle_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-200 truncate max-w-[150px]">
                      {t.cargo}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      <span className="truncate inline-block max-w-[180px]">
                        {t.from_location} → {t.to_location}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-300">{t.date}</td>
                    <td className="py-3 px-4 text-right font-medium font-mono">{t.total_ton} T</td>
                    <td className="py-3 px-4 text-right font-medium font-mono">₹{t.rate}</td>
                    <td className="py-3 px-4 text-right font-bold text-white font-mono">
                      {formatCurrency(t.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">
                      {t.profit !== undefined ? formatCurrency(t.profit) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
