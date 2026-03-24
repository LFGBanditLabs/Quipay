import { useState } from "react";

import { SimulationResult } from "../util/simulationUtils";
import TransactionSimulationModal from "../components/TransactionSimulationModal";

export default function WithdrawPage() {
  const [showSim, setShowSim] = useState(false);

  // ── Demo values ──
  const amount = "250.00";
  const balance = 1250.0;

  // ── Mock simulate — replace with real simulateTransaction() call ──
  const mockSimulate = async (): Promise<SimulationResult> => {
    await new Promise((res) => setTimeout(res, 1800)); // fake network delay
    return {
      status: "success",
      estimatedFeeStroops: 74821,
      estimatedFeeXLM: 0.0074821,
      restoreRequired: false,
      balanceChanges: [
        {
          token: "USDC",
          symbol: "USDC",
          before: 1250.0,
          after: 1500.0,
          delta: 250.0,
        },
        {
          token: "XLM",
          symbol: "XLM",
          before: 10.5,
          after: 10.4925179,
          delta: -0.0074821,
        },
      ],
      resources: {
        instructions: 2_847_326,
        readBytes: 18_432,
        writeBytes: 4_096,
        readEntries: 4,
        writeEntries: 2,
      },
    };
  };

  const handleSign = () => {
    setShowSim(false);
    console.log("Wallet signing triggered!");
  };

  return (
    <>
      <button onClick={() => setShowSim(true)}>Withdraw</button>

      <TransactionSimulationModal
        open={showSim}
        preview={{
          description: `Withdraw ${amount} USDC`,
          contractFunction: "withdraw",
          contractAddress: "CAAWR...XQ2F",
          currentBalances: [{ token: "USDC", symbol: "USDC", amount: balance }],
        }}
        onSimulate={mockSimulate}
        onConfirm={handleSign}
        onCancel={() => setShowSim(false)}
      />
    </>
  );
}
