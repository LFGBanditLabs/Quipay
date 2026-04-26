// Updated CreateStream.tsx with draft persistence
import React, { useState, useEffect } from "react";
import { Layout, Text } from "@stellar/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import Wizard from "../components/Wizard";
import { useNotification } from "../hooks/useNotification";
import Tooltip from "../components/Tooltip";
import CollapsibleSection from "../components/CollapsibleSection";
import { useStreamTemplates } from "../hooks/useStreamTemplates";
import BulkStreamCreator from "../components/BulkStreamCreator";

const STORAGE_KEY = "quipay_stream_draft_default"; // replace with orgId if available

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification, addStreamNotification } = useNotification();
  const { templates, addTemplate } = useStreamTemplates();

  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);

  const [formData, setFormData] = useState({
    workerAddress: "",
    workerName: "",
    amount: "",
    token: "USDC",
    frequency: "monthly",
    startDate: "",
    endDate: "",
    advancedOptions: {
      enableCliff: false,
      cliffDate: "",
    },
  });

  // ---------- RESTORE DRAFT ----------
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setShowRestoreBanner(true);
    }
  }, []);

  const restoreDraft = () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setFormData(JSON.parse(saved));
      setHasRestored(true);
      setShowRestoreBanner(false);
      addNotification("Draft restored", "success");
    }
  };

  const discardDraft = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setShowRestoreBanner(false);
  };

  // ---------- SAVE ON CHANGE ----------
  useEffect(() => {
    if (!hasRestored) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData, hasRestored]);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...formData, [field]: value }));
  };

  // ---------- CLEAR ON SUCCESS ----------
  const handleComplete = () => {
    sessionStorage.removeItem(STORAGE_KEY);

    addNotification("Payment stream created successfully!", "success");
    addStreamNotification("stream_created", {
      message: `Created stream for ${formData.workerName || "worker"}.`,
    });

    void navigate("/dashboard");
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        {showRestoreBanner && (
          <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
            <Text size="sm">You have an unsaved draft.</Text>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
              <button onClick={restoreDraft}>Restore</button>
              <button onClick={discardDraft}>Discard</button>
            </div>
          </div>
        )}

        <Wizard
          steps={[] /* keep existing steps */}
          onComplete={handleComplete}
          onCancel={() => navigate("/dashboard")}
        />
      </Layout.Inset>
    </Layout.Content>
  );
};

export default CreateStream;
