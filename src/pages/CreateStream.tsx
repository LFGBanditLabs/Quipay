import React, { useState } from "react";
import { Layout, Text } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import Wizard from "../components/Wizard";
import Tooltip from "../components/Tooltip";
import CollapsibleSection from "../components/CollapsibleSection";
import styles from "./CreateStream.module.css";

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
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

  const steps = [
    {
      title: "Recipient",
      component: (
        <div>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Worker Name
              <Tooltip content="Friendly name to identify this stream" />
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. John Doe"
              value={formData.workerName}
              onChange={(e) => updateFormData("workerName", e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Worker Wallet Address
              <Tooltip content="The Stellar G... address where funds will be streamed" />
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="G..."
              value={formData.workerAddress}
              onChange={(e) => updateFormData("workerAddress", e.target.value)}
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
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Total Amount
              <Tooltip content="The total amount of tokens to be streamed over the duration" />
            </label>
            <input
              type="number"
              className={styles.input}
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => updateFormData("amount", e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Token</label>
            <select
              className={styles.select}
              value={formData.token}
              onChange={(e) => updateFormData("token", e.target.value)}
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
          <div className={styles.formGroup}>
            <label className={styles.label}>Start Date</label>
            <input
              type="date"
              className={styles.input}
              value={formData.startDate}
              onChange={(e) => updateFormData("startDate", e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>End Date</label>
            <input
              type="date"
              className={styles.input}
              value={formData.endDate}
              onChange={(e) => updateFormData("endDate", e.target.value)}
            />
          </div>
          <CollapsibleSection title="Advanced Schedule Options">
            <div className={styles.formGroup}>
              <label className={styles.label}>
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
              <div className={styles.formGroup}>
                <label className={styles.label}>Cliff Date</label>
                <input
                  type="date"
                  className={styles.input}
                  value={formData.advancedOptions.cliffDate}
                  onChange={(e) =>
                    updateFormData("advancedOptions", {
                      ...formData.advancedOptions,
                      cliffDate: e.target.value,
                    })
                  }
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
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Recipient</span>
            <span className={styles.reviewValue}>{formData.workerName}</span>
          </div>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Address</span>
            <span className={styles.reviewValue}>{formData.workerAddress}</span>
          </div>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Amount</span>
            <span className={styles.reviewValue}>
              {formData.amount} {formData.token}
            </span>
          </div>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Schedule</span>
            <span className={styles.reviewValue}>
              {formData.startDate} to {formData.endDate}
            </span>
          </div>
          {formData.advancedOptions.enableCliff && (
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Cliff Date</span>
              <span className={styles.reviewValue}>
                {formData.advancedOptions.cliffDate}
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
    alert("Payment stream created successfully!");
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

        <Wizard
          steps={steps}
          onComplete={handleComplete}
          onCancel={() => {
            void navigate("/dashboard");
          }}
        />

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
