export type TreasuryTransactionType = "deposit" | "withdrawal";

export interface TreasuryTokenState {
  tokenSymbol: string;
  treasuryBalance: number;
  totalLiability: number;
}

export interface TreasuryTransaction {
  id: string;
  type: TreasuryTransactionType;
  tokenSymbol: string;
  amount: number;
  timestamp: string;
  status: "success";
}

interface TreasuryStore {
  tokenState: TreasuryTokenState[];
  history: TreasuryTransaction[];
}

const DEFAULT_STATE: TreasuryTokenState[] = [
  { tokenSymbol: "USDC", treasuryBalance: 5000, totalLiability: 1200 },
  { tokenSymbol: "XLM", treasuryBalance: 10000, totalLiability: 2500 },
];

const STORAGE_PREFIX = "quipay_treasury_state_v1";

const toFixedNumber = (value: number) => Number(value.toFixed(6));

const getStorageKey = (employerAddress: string) =>
  `${STORAGE_PREFIX}:${employerAddress}`;

const generateTxId = () =>
  `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const loadStore = (employerAddress: string): TreasuryStore => {
  const storageKey = getStorageKey(employerAddress);
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    const seeded: TreasuryStore = {
      tokenState: DEFAULT_STATE,
      history: [],
    };
    localStorage.setItem(storageKey, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as TreasuryStore;
    if (!Array.isArray(parsed.tokenState) || !Array.isArray(parsed.history)) {
      throw new Error("Malformed treasury storage");
    }
    return parsed;
  } catch {
    const reset: TreasuryStore = {
      tokenState: DEFAULT_STATE,
      history: [],
    };
    localStorage.setItem(storageKey, JSON.stringify(reset));
    return reset;
  }
};

const saveStore = (employerAddress: string, store: TreasuryStore): void => {
  localStorage.setItem(getStorageKey(employerAddress), JSON.stringify(store));
};

const getTokenState = (
  tokenState: TreasuryTokenState[],
  tokenSymbol: string,
): TreasuryTokenState => {
  const existing = tokenState.find(
    (token) => token.tokenSymbol === tokenSymbol,
  );
  if (existing) {
    return existing;
  }

  const created: TreasuryTokenState = {
    tokenSymbol,
    treasuryBalance: 0,
    totalLiability: 0,
  };
  tokenState.push(created);
  return created;
};

export const payrollVaultClient = {
  getTreasuryState(employerAddress: string): Promise<TreasuryStore> {
    return Promise.resolve(loadStore(employerAddress));
  },

  deposit(params: {
    employerAddress: string;
    tokenSymbol: string;
    amount: number;
  }): Promise<TreasuryStore> {
    const { employerAddress, tokenSymbol, amount } = params;
    if (amount <= 0) {
      throw new Error("Deposit amount must be greater than zero.");
    }

    const store = loadStore(employerAddress);
    const token = getTokenState(store.tokenState, tokenSymbol);
    token.treasuryBalance = toFixedNumber(token.treasuryBalance + amount);

    store.history.unshift({
      id: generateTxId(),
      type: "deposit",
      tokenSymbol,
      amount: toFixedNumber(amount),
      timestamp: new Date().toISOString(),
      status: "success",
    });

    saveStore(employerAddress, store);
    return Promise.resolve(store);
  },

  withdraw(params: {
    employerAddress: string;
    tokenSymbol: string;
    amount: number;
  }): Promise<TreasuryStore> {
    const { employerAddress, tokenSymbol, amount } = params;
    if (amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero.");
    }

    const store = loadStore(employerAddress);
    const token = getTokenState(store.tokenState, tokenSymbol);
    const available = token.treasuryBalance - token.totalLiability;
    if (amount > available) {
      throw new Error("Withdrawal exceeds available balance.");
    }

    token.treasuryBalance = toFixedNumber(token.treasuryBalance - amount);
    store.history.unshift({
      id: generateTxId(),
      type: "withdrawal",
      tokenSymbol,
      amount: toFixedNumber(amount),
      timestamp: new Date().toISOString(),
      status: "success",
    });

    saveStore(employerAddress, store);
    return Promise.resolve(store);
  },
};
