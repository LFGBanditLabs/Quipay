const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function recordDepositEvent(params: {
  employerAddress: string;
  amount: number;
  tokenSymbol: string;
  txHash: string;
  /** Source chain for cross-chain deposits (e.g., "Base", "Ethereum") */
  sourceChain?: string;
  /** Source EVM address for cross-chain deposits */
  sourceAddress?: string;
}): Promise<void> {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/api/employers/deposit-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employerAddress: params.employerAddress,
        amount: params.amount.toFixed(7),
        tokenSymbol: params.tokenSymbol,
        txHash: params.txHash,
        sourceChain: params.sourceChain ?? null,
        sourceAddress: params.sourceAddress ?? null,
      }),
    });
  } catch {
    // non-critical — don't block the UI
  }
}
