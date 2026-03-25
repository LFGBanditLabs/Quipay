import React from "react";
import { Icon } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";
import { stellarNetwork } from "../contracts/util";

// Format network name with first letter capitalized
const formatNetworkName = (name: string) =>
  // TODO: This is a workaround until @creit-tech/stellar-wallets-kit uses the new name for a local network.
  name === "STANDALONE"
    ? "Local"
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const appNetwork = formatNetworkName(stellarNetwork);

const bgColor = "var(--surface)";
const textColor = "var(--text)";

const NetworkPill: React.FC = () => {
  const { network, address } = useWallet();
  const { status, congestion, latency } = useNetworkStatus();

  // Check if there's a network mismatch
  const walletNetwork = formatNetworkName(network ?? "");
  const isNetworkMismatch = !!address && walletNetwork !== appNetwork;

  let title = `System Status: ${status.toUpperCase()} (${latency}ms)`;
  let color = "var(--sds-color-feedback-success)";
  let icon = <Icon.Circle color={color} size="12px" />;

  if (status === "offline") {
    title = "Horizon RPC is currently unreachable. Transactions may fail.";
    color = "var(--sds-color-feedback-error)";
    icon = <Icon.CloudOffline color={color} size="16px" />;
  } else if (status === "degraded") {
    title = `High RPC latency detected (${latency}ms). Transactions may be slow.`;
    color = "var(--sds-color-feedback-warning)";
    icon = <Icon.Activity color={color} size="16px" />;
  }

  if (congestion === "high") {
    title += " | Network is heavily congested. Higher fees required.";
  }

  if (isNetworkMismatch) {
    title = `Wallet mismatch: Wallet is on ${walletNetwork}, but app is on ${appNetwork}.`;
    color = "var(--sds-color-feedback-error)";
    icon = <Icon.AlertCircle color={color} size="16px" />;
  }

  return (
    <div
      role="status"
      style={{
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        padding: "4px 10px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "help",
        border: isNetworkMismatch || status !== "online" ? `1px solid ${color}` : "none",
        transition: "all 0.2s ease"
      }}
      title={title}
    >
      {icon}
      <span>{appNetwork}</span>
      {congestion === "high" && (
        <span className="ml-1" title="High Network Congestion">🔥</span>
      )}
    </div>
  );
};

export default NetworkPill;
