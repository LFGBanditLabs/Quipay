import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wallet } from "../util/wallet";
import storage from "../util/storage";
import { fetchBalances, disconnectWallet } from "../util/wallet";
import type { MappedBalances } from "../util/wallet";

const signTransaction = wallet.signTransaction.bind(wallet);

/**
 * A good-enough implementation of deepEqual.
 *
 * Used in this file to compare MappedBalances.
 *
 * Should maybe add & use a new dependency instead, if needed elsewhere.
 */
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }

  const bothAreObjects =
    a && b && typeof a === "object" && typeof b === "object";

  return Boolean(
    bothAreObjects &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([k, v]) => deepEqual(v, b[k as keyof T])),
  );
}

export interface WalletContextType {
  address?: string;
  balances: MappedBalances;
  isPending: boolean;
  network?: string;
  networkPassphrase?: string;
  signTransaction: typeof wallet.signTransaction;
  updateBalances: () => Promise<void>;
  connectionError?: string;
  clearError: () => void;
  disconnect: () => Promise<void>;
  accounts: string[];
  switchAccount: (address: string) => void;
}

const POLL_INTERVAL = 1000;

export const WalletContext = // eslint-disable-line react-refresh/only-export-components
  createContext<WalletContextType>({
    isPending: true,
    balances: {},
    updateBalances: async () => {},
    signTransaction,
    clearError: () => {},
    disconnect: async () => {},
    accounts: [],
    switchAccount: () => {},
  });

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [balances, setBalances] = useState<MappedBalances>({});
  // const [address, setAddress] = useState<string>();
  // const [network, setNetwork] = useState<string>();
  // const [networkPassphrase, setNetworkPassphrase] = useState<string>();

  const [address, setAddress] = useState<string | undefined>(() => {
    const stored = storage.getItem("walletAddress");
    return stored || undefined;
  });
  const [network, setNetwork] = useState<string | undefined>(() => {
    const stored = storage.getItem("walletNetwork");
    return stored || undefined;
  });
  const [networkPassphrase, setNetworkPassphrase] = useState<
    string | undefined
  >(() => {
    const stored = storage.getItem("networkPassphrase");
    return stored || undefined;
  });
  const [accounts, setAccounts] = useState<string[]>(() => {
    const stored = storage.getItem("walletAccounts");
    if (stored && Array.isArray(stored)) return stored;
    return address ? [address] : [];
  });

  const [isPending, startTransition] = useTransition();

  const switchAccount = useCallback(
    (newAddress: string) => {
      if (accounts.includes(newAddress)) {
        setAddress(newAddress);
        storage.setItem("walletAddress", newAddress);
      }
    },
    [accounts],
  );

  const handleSetAddress = (newAddr: string | undefined) => {
    setAddress(newAddr);
    if (newAddr) {
      setAccounts((prev) => {
        if (prev.includes(newAddr)) return prev;
        const next = [...prev, newAddr];
        storage.setItem("walletAccounts", next);
        return next;
      });
    }
  };
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const popupLock = useRef(false);

  const clearError = useCallback(() => setConnectionError(undefined), []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    // Clear all cached queries to remove any contract client data
    queryClient.clear();
    nullify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const nullify = () => {
    handleSetAddress(undefined);
    setAccounts([]);
    storage.removeItem("walletAccounts");
    setNetwork(undefined);
    setNetworkPassphrase(undefined);
    setBalances({});
    storage.setItem("walletId", "");
    storage.setItem("walletAddress", "");
    storage.setItem("walletNetwork", "");
    storage.setItem("networkPassphrase", "");
  };

  const updateBalances = useCallback(async () => {
    if (!address) {
      setBalances({});
      return;
    }

    const newBalances = await fetchBalances(address);
    setBalances((prev) => {
      if (deepEqual(newBalances, prev)) return prev;
      return newBalances;
    });
  }, [address]);

  useEffect(() => {
    void updateBalances();
  }, [updateBalances]);

  const updateCurrentWalletState = async () => {
    // There is no way, with StellarWalletsKit, to check if the wallet is
    // installed/connected/authorized. We need to manage that on our side by
    // checking our storage item.
    const walletId = storage.getItem("walletId");
    const walletNetwork = storage.getItem("walletNetwork");
    const walletAddr = storage.getItem("walletAddress");
    const passphrase = storage.getItem("networkPassphrase");

    if (
      !address &&
      walletAddr !== null &&
      walletNetwork !== null &&
      passphrase !== null
    ) {
      handleSetAddress(walletAddr);
      setNetwork(walletNetwork);
      setNetworkPassphrase(passphrase);
    }

    if (!walletId) {
      nullify();
    } else {
      if (popupLock.current) return;
      // If our storage item is there, then we try to get the user's address &
      // network from their wallet. Note: `getAddress` MAY open their wallet
      // extension, depending on which wallet they select!
      try {
        popupLock.current = true;
        wallet.setWallet(walletId);
        if (walletId !== "freighter" && walletAddr !== null) return;
        const [a, n] = await Promise.all([
          wallet.getAddress(),
          wallet.getNetwork(),
        ]);

        if (!a.address) storage.setItem("walletId", "");
        if (
          a.address !== address ||
          n.network !== network ||
          n.networkPassphrase !== networkPassphrase
        ) {
          storage.setItem("walletAddress", a.address);
          handleSetAddress(a.address);
          setNetwork(n.network);
          setNetworkPassphrase(n.networkPassphrase);
        }
      } catch (e) {
        // If `getNetwork` or `getAddress` throw errors... sign the user out???
        nullify();
        const msg = e instanceof Error ? e.message : "Failed to connect wallet";
        setConnectionError(msg);
        // then log the error (instead of throwing) so we have visibility
        // into the error while working on Scaffold Stellar but we do not
        // crash the app process
        console.error(e);
      } finally {
        popupLock.current = false;
      }
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    // Create recursive polling function to check wallet state continuously
    const pollWalletState = async () => {
      if (!isMounted) return;

      await updateCurrentWalletState();

      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    };

    // Get the wallet address when the component is mounted for the first time
    // Get the wallet address when the component is mounted for the first time
    const init = async () => {
      await updateCurrentWalletState();
      // Start polling after initial state is loaded
      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    };

    startTransition(() => {
      void init();
    });

    // Clear the timeout and stop polling when the component unmounts
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- it SHOULD only run once per component mount

  const contextValue = useMemo(
    () => ({
      address,
      network,
      networkPassphrase,
      balances,
      updateBalances,
      isPending,
      signTransaction,
      connectionError,
      clearError,
      disconnect,
      accounts,
      switchAccount,
    }),
    [
      address,
      network,
      networkPassphrase,
      balances,
      updateBalances,
      isPending,
      connectionError,
      clearError,
      disconnect,
      accounts,
      switchAccount,
    ],
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
