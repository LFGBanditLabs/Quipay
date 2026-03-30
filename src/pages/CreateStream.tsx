import React, { useState } from "react";
import { Layout, Text } from "@stellar/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import Wizard from "../components/Wizard";
import { useNotification } from "../hooks/useNotification";
import Tooltip from "../components/Tooltip";
import CollapsibleSection from "../components/CollapsibleSection";
import { useStreamTemplates } from "../hooks/useStreamTemplates";
import BulkStreamCreator from "../components/BulkStreamCreator";

const CreateStream: React.FC = () => {
  const tw = {
    formGroup: "mb-6",
    label: "mb-2 block text-sm font-medium text-[var(--text)]",
    input:
      "w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-transparent)] focus:outline-none",
    select:
      "w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-transparent)] focus:outline-none",
    reviewItem:
      "flex justify-between border-b border-[var(--border)] py-3 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-1",
    reviewLabel: "text-sm text-[var(--muted)] max-[480px]:text-xs",
    reviewValue:
      "text-sm font-medium text-[var(--text)] max-[480px]:break-all max-[480px]:text-sm",
  };

  const navigate = useNavigate();
  const { addNotification, addStreamNotification } = useNotification();
  const { templates, addTemplate } = useStreamTemplates();
  const location = useLocation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [hasLoadedFromLocation, setHasLoadedFromLocation] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [mode, setMode] = useState<"single" | "bulk">("single");
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

  const updateFormData = (field: string, value: string | boolean | object) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const loadTemplate = React.useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        const startDate = new Date().toISOString().split("T")[0];
        const endDate = new Date(
          Date.now() + template.duration * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .split("T")[0];
        const cliffDate =
          template.enableCliff && template.cliffDuration
            ? new Date(
                Date.now() + template.cliffDuration * 24 * 60 * 60 * 1000,
              )
                .toISOString()
                .split("T")[0]
            : "";
        setFormData({
          ...formData,
          workerName: template.workerName || "",
          workerAddress: template.workerAddress || "",
          amount: template.amount,
          token: template.token,
          frequency: template.frequency,
          startDate,
          endDate,
          advancedOptions: {
            enableCliff: template.enableCliff,
            cliffDate,
          },
        });
        setSelectedTemplateId(templateId);
        addNotification(`Loaded template: ${template.name}`, "success");
      }
    },
    [templates, formData, addNotification],
  );

  React.useEffect(() => {
    if (
      !hasLoadedFromLocation &&
      location.state?.templateId &&
      templates.length > 0
    ) {
      loadTemplate(location.state.templateId);
      setHasLoadedFromLocation(true);
    }
  }, [location.state, templates, hasLoadedFromLocation, loadTemplate]);

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      addNotification("Please enter a template name", "error");
      return;
    }
    const startDate = new Date(formData.startDate || Date.now());
    const endDate = new Date(formData.endDate || Date.now());
    const duration = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const cliffStartDate = formData.advancedOptions.cliffDate
      ? new Date(formData.advancedOptions.cliffDate)
      : null;
    const cliffDuration = cliffStartDate
      ? Math.ceil(
          (cliffStartDate.getTime() - startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : undefined;
    addTemplate({
      name: templateName.trim(),
      workerName: formData.workerName,
      workerAddress: formData.workerAddress,
      token: formData.token,
      amount: formData.amount,
      frequency: formData.frequency,
      duration: duration > 0 ? duration : 30,
      enableCliff: formData.advancedOptions.enableCliff,
      cliffDuration,
    });
    setTemplateName("");
    setShowSaveAsTemplate(false);
    addNotification("Template saved successfully!", "success");
  };

  const steps = [
    {
      title: "Recipient",
      component: (
        <div>
          {templates.length > 0 && (
            <div className={tw.formGroup}>
              <label className={tw.label}>
                Load Template
                <Tooltip content="Pre-fill form with a saved payroll template" />
              </label>
              <select
                className={tw.select}
                value={selectedTemplateId}
                onChange={(e) => loadTemplate(e.target.value)}
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.token}, {t.frequency})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={tw.formGroup}>
            <label className={tw.label}>
              Worker Name
              <Tooltip content="Friendly name to identify this stream" />
            </label>
            <input
              type="text"
              className={tw.input}
              placeholder="e.g. John Doe"
              value={formData.workerName}
              onChange={(e) => updateFormData("workerName", e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div className={tw.formGroup}>
            <label className={tw.label}>
              Worker Wallet Address
              <Tooltip content="The Stellar G... address where funds will be streamed" />
            </label>
            <input
              type="text"
              className={tw.input}
              placeholder="e.g. GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
              value={formData.workerAddress}
              onChange={(e) => updateFormData("workerAddress", e.target.value)}
              required
              aria-required="true"
              pattern="^G[A-Z2-7]{55}$"
            />
          </div>
        </div>
      ),
      isValid:
        formData.workerAddress.length > 0 && formData.workerName.length > 0,
    },
    {
      title: "Payment",
      component: (
        <div>
          <div className={tw.formGroup}>
            <label className={tw.label}>
              Total Amount
              <Tooltip content="The total amount of tokens to be streamed over the duration" />
            </label>
            <input
              type="number"
              min="0"
              className={tw.input}
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => updateFormData("amount", e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div className={tw.formGroup}>
            <label className={tw.label}>Token</label>
            <select
              className={tw.select}
              value={formData.token}
              onChange={(e) => updateFormData("token", e.target.value)}
              required
              aria-required="true"
            >
              <option value="USDC">USDC</option>
              <option value="XLM">XLM</option>
            </select>
          </div>
        </div>
      ),
      isValid: formData.amount.length > 0 && parseFloat(formData.amount) > 0,
    },
    {
      title: "Schedule",
      component: (
        <div>
          <div className={tw.formGroup}>
            <label className={tw.label}>Start Date</label>
            <input
              type="date"
              className={tw.input}
              value={formData.startDate}
              onChange={(e) => updateFormData("startDate", e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div className={tw.formGroup}>
            <label className={tw.label}>End Date</label>
            <input
              type="date"
              className={tw.input}
              value={formData.endDate}
              onChange={(e) => updateFormData("endDate", e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <CollapsibleSection title="Advanced Schedule Options">
            <div className={tw.formGroup}>
              <label className={tw.label}>
                Enable Cliff
                <Tooltip content="Funds will only be withdrawable after this date" />
              </label>
              <input
                type="checkbox"
                checked={formData.advancedOptions.enableCliff}
                onChange={(e) =>
                  updateFormData("advancedOptions", {
                    ...formData.advancedOptions,
                    enableCliff: e.target.checked,
                  })
                }
              />
            </div>
            {formData.advancedOptions.enableCliff && (
              <div className={tw.formGroup}>
                <label className={tw.label}>Cliff Date</label>
                <input
                  type="date"
                  className={tw.input}
                  value={formData.advancedOptions.cliffDate}
                  onChange={(e) =>
                    updateFormData("advancedOptions", {
                      ...formData.advancedOptions,
                      cliffDate: e.target.value,
                    })
                  }
                  required={formData.advancedOptions.enableCliff}
                  aria-required={formData.advancedOptions.enableCliff}
                />
              </div>
            )}
          </CollapsibleSection>
        </div>
      ),
      isValid: formData.startDate.length > 0 && formData.endDate.length > 0,
    },
    {
      title: "Review",
      component: (
        <div>
          <div className={tw.reviewItem}>
            <span className={tw.reviewLabel}>Recipient</span>
            <span className={tw.reviewValue}>{formData.workerName}</span>
          </div>
          <div className={tw.reviewItem}>
            <span className={tw.reviewLabel}>Address</span>
            <span className={tw.reviewValue}>{formData.workerAddress}</span>
          </div>
          <div className={tw.reviewItem}>
            <span className={tw.reviewLabel}>Amount</span>
            <span className={tw.reviewValue}>
              {formData.amount} {formData.token}
            </span>
          </div>
          <div className={tw.reviewItem}>
            <span className={tw.reviewLabel}>Schedule</span>
            <span className={tw.reviewValue}>
              {formData.startDate} to {formData.endDate}
            </span>
          </div>
          {formData.advancedOptions.enableCliff && (
            <div className={tw.reviewItem}>
              <span className={tw.reviewLabel}>Cliff Date</span>
              <span className={tw.reviewValue}>
                {formData.advancedOptions.cliffDate}
              </span>
            </div>
          )}
          <div className={tw.reviewItem}>
            <span className={tw.reviewLabel}>Save as Template?</span>
            <span className={tw.reviewValue}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSaveAsTemplate}
                  onChange={(e) => setShowSaveAsTemplate(e.target.checked)}
                />
                <span className="text-sm">
                  Save these settings as a reusable template
                </span>
              </label>
            </span>
          </div>
          {showSaveAsTemplate && (
            <div className={tw.reviewItem}>
              <span className={tw.reviewLabel}>Template Name</span>
              <span className={tw.reviewValue}>
                <input
                  type="text"
                  className={tw.input}
                  placeholder="e.g. Monthly USDC Payroll"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </span>
            </div>
          )}
        </div>
      ),
    },
  ];

  const handleComplete = () => {
    // In a real app, this would call the smart contract
    console.log("Creating stream with data:", formData);
    if (showSaveAsTemplate && templateName.trim()) {
      handleSaveAsTemplate();
    }
    addNotification("Payment stream created successfully!", "success");
    addStreamNotification("stream_created", {
      message: `Created stream for ${formData.workerName || "worker"}.`,
    });
    void navigate("/dashboard");
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <Text as="h1" size="xl" weight="bold">
            Create New Payment Stream
          </Text>
          <Text as="p" size="md" style={{ color: "var(--muted)" }}>
            Set up a continuous, real-time payment for your worker.
          </Text>
        </div>

        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={() => setMode("single")}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: mode === "single" ? "var(--accent)" : "transparent",
              color: mode === "single" ? "#fff" : "var(--muted)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Single Stream
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: mode === "bulk" ? "var(--accent)" : "transparent",
              color: mode === "bulk" ? "#fff" : "var(--muted)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Bulk Upload (CSV)
          </button>
        </div>

        {mode === "single" ? (
          <Wizard
            steps={steps}
            onComplete={handleComplete}
            onCancel={() => {
              void navigate("/dashboard");
            }}
          />
        ) : (
          <BulkStreamCreator />
        )}

        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
            Need help? Check out our{" "}
            <a href="#" style={{ color: "var(--accent)" }}>
              documentation on streams
            </a>
            .
          </Text>
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default CreateStream;
