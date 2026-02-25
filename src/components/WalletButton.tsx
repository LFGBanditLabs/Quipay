import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { connectWallet, disconnectWallet } from "../util/wallet";

const truncateAddress = (address: string) =>
  `${address.slice(0, 4)}...${address.slice(-4)}`;

const formatXlm = (rawBalance?: string) => {
  if (!rawBalance) return "--";
  const amount = Number(rawBalance);
  if (!Number.isFinite(amount)) return rawBalance;
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const WalletButton = () => {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { address, isPending, balances, connectionError, clearError } =
    useWallet();

  const xlmBalance = useMemo(
    () => formatXlm(balances?.xlm?.balance),
    [balances?.xlm?.balance],
  );

  useEffect(() => {
    if (!showDisconnectModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDisconnectModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDisconnectModal]);

  if (!address) {
    const hasError = Boolean(connectionError);
    const showConnecting = isConnecting && !hasError;

    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            clearError();
            setIsConnecting(true);
            void connectWallet().finally(() => {
              setIsConnecting(false);
            });
          }}
          disabled={showConnecting}
          aria-label="Connect Wallet"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-400 hover:shadow-[0_16px_35px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:opacity-75"
        >
          {showConnecting ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
                aria-hidden="true"
              />
              Connecting...
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.85)]" />
              Connect Wallet
            </>
          )}
        </button>

        {hasError && (
          <p className="max-w-[280px] text-right text-xs text-rose-300">
            Connection failed. Try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setShowDisconnectModal(true)}
          aria-label={`Wallet connected: ${address}`}
          aria-expanded={showDisconnectModal}
          aria-haspopup="dialog"
          className="group inline-flex min-h-11 items-center gap-3 rounded-full border border-slate-300/20 bg-slate-900/70 px-3 py-2 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/45 hover:bg-slate-800/80 hover:shadow-[0_12px_30px_rgba(14,165,233,0.22)]"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/90 to-indigo-500/90 text-xs font-bold text-white">
            {address.slice(1, 3).toUpperCase()}
          </div>

          <div className="flex min-w-[150px] flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-100">
              {truncateAddress(address)}
            </span>
            <span className="text-xs text-slate-300">{xlmBalance} XLM</span>
          </div>

          <div className="relative flex h-4 w-4 items-center justify-center">
            {isPending ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200/60 border-t-cyan-200"
                aria-label="Wallet status: syncing"
              />
            ) : (
              <>
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/70" />
                <span
                  className="relative h-2.5 w-2.5 rounded-full bg-emerald-300"
                  aria-label="Wallet status: connected"
                />
              </>
            )}
          </div>
        </button>
      </div>

      {showDisconnectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setShowDisconnectModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-wallet-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200/20 bg-slate-900/75 p-5 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.75)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/85 to-indigo-500/85 text-xs font-bold text-white">
                {address.slice(1, 3).toUpperCase()}
              </div>
              <div>
                <p
                  id="disconnect-wallet-title"
                  className="text-sm font-semibold text-slate-100"
                >
                  Disconnect wallet?
                </p>
                <p className="text-xs text-slate-300">{address}</p>
              </div>
            </div>

            <p className="mb-5 text-sm text-slate-300">
              You can reconnect at any time from this button.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDisconnectModal(false);
                }}
                className="flex-1 rounded-xl border border-slate-200/15 bg-slate-800/55 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700/70"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setDisconnecting(true);
                  void disconnectWallet().finally(() => {
                    setDisconnecting(false);
                    setShowDisconnectModal(false);
                  });
                }}
                disabled={disconnecting}
                className="flex-1 rounded-xl border border-rose-300/35 bg-gradient-to-r from-rose-500 to-pink-500 px-3 py-2 text-sm font-semibold text-white transition hover:from-rose-400 hover:to-pink-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
