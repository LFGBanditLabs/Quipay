import React, { useState } from "react";
import { Layout, Text, Button, Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { usePayroll } from "../hooks/usePayroll";
import Tooltip from "../components/Tooltip";
import CollapsibleSection from "../components/CollapsibleSection";

const TreasuryManagement: React.FC = () => {
  const tw = {
    treasuryHeader:
      "mb-8 flex items-start justify-between max-[768px]:flex-col max-[768px]:gap-4",
    cardGrid: "mb-8 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6",
    card: "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_var(--shadow-color)]",
    cardTitle: "mb-4 flex items-center gap-2 text-[var(--muted)]",
    balanceValue: "text-3xl font-bold text-[var(--text)]",
    actions: "mt-6 flex gap-4",
    settingsSection: "mt-12 border-t border-[var(--border)] pt-8",
    formGroup: "mb-6",
    label: "mb-2 block text-sm font-medium text-[var(--text)]",
    input:
      "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text)]",
  };

  const navigate = useNavigate();
  const { treasuryBalances, totalLiabilities } = usePayroll();
  const [retentionSecs, setRetentionSecs] = useState("2592000"); // 30 days

  return (
    <Layout.Content>
      <Layout.Inset>
        <div className={tw.treasuryHeader}>
          <div>
            <Text as="h1" size="xl" weight="bold">
              Treasury Management
            </Text>
            <Text as="p" size="md" style={{ color: "var(--muted)" }}>
              Manage your protocol's funds and global settings.
            </Text>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              void navigate("/dashboard");
            }}
          >
            Back to Dashboard
          </Button>
        </div>

        <div className={tw.cardGrid}>
          {/* Treasury Balances */}
          <div className={tw.card}>
            <div className={tw.cardTitle}>
              <Icon.ChevronRight size="md" />
              <Text as="span" size="sm" weight="medium">
                Total Treasury Balance
              </Text>
              <Tooltip content="Total funds available for all active streams" />
            </div>
            {treasuryBalances.map((balance) => (
              <div key={balance.tokenSymbol} style={{ marginBottom: "0.5rem" }}>
                <span className={tw.balanceValue}>
                  {balance.balance} {balance.tokenSymbol}
                </span>
              </div>
            ))}
            <div className={tw.actions}>
              <Button variant="primary" size="md">
                Deposit Funds
              </Button>
              <Button variant="secondary" size="md">
                Withdraw Excess
              </Button>
            </div>
          </div>

          {/* Liabilities */}
          <div className={tw.card}>
            <div className={tw.cardTitle}>
              <Icon.ChevronRight size="md" />
              <Text as="span" size="sm" weight="medium">
                Monthly Liabilities
              </Text>
              <Tooltip content="Projected outgoing payments for the next 30 days" />
            </div>
            <span className={tw.balanceValue}>{totalLiabilities}</span>
            <div style={{ marginTop: "1rem" }}>
              <Text as="p" size="sm" style={{ color: "var(--muted)" }}>
                Ensure your treasury balance exceeds your liabilities to prevent
                stream interruptions.
              </Text>
            </div>
          </div>
        </div>

        <div className={tw.settingsSection}>
          <Text
            as="h2"
            size="lg"
            weight="medium"
            style={{ marginBottom: "1.5rem" }}
          >
            Protocol Settings
          </Text>
          <Text
            as="p"
            size="md"
            style={{ color: "var(--muted)", marginBottom: "1.5rem" }}
          >
            Configure global parameters for your payroll protocol.
          </Text>

          <CollapsibleSection title="Advanced Protocol Configuration">
            <div className={tw.formGroup}>
              <label className={tw.label}>
                Retention Period (Seconds)
                <Tooltip content="How long cancelled stream data is kept on-chain before it can be cleaned up" />
              </label>
              <input
                type="number"
                className={tw.input}
                value={retentionSecs}
                onChange={(e) => setRetentionSecs(e.target.value)}
              />
            </div>

            <div className={tw.formGroup}>
              <label className={tw.label}>
                Admin Address
                <Tooltip content="The address with authority to pause the protocol or change settings" />
              </label>
              <input
                type="text"
                className={tw.input}
                value="G..."
                readOnly
                disabled
              />
            </div>

            <div style={{ marginTop: "2rem" }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => alert("Settings updated!")}
              >
                Save Changes
              </Button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Danger Zone">
            <div
              style={{
                padding: "1rem",
                border: "1px solid var(--sds-color-feedback-error-transparent)",
                borderRadius: "0.5rem",
                backgroundColor: "var(--error-transparent)",
              }}
            >
              <Text
                as="h3"
                size="md"
                weight="bold"
                style={{ color: "var(--sds-color-feedback-error)" }}
              >
                Pause Protocol
              </Text>
              <Text
                as="p"
                size="sm"
                style={{
                  color: "var(--sds-color-feedback-error)",
                  marginBottom: "1rem",
                }}
              >
                Pausing the protocol will stop all real-time streams and prevent
                new withdrawals. Only use this in emergencies.
              </Text>
              <Button
                variant="primary"
                size="md"
                style={{ backgroundColor: "var(--sds-color-feedback-error)" }}
              >
                Pause All Streams
              </Button>
            </div>
          </CollapsibleSection>
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default TreasuryManagement;
