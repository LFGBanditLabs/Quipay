import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3000,
  stellar: {
    network: process.env.STELLAR_NETWORK || 'TESTNET',
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  }
};
