import { useState, useCallback } from "react";

export interface StreamTemplate {
  id: string;
  name: string;
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

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  };
}
