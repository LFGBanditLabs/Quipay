import { Keypair, rpc as SorobanRpc, TransactionBuilder, Contract, Address, nativeToScVal, Networks, xdr } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const XLM_SAC_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const STREAM_CONTRACT_ID = "CB4C43V42F5WWG5S7DK7JXCX7HYFPBTPNZ3F7M2A4DDWII2HUWNTHLWL"; 

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

async function createStream(employer: Keypair, worker: string, amount: bigint, rate: bigint, startTs: number, endTs: number) {
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
        xdr.ScVal.scvVoid()
      )
    )
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(employer);
  
  const sendResponse = await server.sendTransaction(prepared);
  if (sendResponse.status === "ERROR") {
    throw new Error(`Failed to submit tx: ${JSON.stringify(sendResponse.errorResult)}`);
  }
  
  const hash = sendResponse.hash;
  console.log(`Tx submitted: ${hash}. Waiting for confirmation...`);
  
  let statusResponse = await server.getTransaction(hash);
  while (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND || statusResponse.status === SorobanRpc.Api.GetTransactionStatus.PENDING) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    statusResponse = await server.getTransaction(hash);
  }
  
  if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    console.log(`Stream created successfully in tx ${hash}`);
  } else {
    throw new Error(`Tx failed: ${hash}`);
  }
}

async function run() {
  console.log("Starting Quipay Local Development Seed Script...");
  
  const output: any = { employers: [], workers: [], activeStreams: [], expiredStreams: [] };

  console.log("Generating keypairs...");
  const employers = [Keypair.random(), Keypair.random()];
  const workers = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];

  for (const emp of employers) {
    await fundAccount(emp.publicKey());
    output.employers.push({
      publicKey: emp.publicKey(),
      secretKey: emp.secret()
    });
  }

  for (const w of workers) {
    await fundAccount(w.publicKey());
    output.workers.push({
      publicKey: w.publicKey(),
      secretKey: w.secret()
    });
  }

  // 10 active streams
  // 3 expired streams
  // distribute them among employers and workers
  const now = Math.floor(Date.now() / 1000);
  const monthSeconds = 30 * 24 * 60 * 60;

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
      await createStream(emp, wrk.publicKey(), totalAmount, activeRate, activeStart, activeEnd);
      activeCount++;
      output.activeStreams.push({ employer: emp.publicKey(), worker: wrk.publicKey(), status: "active" });
    } else {
      await createStream(emp, wrk.publicKey(), totalAmount, expiredRate, expiredStart, expiredEnd);
      expiredCount++;
      output.expiredStreams.push({ employer: emp.publicKey(), worker: wrk.publicKey(), status: "expired" });
    }
  }

  const outPath = path.resolve(__dirname, '../seed-output.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Seed script completed successfully! Data saved to ${outPath}`);
}

run().catch(err => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
