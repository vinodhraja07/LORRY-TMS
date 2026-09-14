import React, { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";
import { Lorry, LorryStatus } from "../../types";
import { StatusBadge } from "../common/StatusBadge";
import { Modal } from "../common/Modal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { useToast } from "../../context/ToastContext";
import {
  Truck,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";

const STANDARD_VEHICLE_TYPES = [
  "10-wheeler tipper",
  "12-wheeler tipper",
  "14-wheeler tipper",
];

export const LorryManagementView: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLorry, setEditingLorry] = useState<Lorry | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [vehicleTypeMode, setVehicleTypeMode] = useState<string>("10-wheeler tipper");

  // Form Fields
  const [formData, setFormData] = useState({
    vehicle_number: "",
    vehicle_type: "10-wheeler tipper",
    capacity: "",
    insurance_expiry: "",
    fc_expiry: "",
    permit_expiry: "",
    pollution_expiry: "",
    status: "Available" as LorryStatus,
    notes: "",
  });

  // View Details Modal State
  const [viewLorry, setViewLorry] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<Lorry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadLorries = async () => {
    setLoading(true);
    try {
      const res = await api.getLorries({ search: searchTerm, status: statusFilter });
      setLorries(res.lorries);
    } catch (err: any) {
      toastError(err.message || "Failed to load lorry fleet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLorries();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLorries();
  };

  const handleOpenAdd = () => {
    setEditingLorry(null);
    setVehicleTypeMode("10-wheeler tipper");
    setFormData({
      vehicle_number: "",
      vehicle_type: "10-wheeler tipper",
      capacity: "",
      insurance_expiry: "",
      fc_expiry: "",
      permit_expiry: "",
      pollution_expiry: "",
      status: "Available",
      notes: "",
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (lorry: Lorry) => {
    setEditingLorry(lorry);
    const isStandard = STANDARD_VEHICLE_TYPES.includes(lorry.vehicle_type);
    setVehicleTypeMode(isStandard ? lorry.vehicle_type : "Manual entry");
    setFormData({
      vehicle_number: lorry.vehicle_number,
      vehicle_type: lorry.vehicle_type,
      capacity: lorry.capacity.toString(),
      insurance_expiry: lorry.insurance_expiry,
      fc_expiry: lorry.fc_expiry,
      permit_expiry: lorry.permit_expiry,
      pollution_expiry: lorry.pollution_expiry,
      status: lorry.status,
      notes: lorry.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleOpenView = async (lorry: Lorry) => {
    setViewLoading(true);
    try {
      const res = await api.getLorry(lorry.id);
      setViewLorry(res);
    } catch (err: any) {
      toastError(err.message || "Could not fetch lorry details");
    } finally {
      setViewLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.vehicle_number.trim()) {
      toastError("Vehicle Number is required.");
      return;
    }
    const capNum = parseFloat(formData.capacity);
    if (isNaN(capNum) || capNum <= 0) {
      toastError("Load capacity must be a positive number (tons).");
      return;
    }
    if (
      !formData.insurance_expiry ||
      !formData.fc_expiry ||
      !formData.permit_expiry ||
      !formData.pollution_expiry
    ) {
      toastError("All 4 document expiry dates are required for statutory fleet compliance.");
      return;
    }

    setFormLoading(true);
    try {
      if (editingLorry) {
        await api.updateLorry(editingLorry.id, {
          vehicle_number: formData.vehicle_number.trim().toUpperCase(),
          vehicle_type: formData.vehicle_type.trim(),
          capacity: capNum,
          insurance_expiry: formData.insurance_expiry,
          fc_expiry: formData.fc_expiry,
          permit_expiry: formData.permit_expiry,
          pollution_expiry: formData.pollution_expiry,
          status: formData.status,
          notes: formData.notes,
        });
        toastSuccess(`Lorry ${formData.vehicle_number.toUpperCase()} updated successfully.`);
      } else {
        await api.createLorry({
          vehicle_number: formData.vehicle_number.trim().toUpperCase(),
          vehicle_type: formData.vehicle_type.trim(),
          capacity: capNum,
          insurance_expiry: formData.insurance_expiry,
          fc_expiry: formData.fc_expiry,
          permit_expiry: formData.permit_expiry,
          pollution_expiry: formData.pollution_expiry,
          status: formData.status,
          notes: formData.notes,
        });
        toastSuccess(`Lorry ${formData.vehicle_number.toUpperCase()} added to fleet.`);
      }
      setIsFormOpen(false);
      loadLorries();
    } catch (err: any) {
      toastError(err.message || "Failed to save lorry record.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteLorry(deleteTarget.id);
      toastSuccess(`Lorry ${deleteTarget.vehicle_number} and its linked trips were deleted.`);
      setDeleteTarget(null);
      loadLorries();
    } catch (err: any) {
      toastError(err.message || "Failed to delete lorry.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            <span>Lorry Fleet Management</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Register vehicles, manage load capacities, track statutory renewals, and inspect trip logs.
          </p>
        </div>
        <button
          id="add-new-lorry-btn"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs shadow-blue-500/20 flex items-center justify-center gap-2 transition-colors self-stretch sm:self-auto shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Lorry</span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#18181b] p-3 sm:p-4 rounded-xl border border-white/10 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="lorry-search-input"
              type="text"
              placeholder="Search by vehicle number or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-xs font-medium bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 border border-zinc-700 transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto scrollbar-none py-1">
          {["ALL", "Available", "On Trip", "Inactive"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-xs font-semibold shadow-blue-500/20"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {st === "ALL" ? "All Fleet" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Lorries Fleet Table & Document Reminders */}
      <div className="bg-[#18181b] rounded-2xl border border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Vehicle Number</th>
                <th className="py-3.5 px-4">Type & Capacity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Statutory Document Expiry Reminders</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading fleet records...</span>
                  </td>
                </tr>
              ) : lorries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No vehicles found matching criteria. Click "Add New Lorry" to register.
                  </td>
                </tr>
              ) : (
                lorries.map((lorry) => {
                  const docs = lorry.documents;
                  return (
                    <tr key={lorry.id} className="hover:bg-zinc-800/40 transition-colors">
                      {/* Vehicle Number */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-white bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-700 shadow-xs">
                            {lorry.vehicle_number}
                          </span>
                        </div>
                        {lorry.notes && (
                          <p className="text-[11px] text-zinc-500 mt-1 max-w-xs truncate">
                            {lorry.notes}
                          </p>
                        )}
                      </td>

                      {/* Type & Capacity */}
                      <td className="py-4 px-4 align-top">
                        <p className="font-semibold text-zinc-200">{lorry.vehicle_type}</p>
                        <p className="text-zinc-400 font-mono mt-0.5">{lorry.capacity} Tons Capacity</p>
                      </td>

                      {/* Fleet Status */}
                      <td className="py-4 px-4 align-top">
                        <StatusBadge status={lorry.status} />
                      </td>

                      {/* Document Reminders with Detailed Days Remaining */}
                      <td className="py-4 px-4 align-top">
                        {docs ? (
                          <div className="space-y-1.5">
                            {/* Insurance */}
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                              <span className="font-semibold text-zinc-300 text-[11px]">Insurance:</span>
                              <span className="font-mono text-[11px] text-zinc-400">{docs.insurance.expiryDate}</span>
                              <StatusBadge
                                status={docs.insurance.status}
                                daysRemaining={docs.insurance.daysRemaining}
                                size="sm"
                              />
                            </div>
                            {/* FC */}
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                              <span className="font-semibold text-zinc-300 text-[11px]">Fitness Cert (FC):</span>
                              <span className="font-mono text-[11px] text-zinc-400">{docs.fc.expiryDate}</span>
                              <StatusBadge
                                status={docs.fc.status}
                                daysRemaining={docs.fc.daysRemaining}
                                size="sm"
                              />
                            </div>
                            {/* Permit */}
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                              <span className="font-semibold text-zinc-300 text-[11px]">Permit:</span>
                              <span className="font-mono text-[11px] text-zinc-400">{docs.permit.expiryDate}</span>
                              <StatusBadge
                                status={docs.permit.status}
                                daysRemaining={docs.permit.daysRemaining}
                                size="sm"
                              />
                            </div>
                            {/* Pollution */}
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                              <span className="font-semibold text-zinc-300 text-[11px]">Pollution (PUC):</span>
                              <span className="font-mono text-[11px] text-zinc-400">{docs.pollution.expiryDate}</span>
                              <StatusBadge
                                status={docs.pollution.status}
                                daysRemaining={docs.pollution.daysRemaining}
                                size="sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-500">Loading document statuses...</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="View Lorry Details & Trips"
                            onClick={() => handleOpenView(lorry)}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-950/40 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Edit Lorry Details"
                            onClick={() => handleOpenEdit(lorry)}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-950/40 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete Lorry"
                            onClick={() => setDeleteTarget(lorry)}
                            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Lorry Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingLorry ? `Edit Lorry (${editingLorry.vehicle_number})` : "Add New Vehicle to Fleet"}
        subtitle="Ensure statutory document dates are accurate for automated expiry reminders."
        maxWidth="2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vehicle Number */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Vehicle Registration Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TN-28-AB-4590"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Vehicle Type *
              </label>
              <select
                value={vehicleTypeMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setVehicleTypeMode(mode);
                  if (mode !== "Manual entry") {
                    setFormData({ ...formData, vehicle_type: mode });
                  } else if (STANDARD_VEHICLE_TYPES.includes(formData.vehicle_type)) {
                    setFormData({ ...formData, vehicle_type: "" });
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="10-wheeler tipper">10-wheeler tipper</option>
                <option value="12-wheeler tipper">12-wheeler tipper</option>
                <option value="14-wheeler tipper">14-wheeler tipper</option>
                <option value="Manual entry">Manual entry</option>
              </select>

              {vehicleTypeMode === "Manual entry" && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter custom vehicle type (e.g. 6-Wheeler Tipper)"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-blue-500/60 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Capacity */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Load Capacity (Tons) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                placeholder="e.g. 25.5"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Vehicle Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LorryStatus })}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="Available">Available (Ready for Dispatch)</option>
                <option value="On Trip">On Trip (Active Transit)</option>
                <option value="Inactive">Inactive (Maintenance / Garage)</option>
              </select>
            </div>
          </div>

          {/* Document Expiry Dates Section */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Statutory Compliance Documents</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Insurance Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.insurance_expiry}
                  onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Fitness Certificate (FC) Expiry *
                </label>
                <input
                  type="date"
                  required
                  value={formData.fc_expiry}
                  onChange={(e) => setFormData({ ...formData, fc_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Permit Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.permit_expiry}
                  onChange={(e) => setFormData({ ...formData, permit_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Pollution Certificate (PUC) Expiry *
                </label>
                <input
                  type="date"
                  required
                  value={formData.pollution_expiry}
                  onChange={(e) => setFormData({ ...formData, pollution_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Assigned driver: Murugan (+91 98450...). Regular route: Chennai Port to Salem."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-xs shadow-blue-500/20 transition-colors"
            >
              {formLoading ? "Saving..." : editingLorry ? "Update Lorry" : "Add Lorry"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Lorry View Details Modal */}
      {viewLorry && (
        <Modal
          isOpen={Boolean(viewLorry)}
          onClose={() => setViewLorry(null)}
          title={`Vehicle Profile: ${viewLorry.lorry.vehicle_number}`}
          subtitle={`${viewLorry.lorry.vehicle_type} (${viewLorry.lorry.capacity} Tons Capacity)`}
          maxWidth="3xl"
        >
          <div className="space-y-5">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div>
                <p className="text-[11px] text-zinc-400">Total Completed Trips</p>
                <p className="text-lg font-bold text-white font-mono">{viewLorry.stats.totalTrips}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400">Gross Freight Revenue</p>
                <p className="text-lg font-bold text-blue-400 font-mono">
                  ₹{viewLorry.stats.totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400">Net Profit Generated</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">
                  ₹{viewLorry.stats.totalProfit.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Document Compliance Table */}
            <div>
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-2">
                Statutory Documents Status
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="font-semibold text-zinc-300">Insurance Certificate</p>
                  <p className="text-zinc-400 font-mono">{viewLorry.lorry.documents?.insurance.formattedText}</p>
                </div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="font-semibold text-zinc-300">Fitness Certificate (FC)</p>
                  <p className="text-zinc-400 font-mono">{viewLorry.lorry.documents?.fc.formattedText}</p>
                </div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="font-semibold text-zinc-300">Permit</p>
                  <p className="text-zinc-400 font-mono">{viewLorry.lorry.documents?.permit.formattedText}</p>
                </div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="font-semibold text-zinc-300">Pollution Under Control (PUC)</p>
                  <p className="text-zinc-400 font-mono">{viewLorry.lorry.documents?.pollution.formattedText}</p>
                </div>
              </div>
            </div>

            {/* Trip History for this Lorry */}
            <div>
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-2">
                Trip History ({viewLorry.trips.length})
              </h4>
              <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 sticky top-0 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">S.No</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Cargo</th>
                      <th className="p-2.5">Route</th>
                      <th className="p-2.5 text-right">Freight Amount</th>
                      <th className="p-2.5 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {viewLorry.trips.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-zinc-500">
                          No trips logged for this vehicle yet.
                        </td>
                      </tr>
                    ) : (
                      viewLorry.trips.map((t: any) => (
                        <tr key={t.id} className="hover:bg-zinc-800/40">
                          <td className="p-2.5 font-mono text-blue-400">{t.serial_number}</td>
                          <td className="p-2.5">{t.date}</td>
                          <td className="p-2.5 text-zinc-200">{t.cargo}</td>
                          <td className="p-2.5 text-zinc-400">
                            {t.from_location} → {t.to_location}
                          </td>
                          <td className="p-2.5 text-right font-medium font-mono text-white">
                            ₹{t.total_amount?.toLocaleString("en-IN")}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-400 font-mono">
                            ₹{t.profit?.toLocaleString("en-IN") || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
        itemName={deleteTarget ? `${deleteTarget.vehicle_number} (${deleteTarget.vehicle_type})` : ""}
        itemType="Vehicle & Associated Trips"
        isLoading={deleteLoading}
      />
    </div>
  );
};
