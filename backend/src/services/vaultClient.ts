export interface VaultClientConfig {
  url: string;
  token: string;
  namespace?: string;
}

export class VaultClient {
  private baseUrl: string;
  private token: string;
  private namespace?: string;

  constructor(config: VaultClientConfig) {
    this.baseUrl = config.url;
    this.token = config.token;
    this.namespace = config.namespace;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "X-Vault-Token": this.token,
      "Content-Type": "application/json",
    };
    if (this.namespace) {
      headers["X-Vault-Namespace"] = this.namespace;
    }
    return headers;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sys/health`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async readSecret(path: string, mountPoint: string = "secret"): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/${mountPoint}/data/${path}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to read secret: ${response.statusText}`);
    }

    return response.json();
  }

  async writeSecret(
    path: string,
    data: Record<string, any>,
    mountPoint: string = "secret",
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/${mountPoint}/data/${path}`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ data }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to write secret: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteSecret(
    path: string,
    mountPoint: string = "secret",
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/${mountPoint}/data/${path}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to delete secret: ${response.statusText}`);
    }

    return response.json();
  }

  async listSecrets(
    path: string,
    mountPoint: string = "secret",
  ): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/v1/${mountPoint}/metadata/${path}`,
      {
        method: "LIST",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.keys || [];
  }

  async readPolicy(policyName: string): Promise<string | null> {
    const response = await fetch(
      `${this.baseUrl}/v1/sys/policies/acl/${policyName}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.policy || null;
  }

  async createPolicy(policyName: string, policyRules: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/sys/policies/acl/${policyName}`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: policyName,
          policy: policyRules,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create policy: ${response.statusText}`);
    }

    return response.json();
  }

  async enableSecretEngine(engineType: string, path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/sys/mounts/${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: engineType,
        description: "Quipay secret storage",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to enable secret engine: ${response.statusText}`);
    }

    return response.json();
  }

  async createAppRole(
    roleName: string,
    policies: string[],
    ttl: string = "1h",
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v1/sys/auth/approle/role/${roleName}`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          policies,
          ttl,
          max_ttl: "24h",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create AppRole: ${response.statusText}`);
    }

    return response.json();
  }

  async getAppRoleCredentials(
    roleName: string,
  ): Promise<{ role_id: string; secret_id: string }> {
    const roleIdResponse = await fetch(
      `${this.baseUrl}/v1/auth/approle/role/${roleName}/role-id`,
      {
        method: "GET",
        headers: this.getHeaders(),
      },
    );

    if (!roleIdResponse.ok) {
      throw new Error(`Failed to get role ID: ${roleIdResponse.statusText}`);
    }

    const roleIdData = await roleIdResponse.json();
    const roleId = roleIdData.data?.role_id;

    const secretIdResponse = await fetch(
      `${this.baseUrl}/v1/auth/approle/role/${roleName}/secret-id`,
      {
        method: "POST",
        headers: this.getHeaders(),
      },
    );

    if (!secretIdResponse.ok) {
      throw new Error(
        `Failed to get secret ID: ${secretIdResponse.statusText}`,
      );
    }

    const secretIdData = await secretIdResponse.json();
    const secretId = secretIdData.data?.secret_id;

    return { role_id: roleId, secret_id: secretId };
  }
}
