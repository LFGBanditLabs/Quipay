import React from "react";
import { Icon } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
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

  // Check if there's a network mismatch
  const walletNetwork = formatNetworkName(network ?? "");
  const isNetworkMismatch = walletNetwork !== appNetwork;

  let title = "";
  let color = "var(--sds-color-feedback-success)";
  if (!address) {
    title = "Connect your wallet using this network.";
    color = "var(--muted)";
  } else if (isNetworkMismatch) {
    title = `Wallet is on ${walletNetwork}, connect to ${appNetwork} instead.`;
    color = "var(--sds-color-feedback-error)";
  }

  return (
    <div
      role="status"
      aria-label={`Network: ${appNetwork}${isNetworkMismatch ? `. Mismatch: wallet is on ${walletNetwork}` : ""}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: "4px 10px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        cursor: isNetworkMismatch ? "help" : "default",
      }}
      title={title}
    >
      <Icon.Circle color={color} />
      {appNetwork}
    </div>
  );
};

export default NetworkPill;
