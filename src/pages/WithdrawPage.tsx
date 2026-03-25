import { useState, useEffect } from "react";

import { SimulationResult } from "../util/simulationUtils";
import TransactionSimulationModal from "../components/TransactionSimulationModal";
import { useWallet } from "../hooks/useWallet";
import { useStreams, WorkerStream } from "../hooks/useStreams";
import {
  getWithdrawable,
  PAYROLL_STREAM_CONTRACT_ID,
} from "../contracts/payroll_stream";
import { simulatePayrollStreamWithdrawFee } from "../util/withdrawFeeEstimate";

const STROOPS_PER_UNIT = 1e7;

export default function WithdrawPage() {
  const { address } = useWallet();
  const { streams, isLoading, error } = useStreams(address);
  const [showSim, setShowSim] = useState(false);
  const [selectedStream, setSelectedStream] = useState<WorkerStream | null>(
    null,
  );
  const [withdrawableAmount, setWithdrawableAmount] = useState<number>(0);
  const [loadingWithdrawable, setLoadingWithdrawable] = useState(false);

  useEffect(() => {
    if (!selectedStream || !address) return;

    let cancelled = false;
    const fetchWithdrawable = async () => {
      setLoadingWithdrawable(true);
      try {
        const raw = await getWithdrawable(BigInt(selectedStream.id));
        if (!cancelled && raw !== null) {
          setWithdrawableAmount(Number(raw) / STROOPS_PER_UNIT);
        }
      } catch {
        if (!cancelled) setWithdrawableAmount(0);
      } finally {
        if (!cancelled) setLoadingWithdrawable(false);
      }
    };

    void fetchWithdrawable();
    return () => {
      cancelled = true;
    };
  }, [selectedStream, address]);

  const handleWithdraw = (stream: WorkerStream) => {
    setSelectedStream(stream);
    setShowSim(true);
  };

  const handleSimulate = async (): Promise<SimulationResult> => {
    if (!address || !selectedStream) {
      return {
        status: "error",
        estimatedFeeStroops: 0,
        estimatedFeeXLM: 0,
        balanceChanges: [],
        errorMessage: "No wallet connected or no stream selected.",
        restoreRequired: false,
      };
    }

    return simulatePayrollStreamWithdrawFee(
      address,
      Number(selectedStream.id),
      [
        {
          token: selectedStream.tokenSymbol,
          symbol: selectedStream.tokenSymbol,
          amount: selectedStream.totalAmount - selectedStream.claimedAmount,
        },
      ],
    );
  };

  const handleSign = () => {
    setShowSim(false);
    setSelectedStream(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Loading streams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-(--sds-color-feedback-error)">{error}</p>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">No active streams found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-xl font-semibold text-(--text)">
          Withdraw Earnings
        </h1>
        <div className="flex flex-col gap-4">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-(--surface-subtle) p-5"
            >
              <div>
                <p className="text-sm font-medium text-(--text)">
                  Stream #{stream.id} &middot; {stream.tokenSymbol}
                </p>
                <p className="text-xs text-muted">
                  From {stream.employerAddress.slice(0, 6)}...
                  {stream.employerAddress.slice(-4)}
                </p>
              </div>
              <button
                onClick={() => handleWithdraw(stream)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--accent-hover)"
              >
                Withdraw
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedStream && (
        <TransactionSimulationModal
          open={showSim}
          preview={{
            description: `Withdraw ${loadingWithdrawable ? "..." : withdrawableAmount.toFixed(2)} ${selectedStream.tokenSymbol}`,
            contractFunction: "withdraw",
            contractAddress: PAYROLL_STREAM_CONTRACT_ID
              ? `${PAYROLL_STREAM_CONTRACT_ID.slice(0, 5)}...${PAYROLL_STREAM_CONTRACT_ID.slice(-4)}`
              : "N/A",
            currentBalances: [
              {
                token: selectedStream.tokenSymbol,
                symbol: selectedStream.tokenSymbol,
                amount:
                  selectedStream.totalAmount - selectedStream.claimedAmount,
              },
            ],
          }}
          onSimulate={handleSimulate}
          onConfirm={handleSign}
          onCancel={() => {
            setShowSim(false);
            setSelectedStream(null);
          }}
        />
      )}
    </>
  );
}
