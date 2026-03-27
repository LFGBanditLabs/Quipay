import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "../hooks/useWallet";
import { connectWallet, disconnectWallet } from "../util/wallet";
import { shortenAddress } from "../util/address";
import { Spinner } from "./Loading";

/**
 * WalletConnect component
 *
 * Handles Freighter wallet connection, displays the connected address,
 * provides disconnect functionality, and surfaces connection errors.
 */
export const WalletConnect = () => {
  const { t } = useTranslation();
  const { address, isPending, connectionError, clearError } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    clearError();
    setIsConnecting(true);
    try {
      await connectWallet();
    } catch (err) {
      // connectWallet surfaces errors via WalletProvider polling;
      // local errors (e.g. user closed modal) are silently ignored.
      console.error("Wallet connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectWallet();
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="wallet-connect">
      {connectionError && (
        <div className="wallet-connect__error" role="alert">
          <span>{connectionError}</span>
          <button
            onClick={clearError}
            className="wallet-connect__error-dismiss"
            aria-label={t("wallet.dismiss_error")}
          >
            ✕
          </button>
        </div>
      )}

      {address ? (
        <div className="wallet-connect__connected">
          <span
            className="wallet-connect__address"
            title={address}
            aria-label={t("wallet.connected_address", { address })}
          >
            {shortenAddress(address)}
          </span>
          <button
            className="wallet-connect__btn wallet-connect__btn--disconnect"
            onClick={() => void handleDisconnect()}
            disabled={isDisconnecting || isPending}
            aria-busy={isDisconnecting}
          >
            {isDisconnecting ? (
              <>
                <Spinner size="sm" /> {t("wallet.disconnecting")}
              </>
            ) : (
              t("wallet.disconnect")
            )}
          </button>
        </div>
      ) : (
        <button
          className="wallet-connect__btn wallet-connect__btn--connect"
          onClick={() => void handleConnect()}
          disabled={isConnecting || isPending}
          aria-busy={isConnecting || isPending}
        >
          {isConnecting || isPending ? (
            <>
              <Spinner size="sm" /> {t("wallet.connecting")}
            </>
          ) : (
            t("wallet.connect")
          )}
        </button>
      )}
    </div>
  );
};
