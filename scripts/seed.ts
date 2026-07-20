import {
  Keypair,
  rpc as SorobanRpc,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// the main variables
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const XLM_SAC_TESTNET = process.env.XLM_SAC_TESTNET;
const STREAM_CONTRACT_ID = process.env.VITE_PAYROLL_STREAM_CONTRACT_ID;

if (!XLM_SAC_TESTNET || !STREAM_CONTRACT_ID) {
  console.error(
    "Missing XLM_SAC_TESTNET or VITE_PAYROLL_STREAM_CONTRACT_ID in .env",
  );
  process.exit(1);
}

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

async function fundAccount(publicKey: string) {
  console.log(`Funding ${publicKey} via Friendbot...`);
  try {
    const res = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
    if (!res.ok) {
      throw new Error(`Failed to fund ${publicKey}`);
    }
    console.log(`Funded ${publicKey}`);
  } catch (err) {
    console.error(`Error funding ${publicKey}:`, err);
    throw err;
  }
}

async function createStream(
  employer: Keypair,
  worker: string,
  amount: bigint,
  rate: bigint,
  startTs: number,
  endTs: number,
) {
  console.log(`Creating stream from ${employer.publicKey()} to ${worker}...`);
  const account = await server.getAccount(employer.publicKey());
  const contract = new Contract(STREAM_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "create_stream",
        new Address(employer.publicKey()).toScVal(),
        new Address(worker).toScVal(),
        new Address(XLM_SAC_TESTNET).toScVal(),
        nativeToScVal(rate, { type: "i128" }),
        nativeToScVal(amount, { type: "i128" }),
        nativeToScVal(BigInt(startTs), { type: "u64" }),
        nativeToScVal(BigInt(endTs), { type: "u64" }),
        xdr.ScVal.scvVoid(),
      ),
    )
    .setTimeout(300)
    .build();

  // prepare transaction
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(employer);

  const sendResponse = await server.sendTransaction(prepared);
  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Failed to submit tx: ${JSON.stringify(sendResponse.errorResult)}`,
    );
  }

  const hash = sendResponse.hash;
  console.log(`Tx submitted: ${hash}. Waiting for confirmation...`);

  let statusResponse = await server.getTransaction(hash);
  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  while (
    (statusResponse.status === "NOT_FOUND" ||
      statusResponse.status === "PENDING") &&
    attempts < MAX_ATTEMPTS
  ) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    statusResponse = await server.getTransaction(hash);
    attempts++;
  }

  if (attempts === MAX_ATTEMPTS) {
    throw new Error(
      `Tx ${hash} did not confirm after ${MAX_ATTEMPTS} attempts`,
    );
  }

  if (statusResponse.status === "SUCCESS") {
    console.log(`Stream created successfully in tx ${hash}`);
  } else {
    throw new Error(`Tx failed: ${hash}`);
  }
}

interface SeedOutput {
  employers: { publicKey: string; secretKey: string }[];
  workers: { publicKey: string; secretKey: string }[];
  activeStreams: { employer: string; worker: string; status: string }[];
  expiredStreams: { employer: string; worker: string; status: string }[];
}

async function run() {
  console.log("Starting Quipay Local Development Seed Script...");

  const output: SeedOutput = {
    employers: [],
    workers: [],
    activeStreams: [],
    expiredStreams: [],
  };

  const outPath = path.resolve(__dirname, "../seed-output.json");
  let employers: Keypair[] = [];
  let workers: Keypair[] = [];

  if (fs.existsSync(outPath)) {
    console.log("Reusing existing keypairs from seed-output.json...");
    const existing = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    employers = existing.employers.map((e: any) =>
      Keypair.fromSecret(e.secretKey),
    );
    workers = existing.workers.map((w: any) => Keypair.fromSecret(w.secretKey));
  } else {
    console.log("Generating keypairs...");
    employers = [Keypair.random(), Keypair.random()];
    workers = [
      Keypair.random(),
      Keypair.random(),
      Keypair.random(),
      Keypair.random(),
      Keypair.random(),
    ];
  }

  for (const emp of employers) {
    await fundAccount(emp.publicKey());
    output.employers.push({
      publicKey: emp.publicKey(),
      secretKey: emp.secret(),
    });
  }

  for (const w of workers) {
    await fundAccount(w.publicKey());
    output.workers.push({
      publicKey: w.publicKey(),
      secretKey: w.secret(),
    });
  }

  // 10 active streams
  // 3 expired streams
  // distribute them among employers and workers
  const now = Math.floor(Date.now() / 1000);

  // active streams start 1 week ago, end 3 weeks from now
  const activeStart = now - 7 * 24 * 60 * 60;
  const activeEnd = now + 21 * 24 * 60 * 60;

  // expired streams start 5 weeks ago, end 1 week ago
  const expiredStart = now - 35 * 24 * 60 * 60;
  const expiredEnd = now - 7 * 24 * 60 * 60;

  const totalAmount = BigInt(100 * 1e7); // 100 XLM
  const activeRate = totalAmount / BigInt(activeEnd - activeStart);
  const expiredRate = totalAmount / BigInt(expiredEnd - expiredStart);

  let activeCount = 0;
  let expiredCount = 0;

  for (let i = 0; i < 13; i++) {
    const emp = employers[i % employers.length];
    const wrk = workers[i % workers.length];

    if (i < 10) {
      await createStream(
        emp,
        wrk.publicKey(),
        totalAmount,
        activeRate,
        activeStart,
        activeEnd,
      );
      activeCount++;
      output.activeStreams.push({
        employer: emp.publicKey(),
        worker: wrk.publicKey(),
        status: "active",
      });
    } else {
      await createStream(
        emp,
        wrk.publicKey(),
        totalAmount,
        expiredRate,
        expiredStart,
        expiredEnd,
      );
      expiredCount++;
      output.expiredStreams.push({
        employer: emp.publicKey(),
        worker: wrk.publicKey(),
        status: "expired",
      });
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.warn(
    "WARNING: seed-output.json contains testnet secret keys in plaintext.",
  );
  console.warn("Never reuse these keys on mainnet or in production!");
  console.log(`Seed script completed successfully! Data saved to ${outPath}`);
}

run().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
