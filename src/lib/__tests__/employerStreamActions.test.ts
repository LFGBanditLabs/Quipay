import { submitEmployerStreamAction } from "../employerStreamActions";
import {
  buildCancelStreamTx,
  buildPauseStreamTx,
  buildResumeStreamTx,
  submitAndAwaitTx,
} from "../../contracts/payroll_stream";

jest.mock("../../contracts/payroll_stream", () => ({
  buildCancelStreamTx: jest.fn(),
  buildPauseStreamTx: jest.fn(),
  buildResumeStreamTx: jest.fn(),
  submitAndAwaitTx: jest.fn(),
}));

const buildCancelStreamTxMock = jest.mocked(buildCancelStreamTx);
const buildPauseStreamTxMock = jest.mocked(buildPauseStreamTx);
const buildResumeStreamTxMock = jest.mocked(buildResumeStreamTx);
const submitAndAwaitTxMock = jest.mocked(submitAndAwaitTx);

describe("submitEmployerStreamAction", () => {
  const employerAddress = "GEMPLOYER";
  const streamId = BigInt(42);
  const signXdr = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    buildCancelStreamTxMock.mockResolvedValue({ preparedXdr: "cancel-xdr" });
    buildPauseStreamTxMock.mockResolvedValue({ preparedXdr: "pause-xdr" });
    buildResumeStreamTxMock.mockResolvedValue({ preparedXdr: "resume-xdr" });
    signXdr.mockResolvedValue("signed-xdr");
    submitAndAwaitTxMock.mockResolvedValue("tx-hash");
  });

  it("signs and submits a prepared pause transaction", async () => {
    await expect(
      submitEmployerStreamAction({
        streamId,
        employerAddress,
        action: "pause",
        signXdr,
      }),
    ).resolves.toBe("tx-hash");

    expect(buildPauseStreamTxMock).toHaveBeenCalledWith(
      streamId,
      employerAddress,
    );
    expect(signXdr).toHaveBeenCalledWith("pause-xdr", employerAddress);
    expect(submitAndAwaitTxMock).toHaveBeenCalledWith("signed-xdr");
  });

  it("uses the resume builder for resume actions", async () => {
    await submitEmployerStreamAction({
      streamId,
      employerAddress,
      action: "resume",
      signXdr,
    });

    expect(buildResumeStreamTxMock).toHaveBeenCalledWith(
      streamId,
      employerAddress,
    );
    expect(buildPauseStreamTxMock).not.toHaveBeenCalled();
    expect(buildCancelStreamTxMock).not.toHaveBeenCalled();
  });

  it("uses the cancel builder for cancel actions", async () => {
    await submitEmployerStreamAction({
      streamId,
      employerAddress,
      action: "cancel",
      signXdr,
    });

    expect(buildCancelStreamTxMock).toHaveBeenCalledWith(
      streamId,
      employerAddress,
    );
    expect(buildPauseStreamTxMock).not.toHaveBeenCalled();
    expect(buildResumeStreamTxMock).not.toHaveBeenCalled();
  });

  it("does not submit when signing is rejected", async () => {
    signXdr.mockRejectedValueOnce(new Error("User rejected signature"));

    await expect(
      submitEmployerStreamAction({
        streamId,
        employerAddress,
        action: "pause",
        signXdr,
      }),
    ).rejects.toThrow("User rejected signature");

    expect(submitAndAwaitTxMock).not.toHaveBeenCalled();
  });
});
