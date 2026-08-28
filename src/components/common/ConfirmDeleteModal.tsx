import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName: string;
  itemType: string;
  isLoading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  itemName,
  itemType,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300">
          <div className="p-3 bg-rose-900/50 rounded-full text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-rose-200">Permanent Action</h4>
            <p className="text-xs text-rose-300/80 mt-0.5 leading-relaxed">
              Are you sure you want to delete this {itemType.toLowerCase()}?
            </p>
          </div>
        </div>

        <div className="bg-zinc-900 p-3.5 rounded-lg border border-zinc-800 text-sm">
          <span className="text-zinc-400 font-medium">Record: </span>
          <span className="font-bold text-zinc-100">{itemName}</span>
        </div>

        <p className="text-xs text-zinc-400">
          Note: This operation will permanently remove this record and all its associated data.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-2 transition-colors"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
