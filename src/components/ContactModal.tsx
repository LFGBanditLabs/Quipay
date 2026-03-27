import React, { useState } from "react";
import { Button, Text } from "@stellar/design-system";
import { X, User, Hash, FileText } from "lucide-react";
import { Contact } from "../util/storage";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Omit<Contact, "id" | "createdAt">) => void;
  initialData?: Contact;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [isFavorite, setIsFavorite] = useState(
    initialData?.isFavorite || false,
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    onSave({ name, address, notes, isFavorite });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-(--surface)/90 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="relative p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-white/5 hover:text-(--text) transition-colors"
          >
            <X size={20} />
          </button>

          <div className="mb-8 items-center gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <User size={24} />
            </div>
            <div className="mt-4">
              <Text
                as="h2"
                size="xl"
                weight="bold"
                className="bg-linear-to-r from-white to-white/60 bg-clip-text text-transparent"
              >
                {initialData ? "Edit Contact" : "Add New Contact"}
              </Text>
              <Text as="p" size="sm" className="text-muted mt-1">
                {initialData
                  ? "Update worker details in your address book."
                  : "Save a new worker address for quick access later."}
              </Text>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                <User size={14} /> Full Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-(--text) placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                <Hash size={14} /> Stellar Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="G..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-(--text) placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
                <FileText size={14} /> Internal Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Department, role, or special terms..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-(--text) placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  isFavorite
                    ? "bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    : "bg-white/5 text-white/30 border border-white/5 hover:border-white/10"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
              <div>
                <Text as="div" size="sm" weight="medium">
                  Mark as Favorite
                </Text>
                <Text as="p" size="xs" className="text-muted">
                  Show this worker at the top of your list.
                </Text>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                size="md"
                onClick={onClose}
                className="rounded-xl border-white/10 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                className="rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
              >
                {initialData ? "Save Changes" : "Save Contact"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
