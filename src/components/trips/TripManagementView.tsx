import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";
import { Trip, Lorry } from "../../types";
import { Modal } from "../common/Modal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { useToast } from "../../context/ToastContext";
import {
  Route,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Calendar,
  Truck,
  Ship,
  MapPin,
  Scale,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Info,
} from "lucide-react";

export const TripManagementView: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 3-Section Form Fields
  const [formData, setFormData] = useState({
    // Section 1: Main Trip Details
    serial_number: "",
    vehicle_id: "",
    weight_of_load: "",
    cargo: "",
    bill_number: "",

    // Section 2: Top Logistics
    date: new Date().toISOString().split("T")[0],
    logistics: "",
    vessel_name: "",
    from_location: "",
    to_location: "",

    // Section 3: Bottom Summary
    total_ton: "",
    rate: "",
    total_amount: 0,
    update_lorry_status: "On Trip",
  });

  // View Details Modal
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load Lorries list for the dropdown
  useEffect(() => {
    api.getLorries().then((res) => setLorries(res.lorries)).catch(console.error);
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const res = await api.getTrips({
        search: searchTerm,
        vehicle_id: selectedVehicle,
        from_date: fromDate,
        to_date: toDate,
        page,
        limit: 15,
      });
      setTrips(res.trips);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      toastError(err.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [selectedVehicle, fromDate, toDate, page]);

  // Real-time calculation of Total Amount = (Weight in Tons) * (Rate per Ton)
  useEffect(() => {
    const rawTon = parseFloat(formData.total_ton || formData.weight_of_load) || 0;
    const tons = rawTon >= 500 ? rawTon / 1000 : rawTon;
    const rate = parseFloat(formData.rate) || 0;
    const total = Number((tons * rate).toFixed(2));
    setFormData((prev) => ({ ...prev, total_amount: total }));
  }, [formData.weight_of_load, formData.total_ton, formData.rate]);

  const handleOpenAdd = async () => {
    setEditingTrip(null);
    let nextSno = "1";
    try {
      const res = await api.getNextSerialNumber();
      nextSno = res.nextSerialNumber || "1";
    } catch (e) {
      // fallback
    }

    let currentLorries = lorries;
    try {
      const lRes = await api.getLorries();
      if (lRes?.lorries) {
        currentLorries = lRes.lorries;
        setLorries(currentLorries);
      }
    } catch (e) {
      // fallback to current state
    }

    const defaultVehicle = currentLorries.length > 0 ? String(currentLorries[0].id) : "";

    setFormData({
      serial_number: nextSno,
      vehicle_id: defaultVehicle,
      weight_of_load: "",
      cargo: "",
      bill_number: "",
      date: new Date().toISOString().split("T")[0],
      logistics: "",
      vessel_name: "",
      from_location: "",
      to_location: "",
      total_ton: "",
      rate: "",
      total_amount: 0,
      update_lorry_status: "On Trip",
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (trip: Trip) => {
    setEditingTrip(trip);
    let tonVal = trip.total_ton ? trip.total_ton.toString() : "";
    if (!tonVal && trip.weight_of_load) {
      tonVal = (trip.weight_of_load >= 500 ? trip.weight_of_load / 1000 : trip.weight_of_load).toString();
    }
    setFormData({
      serial_number: trip.serial_number,
      vehicle_id: String(trip.vehicle_id),
      weight_of_load: tonVal,
      cargo: trip.cargo,
      bill_number: trip.bill_number,
      date: trip.date,
      logistics: trip.logistics || "",
      vessel_name: trip.vessel_name || "",
      from_location: trip.from_location,
      to_location: trip.to_location,
      total_ton: tonVal,
      rate: trip.rate.toString(),
      total_amount: trip.total_amount,
      update_lorry_status: "On Trip",
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.serial_number.trim()) {
      toastError("Serial Number is required.");
      return;
    }
    if (!formData.vehicle_id) {
      toastError("Please select a vehicle. If you haven't added any lorries yet, add one under 'Lorries' first.");
      return;
    }
    if (!formData.cargo.trim()) {
      toastError("Cargo description is required.");
      return;
    }
    if (!formData.bill_number.trim()) {
      toastError("Bill Number is required.");
      return;
    }
    if (!formData.from_location.trim() || !formData.to_location.trim()) {
      toastError("Origin (From) and Destination (To) locations are required.");
      return;
    }

    const weight = parseFloat(formData.weight_of_load || formData.total_ton);
    const ton = parseFloat(formData.total_ton || formData.weight_of_load);
    const rate = parseFloat(formData.rate);

    if (isNaN(weight) || weight <= 0) {
      toastError("Weight of load must be a positive number.");
      return;
    }
    if (isNaN(ton) || ton <= 0) {
      toastError("Total Ton must be a positive number.");
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      toastError("Rate per ton must be a positive number.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        serial_number: formData.serial_number.trim(),
        vehicle_id: String(formData.vehicle_id),
        weight_of_load: weight,
        cargo: formData.cargo.trim(),
        bill_number: formData.bill_number.trim(),
        date: formData.date,
        logistics: formData.logistics.trim(),
        vessel_name: formData.vessel_name.trim() || "Direct Transit",
        from_location: formData.from_location.trim(),
        to_location: formData.to_location.trim(),
        total_ton: ton,
        rate,
        update_lorry_status: formData.update_lorry_status,
      };

      if (editingTrip) {
        await api.updateTrip(editingTrip.id, payload);
        toastSuccess(`Trip ${formData.serial_number} updated successfully.`);
      } else {
        await api.createTrip(payload);
        toastSuccess(`Trip ${formData.serial_number} logged successfully.`);
      }

      setIsFormOpen(false);
      loadTrips();
    } catch (err: any) {
      toastError(err.message || "Failed to save trip.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteTrip(deleteTarget.id);
      toastSuccess(`Trip ${deleteTarget.serial_number} deleted.`);
      setDeleteTarget(null);
      loadTrips();
    } catch (err: any) {
      toastError(err.message || "Failed to delete trip.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTrips();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-500" />
            <span>Trip Management</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log logistics orders, cargo freight calculations, route tracking, and automatic billing values.
          </p>
        </div>
        <button
          id="new-trip-btn"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs shadow-blue-500/20 flex items-center justify-center gap-2 transition-colors self-stretch sm:self-auto shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Trip Entry</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-[#18181b] p-3 sm:p-4 rounded-xl border border-white/10 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="trip-search-input"
              type="text"
              placeholder="Search vehicle, bill, cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </form>

          {/* Vehicle Dropdown Filter */}
          <div>
            <select
              value={selectedVehicle}
              onChange={(e) => {
                setSelectedVehicle(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Lorries ({lorries.length})</option>
              {lorries.map((l) => (
                <option key={l.id} value={l.id.toString()}>
                  {l.vehicle_number} ({l.vehicle_type})
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
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

          {/* To Date */}
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

        {/* Active Filter summary */}
        {(searchTerm || selectedVehicle !== "ALL" || fromDate || toDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pt-2 border-t border-zinc-800">
            <span>
              Showing filtered results: <b className="text-white">{totalCount}</b> trips found
            </span>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedVehicle("ALL");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Trips Table Display (Matching Specific Section 5 Columns) */}
      <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-3">S.No</th>
                <th className="py-3.5 px-3">Vehicle No</th>
                <th className="py-3.5 px-3 text-right">Weight (Ton)</th>
                <th className="py-3.5 px-3">Cargo</th>
                <th className="py-3.5 px-3">Bill No</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3">Logistics</th>
                <th className="py-3.5 px-3">Vessel Name</th>
                <th className="py-3.5 px-3">From</th>
                <th className="py-3.5 px-3">To</th>
                <th className="py-3.5 px-3 text-right">Rate (₹/Ton)</th>
                <th className="py-3.5 px-3 text-right">Total Amount</th>
                <th className="py-3.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-zinc-500">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading trips catalog...</span>
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-zinc-500">
                    No trip records match the current filters. Click "New Trip Entry" to log a trip.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-zinc-800/40 transition-colors">
                    {/* S.No */}
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {trip.serial_number}
                    </td>

                    {/* Vehicle No */}
                    <td className="py-3.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                      {trip.vehicle_number}
                    </td>

                    {/* Weight in Tons */}
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-zinc-200 whitespace-nowrap">
                      {(() => {
                        const raw = Number(trip.total_ton || trip.weight_of_load || 0);
                        const tons = raw >= 500 ? raw / 1000 : raw;
                        return tons > 0 ? `${tons} T` : "-";
                      })()}
                    </td>

                    {/* Cargo */}
                    <td className="py-3.5 px-3 font-medium text-zinc-200 max-w-[130px] truncate">
                      {trip.cargo}
                    </td>

                    {/* Bill No */}
                    <td className="py-3.5 px-3 font-mono text-zinc-300 whitespace-nowrap">
                      {trip.bill_number}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-3 whitespace-nowrap text-zinc-400">
                      {trip.date}
                    </td>

                    {/* Logistics */}
                    <td className="py-3.5 px-3 text-zinc-300 max-w-[110px] truncate">
                      {trip.logistics || "-"}
                    </td>

                    {/* Vessel Name */}
                    <td className="py-3.5 px-3 text-zinc-400 max-w-[120px] truncate">
                      {trip.vessel_name || "-"}
                    </td>

                    {/* From */}
                    <td className="py-3.5 px-3 text-zinc-400 max-w-[110px] truncate">
                      {trip.from_location}
                    </td>

                    {/* To */}
                    <td className="py-3.5 px-3 text-zinc-400 max-w-[110px] truncate">
                      {trip.to_location}
                    </td>

                    {/* Rate per Ton */}
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-zinc-200 whitespace-nowrap">
                      ₹{Number(trip.rate).toLocaleString("en-IN")}/Ton
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatCurrency(trip.total_amount)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Trip Details"
                          onClick={() => setViewTrip(trip)}
                          className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-blue-950/40 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit Trip Entry"
                          onClick={() => handleOpenEdit(trip)}
                          className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-amber-950/40 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete Trip Entry"
                          onClick={() => setDeleteTarget(trip)}
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
              Showing page <b className="text-white">{page}</b> of <b className="text-white">{totalPages}</b> ({totalCount} total trips)
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

      {/* Trip Entry Form Modal with 3 Explicitly Grouped Sections */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTrip ? `Edit Trip Entry (${editingTrip.serial_number})` : "New Logistics Trip Entry"}
        subtitle="Complete the 3-section logistics manifest. Total amount is computed automatically."
        maxWidth="3xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* SECTION 1: Main Trip Details */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 text-xs font-bold text-zinc-200 uppercase tracking-wider">
              <Truck className="w-4 h-4 text-blue-500" />
              <span>Section 1: Main Trip Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* S.No */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Serial Number (S.No) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Vehicle No */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Vehicle No (Lorry) *
                </label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Lorry --</option>
                  {lorries.map((l) => (
                    <option key={l.id} value={l.id.toString()}>
                      {l.vehicle_number} ({l.vehicle_type} - {l.capacity}T)
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight of Load in Tons */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Weight of Load (Tons) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder="e.g. 46.00"
                  value={formData.weight_of_load}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      weight_of_load: val,
                      total_ton: val,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cargo */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Cargo Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Imported Raw Cotton Bales / Thermal Coal"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bill No */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Bill No / Lading Ref *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BL-88091"
                  value={formData.bill_number}
                  onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Top Logistics */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 text-xs font-bold text-zinc-200 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span>Section 2: Top Logistics & Transit Route</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Trip Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Logistics */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Logistics
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRL / SafeX / Port"
                  value={formData.logistics}
                  onChange={(e) => setFormData({ ...formData, logistics: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Vessel Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Vessel Name / Consignor
                </label>
                <input
                  type="text"
                  placeholder="e.g. MV Maersk Chennai"
                  value={formData.vessel_name}
                  onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* From */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  From (Origin) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chennai Sea Port Dock-4"
                  value={formData.from_location}
                  onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* To */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  To (Destination) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coimbatore Textile Mills"
                  value={formData.to_location}
                  onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Bottom Summary */}
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/40 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-200 uppercase tracking-wider">
                <Scale className="w-4 h-4 text-blue-400" />
                <span>Section 3: Freight Rate & Tonnage Computation</span>
              </div>
              <span className="text-[11px] font-mono text-blue-300">Formula: Weight (Tons) × Rate (₹/Ton)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              {/* Total Ton */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Total Weight in Tons (T) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder="e.g. 46.00"
                  value={formData.total_ton}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      total_ton: val,
                      weight_of_load: val,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">Weight entered in Metric Tons (T)</span>
              </div>

              {/* Rate per Ton */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Rate Per Ton (₹/Ton) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="e.g. 500"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">Rate charged per 1 Metric Ton</span>
              </div>

              {/* Total Amount */}
              <div className="bg-zinc-900 p-3 rounded-xl border border-blue-900/60 shadow-xs">
                <label className="block text-[11px] font-bold text-blue-400 uppercase">
                  Total Freight Amount (₹)
                </label>
                <p className="text-xl font-bold font-mono text-white mt-1">
                  {formatCurrency(formData.total_amount)}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                  {formData.total_ton || "0"} T × ₹{formData.rate || "0"}/Ton
                </p>
              </div>
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
              {formLoading ? "Saving Trip..." : editingTrip ? "Update Trip Entry" : "Save Trip Manifest"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Trip Details Modal */}
      {viewTrip && (
        <Modal
          isOpen={Boolean(viewTrip)}
          onClose={() => setViewTrip(null)}
          title={`Trip Manifest: ${viewTrip.serial_number}`}
          subtitle={`Vehicle ${viewTrip.vehicle_number} | Bill Ref: ${viewTrip.bill_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <div>
                <p className="text-zinc-400">Vehicle No</p>
                <p className="font-bold text-white font-mono mt-0.5">{viewTrip.vehicle_number}</p>
              </div>
              <div>
                <p className="text-zinc-400">Date of Dispatch</p>
                <p className="font-bold text-white mt-0.5">{viewTrip.date}</p>
              </div>
              <div>
                <p className="text-zinc-400">Bill Number</p>
                <p className="font-bold text-white font-mono mt-0.5">{viewTrip.bill_number}</p>
              </div>
              <div>
                <p className="text-zinc-400">Total Freight</p>
                <p className="font-bold text-blue-400 font-mono mt-0.5">{formatCurrency(viewTrip.total_amount)}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-2">
              <h4 className="font-bold text-zinc-200 uppercase tracking-wider">Logistics & Route</h4>
              <p className="text-zinc-300"><b>Cargo:</b> {viewTrip.cargo}</p>
              {viewTrip.logistics && (
                <p className="text-zinc-300"><b>Logistics:</b> {viewTrip.logistics}</p>
              )}
              <p className="text-zinc-300"><b>Vessel Name:</b> {viewTrip.vessel_name || "Direct Transport"}</p>
              <div className="flex items-center gap-2 pt-1 font-medium text-zinc-300">
                <span className="p-1 bg-zinc-800 rounded border border-zinc-700 font-semibold text-white">{viewTrip.from_location}</span>
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <span className="p-1 bg-zinc-800 rounded border border-zinc-700 font-semibold text-white">{viewTrip.to_location}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-2">
              <h4 className="font-bold text-zinc-200 uppercase tracking-wider">Weight & Freight Rate Calculation</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2 border-t border-zinc-800 text-zinc-300">
                <div>
                  <span className="text-zinc-400 block text-[11px]">Weight in Tons:</span>
                  <b className="text-white font-mono text-sm">
                    {(() => {
                      const raw = Number(viewTrip.total_ton || viewTrip.weight_of_load || 0);
                      const ton = raw >= 500 ? raw / 1000 : raw;
                      return `${ton} Tons`;
                    })()}
                  </b>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Rate / Ton:</span>
                  <b className="text-emerald-400 font-mono text-sm">₹{viewTrip.rate} / Ton</b>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Total Amount:</span>
                  <b className="text-blue-400 font-mono text-sm">{formatCurrency(viewTrip.total_amount)}</b>
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
        itemName={deleteTarget ? `${deleteTarget.serial_number} (${deleteTarget.cargo} - ${deleteTarget.vehicle_number})` : ""}
        itemType="Trip Record"
        isLoading={deleteLoading}
      />
    </div>
  );
};
