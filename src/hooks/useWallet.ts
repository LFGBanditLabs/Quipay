import { useContext } from "react";
import { WalletContext } from "../providers/WalletProvider";

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
};
