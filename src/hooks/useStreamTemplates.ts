import { useState, useCallback } from "react";

export interface StreamTemplate {
  id: string;
  name: string;
  workerName: string;
  workerAddress: string;
  token: string;
  amount: string;
  frequency: string;
  duration: number;
  enableCliff: boolean;
  cliffDuration?: number;
  createdAt: string;
}

const STORAGE_KEY = "quipay-stream-templates";

function loadTemplates(): StreamTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StreamTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: StreamTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* ignore quota errors */
  }
}

export function useStreamTemplates() {
  const [templates, setTemplates] = useState<StreamTemplate[]>(loadTemplates);

  const addTemplate = useCallback(
    (template: Omit<StreamTemplate, "id" | "createdAt">) => {
      const newTemplate: StreamTemplate = {
        ...template,
        id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      setTemplates((prev) => {
        const updated = [...prev, newTemplate];
        saveTemplates(updated);
        return updated;
      });
      return newTemplate;
    },
    [],
  );

  const updateTemplate = useCallback(
    (
      id: string,
      updates: Partial<Omit<StreamTemplate, "id" | "createdAt">>,
    ) => {
      setTemplates((prev) => {
        const updated = prev.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        );
        saveTemplates(updated);
        return updated;
      });
    },
    [],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTemplates(updated);
      return updated;
    });
  }, []);

  const getTemplate = useCallback(
    (id: string) => {
      return templates.find((t) => t.id === id);
    },
    [templates],
  );

  const exportTemplates = useCallback(() => {
    const dataStr = JSON.stringify(templates, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quipay-templates-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [templates]);

  const importTemplates = useCallback((imported: StreamTemplate[]) => {
    setTemplates((prev) => {
      // Merge by ID, keeping newer or just appending if new ID
      const merged = [...prev];
      for (const t of imported) {
        const existingIdx = merged.findIndex((m) => m.id === t.id);
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], ...t };
        } else {
          merged.push(t);
        }
      }
      saveTemplates(merged);
      return merged;
    });
  }, []);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    exportTemplates,
    importTemplates,
  };
}
