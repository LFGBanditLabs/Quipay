import React, { useState, useMemo } from "react";
import { Text, Button } from "@stellar/design-system";
import { useTranslation } from "react-i18next";
import {
  Search,
  UserPlus,
  Download,
  Upload,
  Star,
  Trash2,
  Edit2,
  Filter,
} from "lucide-react";
import { useAddressBook } from "../hooks/useAddressBook";
import { ContactModal } from "../components/ContactModal";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import CopyButton from "../components/CopyButton";
import { useNotification } from "../hooks/useNotification";
import { Contact } from "../util/storage";

const AddressBook: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const {
    contacts,
    favorites,
    addContact,
    updateContact,
    deleteContact,
    toggleFavorite,
    exportToCSV,
    importFromCSV,
  } = useAddressBook();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query) ||
          (c.notes && c.notes.toLowerCase().includes(query)),
      );
    }
    // Sort by favorite first, then by name
    return result.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, searchQuery]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importFromCSV(file);
        addNotification("Contacts imported successfully", "success");
      } catch {
        addNotification("Failed to import contacts", "error");
      }
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingContact(null);
    setIsModalOpen(true);
  };

  const handleSaveContact = (data: Omit<Contact, "id" | "createdAt">) => {
    if (editingContact) {
      updateContact(editingContact.id, data);
      addNotification("Contact updated", "success");
    } else {
      addContact(data);
      addNotification("Contact added", "success");
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <SeoHelmet
        title="Address Book | Quipay"
        description="Manage your worker contacts and favorites for quick stream creation."
        path="/address-book"
        imagePath="/og-image.png"
      />

      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-sm shadow-indigo-500/10">
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <Text
                as="span"
                size="xs"
                weight="bold"
                className="text-indigo-400 uppercase tracking-widest"
              >
                Network Registry
              </Text>
            </div>
            <Text
              as="h1"
              size="xl"
              weight="bold"
              className="text-4xl sm:text-5xl bg-linear-to-br from-white via-white to-white/40 bg-clip-text text-transparent"
            >
              {t("nav.address_book") || "Address Book"}
            </Text>
            <Text as="p" size="md" className="text-muted max-w-xl">
              Keep track of verified worker addresses. Mark frequent recipients
              as favorites for a faster stream setup.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  handleImport(e).catch((err) => {
                    console.error("Import failed:", err);
                    addNotification("Failed to import contacts", "error");
                  });
                }}
                className="hidden"
              />
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all active:scale-95">
                <Upload size={18} />
                <span>Import CSV</span>
              </div>
            </label>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all active:scale-95"
            >
              <Download size={18} />
              <span>Export CSV</span>
            </button>
            <Button
              variant="primary"
              size="md"
              onClick={openAddModal}
              className="rounded-2xl bg-linear-to-r from-indigo-500 via-indigo-600 to-purple-600 shadow-xl shadow-indigo-500/20 border-0"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={18} />
                <span>Add Contact</span>
              </div>
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/30 group-focus-within:text-indigo-400 transition-colors">
            <Search size={22} />
          </div>
          <input
            type="text"
            placeholder="Search by name, address, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-6 text-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all backdrop-blur-xl shadow-inner shadow-white/5"
          />
          <div className="absolute inset-y-0 right-4 flex items-center gap-2">
            <div className="h-8 w-px bg-white/10 mx-2" />
            <button className="p-2 text-white/30 hover:text-white transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </div>

        {/* Favorites Section (if any) */}
        {favorites.length > 0 && !searchQuery && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Star size={18} className="text-amber-400 fill-amber-400" />
              <Text
                as="h3"
                size="md"
                weight="bold"
                className="uppercase tracking-widest text-xs text-muted"
              >
                Favorites
              </Text>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favorites.map((contact) => (
                <div
                  key={contact.id}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-b from-white/10 to-transparent p-6 hover:border-indigo-500/30 transition-all duration-300 shadow-lg hover:shadow-indigo-500/10"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(contact)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500/50 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <Text
                        as="h4"
                        size="lg"
                        weight="bold"
                        className="line-clamp-1"
                      >
                        {contact.name}
                      </Text>
                      <div className="flex items-center gap-1.5 mt-1 text-muted hover:text-indigo-300 transition-colors cursor-pointer">
                        <Text as="span" size="xs" className="font-mono">
                          {contact.address.slice(0, 8)}...
                          {contact.address.slice(-8)}
                        </Text>
                        <CopyButton value={contact.address} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full List Section */}
        <div className="space-y-4 pt-4">
          {!searchQuery && (
            <div className="flex items-center gap-2 px-1">
              <Text
                as="h3"
                size="md"
                weight="bold"
                className="uppercase tracking-widest text-xs text-muted"
              >
                {favorites.length > 0 ? "All Contacts" : "Directory"}
              </Text>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="min-w-full divide-y divide-white/10">
              {filteredContacts.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-white/20 mb-4">
                    <Search size={40} />
                  </div>
                  <Text as="h4" size="lg" weight="bold">
                    No contacts found
                  </Text>
                  <Text as="p" size="md" className="text-muted mt-1">
                    {searchQuery
                      ? `We couldn't find anything matching "${searchQuery}"`
                      : "Your address book is empty."}
                  </Text>
                  {!searchQuery && (
                    <Button
                      variant="secondary"
                      size="md"
                      className="mt-6 rounded-2xl"
                      onClick={openAddModal}
                    >
                      Create First Contact
                    </Button>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/5 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/5 transition-all text-white/30 group-hover:text-indigo-400 font-bold">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Text as="h4" size="md" weight="bold">
                            {contact.name}
                          </Text>
                          {contact.isFavorite && (
                            <Star
                              size={14}
                              className="text-amber-400 fill-amber-400"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
                          <span>
                            {contact.address.slice(0, 12)}...
                            {contact.address.slice(-12)}
                          </span>
                          <CopyButton value={contact.address} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 mt-4 sm:mt-0">
                      {contact.notes && (
                        <div className="hidden lg:block max-w-[200px]">
                          <Text
                            as="p"
                            size="xs"
                            className="text-muted line-clamp-1 italic italic-style-italic font-italic"
                          >
                            "{contact.notes}"
                          </Text>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleFavorite(contact.id)}
                          className={`p-2.5 rounded-2xl transition-all ${
                            contact.isFavorite
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-white/5 text-white/30 border border-white/5 hover:text-amber-400"
                          }`}
                        >
                          <Star
                            size={18}
                            fill={contact.isFavorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          onClick={() => openEditModal(contact)}
                          className="p-2.5 rounded-2xl bg-white/5 text-white/30 border border-white/5 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="p-2.5 rounded-2xl bg-white/5 text-red-500/30 border border-white/5 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ContactModal
        key={editingContact?.id || "new-contact"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveContact}
        initialData={editingContact || undefined}
      />
    </div>
  );
};

export default AddressBook;
