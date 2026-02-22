import React, { useState } from "react";
import { Layout, Text, Button, Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { usePayroll } from "../hooks/usePayroll";
import Tooltip from "../components/Tooltip";
import CollapsibleSection from "../components/CollapsibleSection";
import styles from "./TreasuryManagement.module.css";

const TreasuryManagement: React.FC = () => {
  const navigate = useNavigate();
  const { treasuryBalances, totalLiabilities } = usePayroll();
  const [retentionSecs, setRetentionSecs] = useState("2592000"); // 30 days

  return (
    <Layout.Content>
      <Layout.Inset>
        <div className={styles.treasuryHeader}>
          <div>
            <Text as="h1" size="xl" weight="bold">
              Treasury Management
            </Text>
            <Text as="p" size="md" style={{ color: "var(--gray-500)" }}>
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

        <div className={styles.cardGrid}>
          {/* Treasury Balances */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Icon.ChevronRight size="md" />
              <Text as="span" size="sm" weight="medium">
                Total Treasury Balance
              </Text>
              <Tooltip content="Total funds available for all active streams" />
            </div>
            {treasuryBalances.map((balance) => (
              <div key={balance.tokenSymbol} style={{ marginBottom: "0.5rem" }}>
                <span className={styles.balanceValue}>
                  {balance.balance} {balance.tokenSymbol}
                </span>
              </div>
            ))}
            <div className={styles.actions}>
              <Button variant="primary" size="md">
                Deposit Funds
              </Button>
              <Button variant="secondary" size="md">
                Withdraw Excess
              </Button>
            </div>
          </div>

          {/* Liabilities */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Icon.ChevronRight size="md" />
              <Text as="span" size="sm" weight="medium">
                Monthly Liabilities
              </Text>
              <Tooltip content="Projected outgoing payments for the next 30 days" />
            </div>
            <span className={styles.balanceValue}>{totalLiabilities}</span>
            <div style={{ marginTop: "1rem" }}>
              <Text as="p" size="sm" style={{ color: "var(--gray-500)" }}>
                Ensure your treasury balance exceeds your liabilities to prevent
                stream interruptions.
              </Text>
            </div>
          </div>
        </div>

        <div className={styles.settingsSection}>
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
            style={{ color: "var(--gray-500)", marginBottom: "1.5rem" }}
          >
            Configure global parameters for your payroll protocol.
          </Text>

          <CollapsibleSection title="Advanced Protocol Configuration">
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Retention Period (Seconds)
                <Tooltip content="How long cancelled stream data is kept on-chain before it can be cleaned up" />
              </label>
              <input
                type="number"
                className={styles.input}
                value={retentionSecs}
                onChange={(e) => setRetentionSecs(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Admin Address
                <Tooltip content="The address with authority to pause the protocol or change settings" />
              </label>
              <input
                type="text"
                className={styles.input}
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
                border: "1px solid var(--red-200)",
                borderRadius: "0.5rem",
                backgroundColor: "var(--red-50)",
              }}
            >
              <Text
                as="h3"
                size="md"
                weight="bold"
                style={{ color: "var(--red-700)" }}
              >
                Pause Protocol
              </Text>
              <Text
                as="p"
                size="sm"
                style={{ color: "var(--red-600)", marginBottom: "1rem" }}
              >
                Pausing the protocol will stop all real-time streams and prevent
                new withdrawals. Only use this in emergencies.
              </Text>
              <Button
                variant="primary"
                size="md"
                style={{ backgroundColor: "var(--red-600)" }}
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
