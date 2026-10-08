import {
  CCTP_CONTRACT_ID,
  buildBurnTx,
  buildReceiveMessageTx,
  isMessageProcessed,
  getMessageHash,
} from "../cctp_message_transmitter";
import * as SorobanClient from "@stellar/stellar-sdk";

jest.mock("../util", () => ({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
}));

jest.mock("../../lib/tokenAddresses", () => ({
  getTokenAddresses: () => ({
    USDC: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    XLM: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  }),
}));

describe("CCTP Message Transmitter Client (Issue #1123)", () => {
  const dummyCaller = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
  const dummyRecipient = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

  it("exports contract interface constants", () => {
    expect(typeof CCTP_CONTRACT_ID).toBe("string");
  });

  it("extracts transaction hash directly as fallback for attestation lookup", async () => {
    const mockServer = {
      getTransaction: jest.fn().mockResolvedValue({
        status: "SUCCESS",
      }),
    };
    jest.spyOn(SorobanClient.rpc, "Server").mockReturnValue(mockServer as any);

    const hash = await getMessageHash("0x1234567890abcdef");
    expect(hash).toBe("0x1234567890abcdef");
  });

  it("returns null if transaction failed or not found", async () => {
    const mockServer = {
      getTransaction: jest.fn().mockResolvedValue({
        status: "FAILED",
      }),
    };
    jest.spyOn(SorobanClient.rpc, "Server").mockReturnValue(mockServer as any);

    const hash = await getMessageHash("0xbadtx");
    expect(hash).toBeNull();
  });
});
