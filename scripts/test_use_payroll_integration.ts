import { config } from "dotenv";
import { resolve } from "path";
import {
  getStreamsByEmployer,
  getStream,
  getVaultBalance,
  getVaultLiability,
} from "../src/contracts/payroll_stream.js"; // In raw node scripts, we might not have TS aliasing. Wait!

config({ path: resolve(process.cwd(), ".env") });

const PAYROLL_VAULT_CONTRACT_ID =
  process.env.VITE_PAYROLL_VAULT_CONTRACT_ID || "";
const EMPLOYER_ADDRESS =
  process.env.HOT_WALLET_ACCOUNT ||
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TOKEN_NATIVE = "";

async function main() {
  console.log("Checking integration...");
  try {
    const bal = await getVaultBalance(
      PAYROLL_VAULT_CONTRACT_ID,
      TOKEN_NATIVE,
      EMPLOYER_ADDRESS,
    );
    console.log("Vault Balance (Native):", bal);

    const liab = await getVaultLiability(
      PAYROLL_VAULT_CONTRACT_ID,
      TOKEN_NATIVE,
      EMPLOYER_ADDRESS,
    );
    console.log("Vault Liability (Native):", liab);

    const streams = await getStreamsByEmployer(EMPLOYER_ADDRESS, 0, 10);
    console.log("Streams for employer:", streams);

    for (const st of streams) {
      console.log(`Stream ${st}:`, await getStream(st, EMPLOYER_ADDRESS));
    }

    console.log("Integration test passes!");
  } catch (error) {
    console.error("Integration failed:", error);
    process.exit(1);
  }
}

main();
