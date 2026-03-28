import { useState, useCallback, useMemo } from "react";
import storage, { Contact } from "../util/storage";

export function useAddressBook() {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    return storage.getItem("addressBook", "safe") || [];
  });

  const saveContacts = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts);
    storage.setItem("addressBook", newContacts);
  }, []);

  const addContact = useCallback(
    (contact: Omit<Contact, "id" | "createdAt">) => {
      const newContact: Contact = {
        ...contact,
        id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      saveContacts([...contacts, newContact]);
      return newContact;
    },
    [contacts, saveContacts],
  );

  const updateContact = useCallback(
    (id: string, updates: Partial<Omit<Contact, "id" | "createdAt">>) => {
      const newContacts = contacts.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      );
      saveContacts(newContacts);
    },
    [contacts, saveContacts],
  );

  const deleteContact = useCallback(
    (id: string) => {
      saveContacts(contacts.filter((c) => c.id !== id));
    },
    [contacts, saveContacts],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (contact) {
        updateContact(id, { isFavorite: !contact.isFavorite });
      }
    },
    [contacts, updateContact],
  );

  const favorites = useMemo(
    () => contacts.filter((c) => c.isFavorite),
    [contacts],
  );

  const exportToCSV = useCallback(() => {
    if (contacts.length === 0) return;

    const headers = ["Name", "Address", "Notes", "IsFavorite", "CreatedAt"];
    const rows = contacts.map((c) => [
      c.name,
      c.address,
      c.notes || "",
      c.isFavorite ? "true" : "false",
      c.createdAt,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `quipay_contacts_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [contacts]);

  const importFromCSV = useCallback(
    (file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split("\n");
            if (lines.length < 2) return resolve();

            // Simple CSV parser (assuming first row is headers)
            const newContacts: Contact[] = [];
            const rows = lines.slice(1);

            for (const row of rows) {
              if (!row.trim()) continue;

              // Simple regex to split by comma but preserve quoted commas
              const matches = row.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
              if (!matches || matches.length < 2) continue;

              const clean = (s: string) =>
                s.replace(/^"|"$/g, "").replace(/""/g, '"');

              const name = clean(matches[0]);
              const address = clean(matches[1]);
              const notes = matches[2] ? clean(matches[2]) : "";
              const isFavorite = matches[3]
                ? clean(matches[3]) === "true"
                : false;

              // Validate address (simple check)
              if (address && address.length > 30) {
                newContacts.push({
                  id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  name,
                  address,
                  notes,
                  isFavorite,
                  createdAt: new Date().toISOString(),
                });
              }
            }

            if (newContacts.length > 0) {
              const combined = [...contacts];
              // Avoid duplicates by address
              for (const nc of newContacts) {
                if (!combined.some((c) => c.address === nc.address)) {
                  combined.push(nc);
                }
              }
              saveContacts(combined);
            }
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsText(file);
      });
    },
    [contacts, saveContacts],
  );

  return {
    contacts,
    favorites,
    addContact,
    updateContact,
    deleteContact,
    toggleFavorite,
    exportToCSV,
    importFromCSV,
  };
}
