import { Horizon } from "@stellar/stellar-sdk";
import PQueue from "p-queue";

export class NonceManager {
  private currentSequence: bigint | null = null;
  private availableNonces: bigint[] = [];
  private accountId: string;
  private server: Horizon.Server;

  // Process queue to ensure strict sequential extraction when multiple requests hit at the exact same ms
  private requestQueue = new PQueue({ concurrency: 1 });

  constructor(
    accountId: string,
    horizonUrl: string = "https://horizon-testnet.stellar.org",
  ) {
    this.accountId = accountId;
    this.server = new Horizon.Server(horizonUrl);
  }

  /**
   * Initializes the manager by fetching the latest account sequence number from the network.
   */
  async initialize(): Promise<void> {
    return this.requestQueue.add(async () => {
      const account = await this.server.loadAccount(this.accountId);
      this.currentSequence = BigInt(account.sequence);
      this.availableNonces = [];
    });
  }

  /**
   * Acquires the next available sequence number.
   * If there are available nonces in the pool (e.g., from failed transactions),
   * it prioritizes the lowest one. Otherwise it increments the main sequence.
   */
  async getNonce(): Promise<string> {
    return this.requestQueue.add(async () => {
      if (this.currentSequence === null) {
        await this.initializeQueueFree();
      }

      // If we have returned/failed nonces, use the lowest one first
      if (this.availableNonces.length > 0) {
        // Keep the pool sorted to always fill the earliest gap
        this.availableNonces.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const recoveredNonce = this.availableNonces.shift()!;
        return recoveredNonce.toString();
      }

      // Otherwise increment and return the main sequence
      this.currentSequence! += 1n;
      return this.currentSequence!.toString();
    }) as Promise<string>;
  }

  /**
   * If a transaction fails before submitting or fails with bad_seq/tx_bad_seq,
   * release the nonce back to the manager so it can be re-used to prevent gaps.
   */
  releaseNonce(nonceStr: string): void {
    const nonce = BigInt(nonceStr);
    // Ensure we don't duplicate a recovered nonce
    if (!this.availableNonces.includes(nonce)) {
      this.availableNonces.push(nonce);
    }
  }

  /**
   * Get the current state of the manager without incrementing.
   */
  getCurrentState() {
    return {
      currentSequence: this.currentSequence?.toString() || null,
      availableNonces: this.availableNonces.map((n) => n.toString()),
    };
  }

  // Helper to avoid deadlock when calling initialize() from inside getNonce()'s queue context
  private async initializeQueueFree(): Promise<void> {
    const account = await this.server.loadAccount(this.accountId);
    this.currentSequence = BigInt(account.sequence);
    this.availableNonces = [];
  }
}
