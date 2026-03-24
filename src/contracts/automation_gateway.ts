import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
} from "@stellar/stellar-sdk";
import { rpcUrl } from "./util";

export const AUTOMATION_GATEWAY_CONTRACT_ID: string =
  (
    import.meta.env.VITE_AUTOMATION_GATEWAY_CONTRACT_ID as string | undefined
  )?.trim() ?? "";

export enum Permission {
  ExecutePayroll = 1,
  ManageTreasury = 2,
  RegisterAgent = 3,
  CreateStream = 4,
  CancelStream = 5,
  RebalanceTreasury = 6,
}

export interface Agent {
  address: string;
  permissions: Permission[];
  registered_at: number;
}

function getRpcServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl, { allowHttp: true });
}

export async function getAdmin(): Promise<string> {
  const server = getRpcServer();
  const contract = new Contract(AUTOMATION_GATEWAY_CONTRACT_ID);

  const tx = contract.call("get_admin");
  const response = await server.simulateTransaction(
    new TransactionBuilder(
      await server.getAccount(AUTOMATION_GATEWAY_CONTRACT_ID), // Dummy account for simulation
      { fee: "100", networkPassphrase: "" },
    )
      .addOperation(tx)
      .build(),
  );

  if (SorobanRpc.Api.isSimulationSuccess(response)) {
    return scValToNative(response.result!.retval);
  }
  throw new Error("Failed to get admin");
}

export async function getAgent(agentAddress: string): Promise<Agent | null> {
  const server = getRpcServer();
  const contract = new Contract(AUTOMATION_GATEWAY_CONTRACT_ID);

  const tx = contract.call("get_agent", new Address(agentAddress).toScVal());
  const response = await server.simulateTransaction(
    new TransactionBuilder(
      await server.getAccount(AUTOMATION_GATEWAY_CONTRACT_ID),
      { fee: "100", networkPassphrase: "" },
    )
      .addOperation(tx)
      .build(),
  );

  if (SorobanRpc.Api.isSimulationSuccess(response)) {
    const native = scValToNative(response.result!.retval);
    return {
      address: native.address,
      permissions: native.permissions,
      registered_at: Number(native.registered_at),
    };
  }
  return null;
}

export async function isAuthorized(
  agentAddress: string,
  permission: Permission,
): Promise<boolean> {
  const server = getRpcServer();
  const contract = new Contract(AUTOMATION_GATEWAY_CONTRACT_ID);

  const tx = contract.call(
    "is_authorized",
    new Address(agentAddress).toScVal(),
    nativeToScVal(permission, { type: "u32" }),
  );
  const response = await server.simulateTransaction(
    new TransactionBuilder(
      await server.getAccount(AUTOMATION_GATEWAY_CONTRACT_ID),
      { fee: "100", networkPassphrase: "" },
    )
      .addOperation(tx)
      .build(),
  );

  if (SorobanRpc.Api.isSimulationSuccess(response)) {
    return scValToNative(response.result!.retval);
  }
  return false;
}
