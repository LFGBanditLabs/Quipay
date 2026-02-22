import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { connectWallet, disconnectWallet } from "../util/wallet";
import { Spinner } from "./Loading";

/**
 * WalletConnect component
 *
 * Handles Freighter wallet connection, displays the connected address,
 * provides disconnect functionality, and surfaces connection errors.
 */
export const WalletConnect = () => {
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

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="wallet-connect">
      {connectionError && (
        <div className="wallet-connect__error" role="alert">
          <span>{connectionError}</span>
          <button
            onClick={clearError}
            className="wallet-connect__error-dismiss"
            aria-label="Dismiss error"
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
            aria-label={`Connected wallet: ${address}`}
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
                <Spinner size="sm" /> Disconnecting…
              </>
            ) : (
              "Disconnect"
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
              <Spinner size="sm" /> Connecting…
            </>
          ) : (
            "Connect Wallet"
          )}
        </button>
      )}
    </div>
  );
};
