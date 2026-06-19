const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function recordWithdrawalEvent(params: {
  workerAddress: string;
  employerAddress: string;
  streamId: string;
  amount: number;
  tokenSymbol: string;
  txHash: string;
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
      }),
    });
  } catch {
    // non-critical — don't block the UI
  }
}
