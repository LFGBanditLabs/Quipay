import { useCallback } from "react";
import { useWallet } from "./useWallet";
import { useNetworkStatus } from "../providers/NetworkStatusProvider";
import { useNotification } from "./useNotification";
import { stellarNetwork } from "../contracts/util";

interface PreflightOptions {
  requireWallet?: boolean;
  actionLabel: string;
}

const normalizeNetwork = (value?: string) =>
  (value ?? "").toUpperCase().replace("STANDALONE", "LOCAL");

export function usePreflightChecks() {
  const { address, network, balances } = useWallet();
  const { status } = useNetworkStatus();
  const { addNotification } = useNotification();

  return useCallback(
    (options: PreflightOptions): boolean => {
      if (options.requireWallet !== false && !address) {
        addNotification(
          `Connect wallet before ${options.actionLabel}.`,
          "warning",
        );
        return false;
      }

      if (status === "offline") {
        addNotification(
          "Network endpoints are currently unreachable. Please retry shortly.",
          "error",
        );
        return false;
      }

      const walletNetwork = normalizeNetwork(network);
      const appNetwork = normalizeNetwork(stellarNetwork);
      if (address && walletNetwork && walletNetwork !== appNetwork) {
        addNotification(
          `Wallet network mismatch. Switch wallet to ${appNetwork}.`,
          "error",
        );
        return false;
      }

      if (address) {
        const xlmBalance = Number(balances.XLM?.balance ?? 0);
        if (Number.isFinite(xlmBalance) && xlmBalance < 0.1) {
          addNotification(
            "Add XLM to wallet to cover transaction fees.",
            "warning",
          );
        }
      }

      return true;
    },
    [address, addNotification, balances.XLM?.balance, network, status],
  );
}
