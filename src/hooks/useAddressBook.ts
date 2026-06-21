import { useState, useCallback, useMemo } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import storage, { Contact } from "../util/storage";

export const MAX_IMPORT_BYTES = 1 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1_000;

type ImportedContact = Omit<Contact, "id" | "createdAt">;

export interface ImportContactsResult {
  imported: number;
  skipped: number;
}

export interface ParsedAddressBookCSV {
  contacts: ImportedContact[];
  skipped: number;
}

const CSV_CELL_REGEX = /(".*?"|[^,]+)(?=\s*,|\s*$)/g;
const CSV_OUTER_QUOTES_REGEX = /^"|"$/g;

export const isStellarAddress = (address: string) =>
  StrKey.isValidEd25519PublicKey(address.trim());

export function validateAddressBookImportFile(file: Pick<File, "size">) {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(
      `CSV file is too large. Maximum size is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`,
    );
  }
}

const cleanCSVCell = (cell: string) =>
  cell.replace(CSV_OUTER_QUOTES_REGEX, "").replace(/""/g, '"').trim();

export function parseAddressBookCSV(text: string): ParsedAddressBookCSV {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return { contacts: [], skipped: 0 };
  }

  const contacts: ImportedContact[] = [];
  let skipped = 0;
  let processedRows = 0;

  for (const row of lines.slice(1)) {
    if (!row.trim()) continue;

    if (processedRows >= MAX_IMPORT_ROWS) {
      skipped += 1;
      continue;
    }
    processedRows += 1;

    const matches = row.match(CSV_CELL_REGEX);
    if (!matches || matches.length < 2) {
      skipped += 1;
      continue;
    }

    const name = cleanCSVCell(matches[0]);
    const address = cleanCSVCell(matches[1]);
    const notes = matches[2] ? cleanCSVCell(matches[2]) : "";
    const isFavorite = matches[3] ? cleanCSVCell(matches[3]) === "true" : false;

    if (!isStellarAddress(address)) {
      skipped += 1;
      continue;
    }

    contacts.push({ name, address, notes, isFavorite });
  }

  return { contacts, skipped };
}

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
    (file: File): Promise<ImportContactsResult> => {
      try {
        validateAddressBookImportFile(file);
      } catch (err) {
        return Promise.reject(
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const parsed = parseAddressBookCSV(text);
            const newContacts = parsed.contacts.map((contact) => ({
              ...contact,
              id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              createdAt: new Date().toISOString(),
            }));

            const combined = [...contacts];
            let imported = 0;
            let skipped = parsed.skipped;

            for (const nc of newContacts) {
              if (combined.some((c) => c.address === nc.address)) {
                skipped += 1;
                continue;
              }
              combined.push(nc);
              imported += 1;
            }

            if (imported > 0) {
              saveContacts(combined);
            }
            resolve({ imported, skipped });
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
