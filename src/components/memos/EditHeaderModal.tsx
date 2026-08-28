import React, { useState, useEffect } from "react";
import { TransportHeaderSettings } from "../../types";
import { X, Save, Building2, Phone, MapPin, Hash } from "lucide-react";

interface EditHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: TransportHeaderSettings;
  onSave: (newSettings: TransportHeaderSettings) => Promise<void>;
}

export const EditHeaderModal: React.FC<EditHeaderModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave,
}) => {
  const [formData, setFormData] = useState<TransportHeaderSettings>(currentSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(currentSettings);
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Transport Bill Header Details</h2>
              <p className="text-xs text-zinc-400">Customize the company name, address & contact info on the trip bill sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
              Transport Company Name (Main Banner) *
            </label>
            <input
              type="text"
              required
              value={formData.transport_name}
              onChange={(e) => setFormData({ ...formData, transport_name: e.target.value })}
              placeholder="e.g. RAJA TRANSPORTS"
              className="w-full px-3.5 py-2.5 bg-zinc-800/90 border border-zinc-700 rounded-xl text-white font-serif font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Devotional Slogans (Tamil / Invocations) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Religious Devotional Line 1
              </label>
              <input
                type="text"
                value={formData.devotional_line1 || ""}
                onChange={(e) => setFormData({ ...formData, devotional_line1: e.target.value })}
                placeholder="e.g. குருவே சரணம்"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              Complete Business Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. 122E, Polepettai, Ettayapuram Road, Thoothukudi - 2"
              className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Proprietor & Cell */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Proprietor Title & Name
              </label>
              <input
                type="text"
                value={formData.proprietor_name}
                onChange={(e) => setFormData({ ...formData, proprietor_name: e.target.value })}
                placeholder="e.g. Prop. R. Paulpandi"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Cell / Mobile Number
              </label>
              <input
                type="text"
                value={formData.phone_cell}
                onChange={(e) => setFormData({ ...formData, phone_cell: e.target.value })}
                placeholder="e.g. Cell : 98949 03533"
                className="w-full px-3.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Bill Prefix & Next Sequence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                Bill No. Prefix
              </label>
              <input
                type="text"
                value={formData.memo_prefix || "No. "}
                onChange={(e) => setFormData({ ...formData, memo_prefix: e.target.value })}
                placeholder="No. "
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                Current/Next Bill Number
              </label>
              <input
                type="number"
                value={formData.memo_next_no || 787}
                onChange={(e) => setFormData({ ...formData, memo_next_no: parseInt(e.target.value, 10) || 1 })}
                placeholder="787"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                GSTIN / Reg No (Optional)
              </label>
              <input
                type="text"
                value={formData.gstin || ""}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="GSTIN..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
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
                  <span>Save Header Details Permanently</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
