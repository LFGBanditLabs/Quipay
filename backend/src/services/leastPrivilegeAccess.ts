import { vaultService } from "./vaultService";
import { VaultClient } from "./vaultClient";

export interface LeastPrivilegePolicy {
  name: string;
  description: string;
  path: string;
  capabilities: string[];
  requiredSecretPaths: string[];
}

export const QUIPAY_POLICIES = {
  AGENT_KEY_ACCESS: {
    name: "quipay-agent-key-access",
    description: "Least privilege access for AI agent to sign transactions",
    path: "quipay/keys",
    capabilities: ["read"],
    requiredSecretPaths: ["quipay/keys/hot-wallet"],
  },

  KEY_ROTATION: {
    name: "quipay-key-rotation",
    description: "Policy for automated key rotation service",
    path: "quipay/keys",
    capabilities: ["create", "read", "update", "delete"],
    requiredSecretPaths: ["quipay/keys/*"],
  },

  ADMIN: {
    name: "quipay-admin",
    description: "Full administrative access to Quipay secrets",
    path: "quipay",
    capabilities: ["create", "read", "update", "delete", "list"],
    requiredSecretPaths: ["quipay/*"],
  },
};

export class LeastPrivilegeAccess {
  private client: VaultClient;

  constructor(client: VaultClient) {
    this.client = client;
  }

  generatePolicyDocument(policy: LeastPrivilegePolicy): string {
    const pathRules = policy.requiredSecretPaths.map((path) => {
      return `
path "${path}" {
  capabilities = [${policy.capabilities.map((c) => `"${c}"`).join(", ")}]
}`;
    });

    return `
# ${policy.description}
name = "${policy.name}"
${pathRules.join("\n")}
`.trim();
  }

  async createAgentPolicy(): Promise<boolean> {
    try {
      const policyDocument = this.generatePolicyDocument(
        QUIPAY_POLICIES.AGENT_KEY_ACCESS,
      );
      await this.client.createPolicy(
        QUIPAY_POLICIES.AGENT_KEY_ACCESS.name,
        policyDocument,
      );
      console.log("[LeastPrivilegeAccess] Created agent policy successfully");
      return true;
    } catch (error) {
      console.error(
        "[LeastPrivilegeAccess] Failed to create agent policy:",
        error,
      );
      return false;
    }
  }

  async createRotationPolicy(): Promise<boolean> {
    try {
      const policyDocument = this.generatePolicyDocument(
        QUIPAY_POLICIES.KEY_ROTATION,
      );
      await this.client.createPolicy(
        QUIPAY_POLICIES.KEY_ROTATION.name,
        policyDocument,
      );
      console.log(
        "[LeastPrivilegeAccess] Created rotation policy successfully",
      );
      return true;
    } catch (error) {
      console.error(
        "[LeastPrivilegeAccess] Failed to create rotation policy:",
        error,
      );
      return false;
    }
  }

  async createAppRole(
    roleName: string,
    policyNames: string[],
  ): Promise<boolean> {
    try {
      await this.client.createAppRole(roleName, policyNames);
      console.log(`[LeastPrivilegeAccess] Created AppRole: ${roleName}`);
      return true;
    } catch (error) {
      console.error(
        `[LeastPrivilegeAccess] Failed to create AppRole ${roleName}:`,
        error,
      );
      return false;
    }
  }

  async setupLeastPrivilegeAccess(): Promise<boolean> {
    try {
      await this.createAgentPolicy();
      await this.createRotationPolicy();
      await this.createAppRole("quipay-agent", ["quipay-agent-key-access"]);
      await this.createAppRole("quipay-rotation", ["quipay-key-rotation"]);

      console.log(
        "[LeastPrivilegeAccess] Successfully set up least privilege access",
      );
      return true;
    } catch (error) {
      console.error(
        "[LeastPrivilegeAccess] Failed to set up least privilege access:",
        error,
      );
      return false;
    }
  }
}

export const leastPrivilegeAccess = new LeastPrivilegeAccess(
  new VaultClient({
    url: process.env.VAULT_ADDR || "http://localhost:8200",
    token: process.env.VAULT_TOKEN || "",
  }),
);
