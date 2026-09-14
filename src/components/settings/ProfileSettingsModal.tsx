import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  X,
  Building2,
  User as UserIcon,
  Phone,
  MapPin,
  Sparkles,
  Save,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Check,
} from "lucide-react";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    company_name: user?.company_name || "",
    proprietor_name: user?.proprietor_name || "",
    phone_cell: user?.phone_cell || "",
    address: user?.address || "",
    devotional_line1: user?.devotional_line1 || "குருவே சரணம்",
    devotional_line2: user?.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
    vessel_name_default: user?.vessel_name_default || "",
    gstin: user?.gstin || "",
  });

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        company_name: user.company_name || "",
        proprietor_name: user.proprietor_name || (user.name ? `Prop. ${user.name}` : ""),
        phone_cell: user.phone_cell || "",
        address: user.address || "",
        devotional_line1: user.devotional_line1 || "குருவே சரணம்",
        devotional_line2: user.devotional_line2 || "ஸ்ரீ பூலுடையார் சாஸ்தா துணை",
        vessel_name_default: user.vessel_name_default || "",
        gstin: user.gstin || "",
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(formData);
      success("Transport and owner details saved permanently!");
      onClose();
    } catch (err: any) {
      error(err.message || "Failed to update profile details");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount();
      success("Your account and all associated transport data have been permanently deleted.");
      onClose();
    } catch (err: any) {
      error(err.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-4 sm:my-8 text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Owner & Transport Details</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Data saved here is permanently stored in your account until you delete it
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Main Transport Brand */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
              Transport Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="e.g. RAJA TRANSPORTS"
              className="w-full px-3.5 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-serif font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Owner / Full Name & Proprietor Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                Owner Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="R. Paulpandi"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Proprietor Title on Memos
              </label>
              <input
                type="text"
                value={formData.proprietor_name}
                onChange={(e) => setFormData({ ...formData, proprietor_name: e.target.value })}
                placeholder="Prop. R. Paulpandi"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Phone & Cell */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Cell / Mobile Number
              </label>
              <input
                type="text"
                value={formData.phone_cell}
                onChange={(e) => setFormData({ ...formData, phone_cell: e.target.value })}
                placeholder="Cell : 98949 03533"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                GSTIN / Tax ID (Optional)
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="33AAAAA0000A1Z5"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              Office & Fleet Depot Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="122E, Polepettai, Ettayapuram Road, Thoothukudi - 2"
              className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Devotional Slogans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Religious Devotional Line 1
              </label>
              <input
                type="text"
                value={formData.devotional_line1 || ""}
                onChange={(e) => setFormData({ ...formData, devotional_line1: e.target.value })}
                placeholder="e.g. குருவே சரணம்"
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Religious Devotional Line 2
              </label>
              <input
                type="text"
                value={formData.devotional_line2 || ""}
                onChange={(e) => setFormData({ ...formData, devotional_line2: e.target.value })}
                placeholder="e.g. ஸ்ரீ பூலுடையார் சாஸ்தா துணை"
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 transition-colors"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>

          {/* Danger Zone: Permanent Account Deletion */}
          <div className="mt-6 pt-6 border-t border-rose-900/40">
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Delete Account & Wipe All Data
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Permanently deletes your transport profile, lorries, trips, expenses, and memo sheets.
                </p>
              </div>
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                    >
                      {deleting ? "Deleting..." : "Yes, Permanently Delete"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-900/40 hover:bg-rose-900/80 border border-rose-700/50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete My Account</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
