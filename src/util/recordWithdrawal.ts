const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function recordWithdrawalEvent(params: {
  workerAddress: string;
  employerAddress: string;
  streamId: string;
  amount: number;
  tokenSymbol: string;
  txHash: string;
  /** Destination chain for cross-chain withdrawals */
  destChain?: string;
  /** Destination EVM address for cross-chain withdrawals */
  destAddress?: string;
}): Promise<void> {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/api/employers/withdrawal-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerAddress: params.workerAddress,
        employerAddress: params.employerAddress,
        streamId: params.streamId,
        amount: params.amount.toFixed(7),
        tokenSymbol: params.tokenSymbol,
        txHash: params.txHash,
        destChain: params.destChain ?? null,
        destAddress: params.destAddress ?? null,
      }),
    });
  } catch {
    // non-critical — don't block the UI
  }
}
