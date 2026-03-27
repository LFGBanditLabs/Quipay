import { Router, Request, Response } from "express";
import {
  rpc,
  TransactionBuilder,
  FeeBumpTransaction,
} from "@stellar/stellar-sdk";
import NodeCache from "node-cache";

export const stellarRouter = Router();

// Cache for fee estimates (TTL: 30 seconds)
const feeEstimateCache = new NodeCache({ stdTTL: 30, checkperiod: 5 });

const SOROBAN_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const server = new rpc.Server(SOROBAN_RPC_URL);

/**
 * POST /api/stellar/estimate-fee
 * Estimate transaction fee via Soroban RPC simulation
 */
stellarRouter.post(
  "/estimate-fee",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { transactionXdr } = req.body;

      if (!transactionXdr) {
        return res.status(400).json({
          error: "Missing required field: transactionXdr",
        });
      }

      if (typeof transactionXdr !== "string") {
        return res.status(400).json({
          error: "transactionXdr must be a string",
        });
      }

      // Check cache first
      const cacheKey = `fee:${transactionXdr}`;
      const cachedResult = feeEstimateCache.get(cacheKey);
      if (cachedResult) {
        return res.json({
          ...cachedResult,
          cached: true,
          cachedAt: new Date().toISOString(),
        });
      }

      // Parse the transaction XDR
      let transaction: any;
      try {
        transaction = TransactionBuilder.fromXDR(
          transactionXdr,
          networkPassphrase,
        );
      } catch (parseError: any) {
        return res.status(400).json({
          error: "Invalid transaction XDR",
          details: parseError.message,
        });
      }

      // Simulate transaction to get fee estimate
      const simulationResult = await server.simulateTransaction(transaction);

      // Check if simulation failed (error is a string in error responses)
      if (
        "error" in simulationResult &&
        typeof simulationResult.error === "string"
      ) {
        return res.status(400).json({
          error: "Transaction simulation failed",
          details: simulationResult.error || "Unknown simulation error",
          simulationResult: {
            error: simulationResult.error,
          },
        });
      }

      // Type guard for successful simulation
      if (
        !("transactionData" in simulationResult) ||
        !simulationResult.transactionData
      ) {
        return res.status(400).json({
          error: "Invalid simulation response",
        });
      }

      // Calculate estimated fee in stroops
      const txData = simulationResult.transactionData as any;
      const estimatedFeeStroops = simulationResult.minResourceFee
        ? BigInt(simulationResult.minResourceFee)
        : BigInt(txData.resourceFee || 0);

      // Convert to XLM (1 XLM = 10,000,000 stroops)
      const estimatedFeeXLM = Number(estimatedFeeStroops) / 10_000_000;

      const result = {
        estimatedFeeStroops: estimatedFeeStroops.toString(),
        estimatedFeeXLM: estimatedFeeXLM.toFixed(7),
        resourceFee: (txData.resourceFee || 0).toString(),
        inclusionFee: (txData.inclusionFee || 0).toString(),
        simulatedAt: new Date().toISOString(),
      };

      // Cache the result
      feeEstimateCache.set(cacheKey, result);

      res.json(result);
    } catch (error: any) {
      console.error("[Fee Estimation] Error:", error.message);

      // Handle specific error types
      if (error.message?.includes("transaction not found")) {
        return res.status(404).json({
          error: "Transaction not found on network",
          details: error.message,
        });
      }

      if (
        error.message?.includes("RPC") ||
        error.message?.includes("network")
      ) {
        return res.status(503).json({
          error: "Stellar RPC service unavailable",
          details: error.message,
        });
      }

      res.status(500).json({
        error: "Failed to estimate transaction fee",
        details: error.message,
      });
    }
  },
);

const networkPassphrase =
  process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

/**
 * GET /api/stellar/health
 * Health check for Stellar RPC connection
 */
stellarRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const latestLedger = await server.getLatestLedger();
    res.json({
      status: "healthy",
      latestLedger: latestLedger.sequence,
      rpcUrl: SOROBAN_RPC_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      rpcUrl: SOROBAN_RPC_URL,
    });
  }
});
