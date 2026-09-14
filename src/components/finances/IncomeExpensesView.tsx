import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { IncomeExpense, Lorry } from "../../types";
import { Modal } from "../common/Modal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { useToast } from "../../context/ToastContext";
import {
  ReceiptIndianRupee,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Fuel,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calculator,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export const IncomeExpensesView: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [records, setRecords] = useState<IncomeExpense[]>([]);
  const [summary, setSummary] = useState<any>({
    totalIncome: 0,
    totalDiesel: 0,
    totalToll: 0,
    totalSalary: 0,
    totalLoading: 0,
    totalRepair: 0,
    totalOther: 0,
    totalExpenses: 0,
    totalProfit: 0,
  });
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [unlinkedTrips, setUnlinkedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncomeExpense | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    trip_id: "",
    trip_income: "",
    diesel_expense: "",
    toll_expense: "",
    driver_salary: "",
    loading_unloading_expense: "",
    repair_expense: "",
    other_expense: "",
    // Auto computed
    computedTotalExpenses: 0,
    computedProfit: 0,
  });

  // View Details Modal
  const [viewRecord, setViewRecord] = useState<IncomeExpense | null>(null);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<IncomeExpense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    api.getLorries().then((res) => setLorries(res.lorries)).catch(console.error);
  }, []);

  const loadFinances = async () => {
    setLoading(true);
    try {
      const [finRes, unlinkedRes] = await Promise.all([
        api.getFinances({
          search: searchTerm,
          vehicle_id: selectedVehicle,
          from_date: fromDate,
          to_date: toDate,
          page,
          limit: 15,
        }),
        api.getAvailableTrips(),
      ]);
      setRecords(finRes.records);
      setSummary(finRes.summary);
      setTotalPages(finRes.totalPages || 1);
      setTotalCount(finRes.total || 0);
      setUnlinkedTrips(unlinkedRes.availableTrips || []);
    } catch (err: any) {
      toastError(err.message || "Failed to load financial records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, [selectedVehicle, fromDate, toDate, page]);

  // Real-time automatic calculations:
  // Total Expenses = Diesel + Toll + Driver Salary + Loading/Unloading + Repair + Other
  // Profit = Trip Income - Total Expenses
  useEffect(() => {
    const income = parseFloat(formData.trip_income) || 0;
    const diesel = parseFloat(formData.diesel_expense) || 0;
    const toll = parseFloat(formData.toll_expense) || 0;
    const salary = parseFloat(formData.driver_salary) || 0;
    const loading = parseFloat(formData.loading_unloading_expense) || 0;
    const repair = parseFloat(formData.repair_expense) || 0;
    const other = parseFloat(formData.other_expense) || 0;

    const totalExp = Number((diesel + toll + salary + loading + repair + other).toFixed(2));
    const profit = Number((income - totalExp).toFixed(2));

    setFormData((prev) => ({
      ...prev,
      computedTotalExpenses: totalExp,
      computedProfit: profit,
    }));
  }, [
    formData.trip_income,
    formData.diesel_expense,
    formData.toll_expense,
    formData.driver_salary,
    formData.loading_unloading_expense,
    formData.repair_expense,
    formData.other_expense,
  ]);

  const handleOpenAdd = async () => {
    setEditingRecord(null);
    let tripsList = unlinkedTrips;

    try {
      const res = await api.getAvailableTrips();
      if (res && res.availableTrips) {
        tripsList = res.availableTrips;
        setUnlinkedTrips(tripsList);
      }
    } catch {
      // fallback
    }

    const initialTrip = tripsList.length > 0 ? tripsList[0] : null;
    const initialTripId = initialTrip ? initialTrip.id.toString() : "";
    const initialTripIncome = initialTrip && initialTrip.total_amount !== undefined ? initialTrip.total_amount.toString() : "0";

    setFormData({
      trip_id: initialTripId,
      trip_income: initialTripIncome,
      diesel_expense: initialTrip?.diesel_expense ? initialTrip.diesel_expense.toString() : "",
      toll_expense: initialTrip?.toll_expense ? initialTrip.toll_expense.toString() : "",
      driver_salary: initialTrip?.driver_salary ? initialTrip.driver_salary.toString() : "",
      loading_unloading_expense: initialTrip?.loading_unloading_expense ? initialTrip.loading_unloading_expense.toString() : "",
      repair_expense: initialTrip?.repair_expense ? initialTrip.repair_expense.toString() : "",
      other_expense: initialTrip?.other_expense ? initialTrip.other_expense.toString() : "",
      computedTotalExpenses: initialTrip?.total_expenses || 0,
      computedProfit: (parseFloat(initialTripIncome) || 0) - (initialTrip?.total_expenses || 0),
    });
    setIsFormOpen(true);
  };

  const handleTripSelectChange = (tripIdStr: string) => {
    const matched = unlinkedTrips.find((t) => t.id.toString() === tripIdStr);
    if (matched) {
      const tripInc = matched.total_amount !== undefined ? matched.total_amount.toString() : "0";
      setFormData((prev) => ({
        ...prev,
        trip_id: tripIdStr,
        trip_income: tripInc,
        diesel_expense: matched.diesel_expense ? matched.diesel_expense.toString() : "",
        toll_expense: matched.toll_expense ? matched.toll_expense.toString() : "",
        driver_salary: matched.driver_salary ? matched.driver_salary.toString() : "",
        loading_unloading_expense: matched.loading_unloading_expense ? matched.loading_unloading_expense.toString() : "",
        repair_expense: matched.repair_expense ? matched.repair_expense.toString() : "",
        other_expense: matched.other_expense ? matched.other_expense.toString() : "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        trip_id: tripIdStr,
      }));
    }
  };

  const handleOpenEdit = (rec: IncomeExpense) => {
    setEditingRecord(rec);
    setFormData({
      trip_id: rec.trip_id.toString(),
      trip_income: rec.trip_income.toString(),
      diesel_expense: rec.diesel_expense.toString(),
      toll_expense: rec.toll_expense.toString(),
      driver_salary: rec.driver_salary.toString(),
      loading_unloading_expense: rec.loading_unloading_expense.toString(),
      repair_expense: rec.repair_expense.toString(),
      other_expense: rec.other_expense.toString(),
      computedTotalExpenses: rec.total_expenses,
      computedProfit: rec.profit,
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.trip_id) {
      toastError("Please select a trip.");
      return;
    }

    const income = parseFloat(formData.trip_income);
    if (isNaN(income) || income < 0) {
      toastError("Trip income cannot be negative.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        trip_id: String(formData.trip_id),
        trip_income: income,
        diesel_expense: parseFloat(formData.diesel_expense) || 0,
        toll_expense: parseFloat(formData.toll_expense) || 0,
        driver_salary: parseFloat(formData.driver_salary) || 0,
        loading_unloading_expense: parseFloat(formData.loading_unloading_expense) || 0,
        repair_expense: parseFloat(formData.repair_expense) || 0,
        other_expense: parseFloat(formData.other_expense) || 0,
      };

      if (editingRecord) {
        await api.updateFinanceRecord(editingRecord.id, payload);
        toastSuccess("Financial record updated successfully.");
      } else {
        await api.createFinanceRecord(payload);
        toastSuccess("Financial expenses logged successfully.");
      }

      setIsFormOpen(false);
      loadFinances();
    } catch (err: any) {
      toastError(err.message || "Failed to save financial record.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteFinanceRecord(deleteTarget.id);
      toastSuccess("Financial record removed.");
      setDeleteTarget(null);
      loadFinances();
    } catch (err: any) {
      toastError(err.message || "Failed to delete financial record.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadFinances();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ReceiptIndianRupee className="w-6 h-6 text-blue-500" />
            <span>Income & Expenses (Per Trip)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log operational cost items (diesel, tolls, salaries, maintenance). Total expenses and net profit are enforced automatically.
          </p>
        </div>
        <button
          id="add-finance-btn"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs shadow-blue-500/20 flex items-center justify-center gap-2 transition-colors self-stretch sm:self-auto shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Trip Expenses</span>
        </button>
      </div>

      {/* Financial Overview Metrics Bar */}
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-[#18181b] p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-xs">
          <p className="text-[11px] font-medium text-zinc-400">Gross Freight Income</p>
          <p className="text-base sm:text-lg font-bold text-white mt-1">{formatCurrency(summary.totalIncome)}</p>
        </div>
        <div className="bg-[#18181b] p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-xs">
          <p className="text-[11px] font-medium text-zinc-400">Diesel Fuel Cost</p>
          <p className="text-base sm:text-lg font-bold text-amber-400 mt-1">{formatCurrency(summary.totalDiesel)}</p>
        </div>
        <div className="bg-[#18181b] p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-xs">
          <p className="text-[11px] font-medium text-zinc-400">Driver Salaries & Bata</p>
          <p className="text-base sm:text-lg font-bold text-blue-400 mt-1">{formatCurrency(summary.totalSalary)}</p>
        </div>
        <div className="bg-[#18181b] p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-xs">
          <p className="text-[11px] font-medium text-zinc-400">Total Expenses</p>
          <p className="text-base sm:text-lg font-bold text-rose-400 mt-1">{formatCurrency(summary.totalExpenses)}</p>
        </div>
        <div className="bg-[#18181b] p-3.5 sm:p-4 rounded-xl border border-white/10 shadow-xs col-span-1 min-[440px]:col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-zinc-400">Net Fleet Profit</p>
          <p className="text-base sm:text-lg font-bold text-emerald-400 mt-1">{formatCurrency(summary.totalProfit)}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#18181b] p-3 sm:p-4 rounded-xl border border-white/10 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="finance-search-input"
              type="text"
              placeholder="Search by trip, bill, vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </form>

          <div>
            <select
              value={selectedVehicle}
              onChange={(e) => {
                setSelectedVehicle(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Fleet Lorries</option>
              {lorries.map((l) => (
                <option key={l.id} value={l.id.toString()}>
                  {l.vehicle_number}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Financial Records Table Display (Section 6 Columns) */}
      <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-3">Trip</th>
                <th className="py-3.5 px-3 text-right">Trip Income</th>
                <th className="py-3.5 px-3 text-right">Diesel</th>
                <th className="py-3.5 px-3 text-right">Toll</th>
                <th className="py-3.5 px-3 text-right">Driver Salary</th>
                <th className="py-3.5 px-3 text-right">Loading/Unloading</th>
                <th className="py-3.5 px-3 text-right">Repair</th>
                <th className="py-3.5 px-3 text-right">Other</th>
                <th className="py-3.5 px-3 text-right font-bold text-rose-400">Total Expenses</th>
                <th className="py-3.5 px-3 text-right font-bold text-emerald-400">Profit</th>
                <th className="py-3.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading financial records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500">
                    No financial records found. Click "Log Trip Expenses" to add cost entries.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-800/40 transition-colors">
                    {/* Trip Info */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-blue-400">{rec.serial_number}</span>
                        <span className="text-zinc-500">|</span>
                        <span className="font-mono text-white font-semibold">{rec.vehicle_number}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate max-w-[140px]">{rec.cargo}</p>
                    </td>

                    {/* Trip Income */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatCurrency(rec.trip_income)}
                    </td>

                    {/* Diesel */}
                    <td className="py-3.5 px-3 text-right font-mono text-amber-400 whitespace-nowrap">
                      ₹{rec.diesel_expense.toLocaleString("en-IN")}
                    </td>

                    {/* Toll */}
                    <td className="py-3.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                      ₹{rec.toll_expense.toLocaleString("en-IN")}
                    </td>

                    {/* Driver Salary */}
                    <td className="py-3.5 px-3 text-right font-mono text-blue-400 whitespace-nowrap">
                      ₹{rec.driver_salary.toLocaleString("en-IN")}
                    </td>

                    {/* Loading/Unloading */}
                    <td className="py-3.5 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                      ₹{rec.loading_unloading_expense.toLocaleString("en-IN")}
                    </td>

                    {/* Repair */}
                    <td className="py-3.5 px-3 text-right font-mono text-rose-400 whitespace-nowrap">
                      ₹{rec.repair_expense.toLocaleString("en-IN")}
                    </td>

                    {/* Other */}
                    <td className="py-3.5 px-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                      ₹{rec.other_expense.toLocaleString("en-IN")}
                    </td>

                    {/* Total Expenses (Auto Computed) */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap bg-rose-950/20">
                      {formatCurrency(rec.total_expenses)}
                    </td>

                    {/* Profit (Auto Computed) */}
                    <td className={`py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap ${rec.profit >= 0 ? "text-emerald-400 bg-emerald-950/20" : "text-rose-400 bg-rose-950/20"}`}>
                      {formatCurrency(rec.profit)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Details"
                          onClick={() => setViewRecord(rec)}
                          className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-blue-950/40 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit Finance Entry"
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-amber-950/40 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete Finance Entry"
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-t border-zinc-800 text-xs">
            <span className="text-zinc-400">
              Showing page <b className="text-white">{page}</b> of <b className="text-white">{totalPages}</b> ({totalCount} total records)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Financial Record Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingRecord ? `Edit Expenses for Trip ${editingRecord.serial_number}` : "Log Trip Income & Operational Expenses"}
        subtitle="Automatic calculation rules: Total Expenses = Sum(all expenses) | Profit = Trip Income - Total Expenses"
        maxWidth="3xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Trip Selection & Gross Revenue */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              1. Trip Reference & Freight Income
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Select Trip Manifest *
                </label>
                {editingRecord ? (
                  <input
                    type="text"
                    disabled
                    value={`${editingRecord.serial_number} (${editingRecord.vehicle_number} - ${editingRecord.cargo})`}
                    className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-mono font-semibold"
                  />
                ) : (
                  <div>
                    <select
                      id="select-trip-manifest"
                      required
                      value={formData.trip_id}
                      onChange={(e) => handleTripSelectChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {unlinkedTrips.length === 0 ? (
                        <option value="" disabled>No trips found — add a trip first in Trips tab</option>
                      ) : (
                        <>
                          <option value="" disabled>-- Select a Trip Manifest --</option>
                          {unlinkedTrips.map((t) => (
                            <option key={t.id} value={t.id.toString()}>
                              {t.serial_number} • {t.vehicle_number} ({t.cargo} | Bill: {t.bill_number}) • ₹{t.total_amount ? Number(t.total_amount).toLocaleString("en-IN") : 0} {t.total_expenses && t.total_expenses > 0 ? `(Logged: ₹${Number(t.total_expenses).toLocaleString("en-IN")})` : '(Pending Expenses)'}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {unlinkedTrips.length === 0 && (
                      <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>No trips available. Please record a trip first in the <strong>Trips</strong> tab.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Trip Freight Income (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 45325"
                  value={formData.trip_income}
                  onChange={(e) => setFormData({ ...formData, trip_income: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Expense Breakdown Inputs */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-400" />
              <span>2. Operational Expense Items (₹)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Diesel */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Diesel Fuel Expense (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.diesel_expense}
                  onChange={(e) => setFormData({ ...formData, diesel_expense: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Toll */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Toll Plaza Charges (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.toll_expense}
                  onChange={(e) => setFormData({ ...formData, toll_expense: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Driver Salary */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Driver Salary & Bata (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.driver_salary}
                  onChange={(e) => setFormData({ ...formData, driver_salary: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Loading / Unloading */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Loading / Unloading Hamali (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.loading_unloading_expense}
                  onChange={(e) => setFormData({ ...formData, loading_unloading_expense: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Repair */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Puncture & En-route Repair (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.repair_expense}
                  onChange={(e) => setFormData({ ...formData, repair_expense: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Other */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Other Miscellaneous Costs (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={formData.other_expense}
                  onChange={(e) => setFormData({ ...formData, other_expense: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Automatic Calculation Summary Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white shadow-md">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Computed Total Expenses (Auto)</p>
              <p className="text-xl font-bold font-mono text-rose-400 mt-1">
                {formatCurrency(formData.computedTotalExpenses)}
              </p>
              <p className="text-[10px] text-zinc-500">Diesel + Toll + Salary + Loading + Repair + Other</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 font-medium">Computed Net Profit (Auto)</p>
              <p className={`text-xl font-bold font-mono mt-1 ${formData.computedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(formData.computedProfit)}
              </p>
              <p className="text-[10px] text-zinc-500">Trip Income – Total Expenses</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-xs shadow-blue-500/20 transition-colors"
            >
              {formLoading ? "Saving..." : editingRecord ? "Update Financials" : "Save Financial Record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Financial Details Modal */}
      {viewRecord && (
        <Modal
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          title={`Financial Manifest: ${viewRecord.serial_number}`}
          subtitle={`Vehicle ${viewRecord.vehicle_number} | Dispatch Date: ${viewRecord.trip_date}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Top Cards */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div>
                <p className="text-zinc-400">Freight Revenue</p>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {formatCurrency(viewRecord.trip_income)}
                </p>
              </div>
              <div>
                <p className="text-zinc-400">Total Expenses</p>
                <p className="text-base font-bold text-rose-400 font-mono mt-0.5">
                  {formatCurrency(viewRecord.total_expenses)}
                </p>
              </div>
              <div>
                <p className="text-zinc-400">Net Profit</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {formatCurrency(viewRecord.profit)}
                </p>
              </div>
            </div>

            {/* Expense Breakdown List */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
              <h4 className="font-bold text-zinc-200 uppercase tracking-wider">Itemized Cost Structure</h4>
              <div className="divide-y divide-zinc-800">
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Diesel Fuel</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.diesel_expense.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Toll Gate Passes</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.toll_expense.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Driver Salary & Daily Bata</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.driver_salary.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Loading & Unloading Hamali</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.loading_unloading_expense.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Repairs & Maintenance</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.repair_expense.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Other Overhead Expenses</span>
                  <span className="font-mono font-semibold text-white">₹{viewRecord.other_expense.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        itemName={deleteTarget ? `Financial record for Trip ${deleteTarget.serial_number} (${deleteTarget.vehicle_number})` : ""}
        itemType="Financial Record"
        isLoading={deleteLoading}
      />
    </div>
  );
};
