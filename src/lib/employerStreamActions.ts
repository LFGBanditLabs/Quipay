import {
  buildCancelStreamTx,
  buildPauseStreamTx,
  buildResumeStreamTx,
  submitAndAwaitTx,
} from "../contracts/payroll_stream";
import type { StreamAction } from "../hooks/useStreamActions";

export type SignXdr = (preparedXdr: string, address: string) => Promise<string>;

export async function submitEmployerStreamAction({
  streamId,
  employerAddress,
  action,
  signXdr,
}: {
  streamId: bigint;
  employerAddress: string;
  action: StreamAction;
  signXdr: SignXdr;
}): Promise<string> {
  const { preparedXdr } =
    action === "pause"
      ? await buildPauseStreamTx(streamId, employerAddress)
      : action === "resume"
        ? await buildResumeStreamTx(streamId, employerAddress)
        : await buildCancelStreamTx(streamId, employerAddress);

  const signedXdr = await signXdr(preparedXdr, employerAddress);
  return submitAndAwaitTx(signedXdr);
}
