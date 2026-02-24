import React from "react";
import { stellarNetwork } from "../contracts/util";
import FundAccountButton from "./FundAccountButton";
import { WalletButton } from "./WalletButton";
import NetworkPill from "./NetworkPill";

const ConnectAccount: React.FC = () => {
  return (
    <div
      aria-label="Account and Network Tools"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "var(--connect-account-justify, flex-end)",
        flexWrap: "wrap",
        gap: "10px",
        verticalAlign: "middle",
        maxWidth: "100%",
      }}
    >
      <WalletButton />
      {stellarNetwork !== "PUBLIC" && <FundAccountButton />}
      <NetworkPill />
    </div>
  );
};

export default ConnectAccount;
