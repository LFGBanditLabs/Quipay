/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  getNetworkStatus,
  NetworkStatus,
  RpcNodeHealth,
} from "../util/networkStatus";

export interface NetworkStatusContextType extends NetworkStatus {
  refresh: () => Promise<void>;
  /** Rolling history of status snapshots for the health monitor chart */
  history: NetworkStatus[];
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
}

const NetworkStatusContext = createContext<
  NetworkStatusContextType | undefined
>(undefined);

const REFRESH_INTERVAL = 30_000; // 30 seconds
const MAX_HISTORY = 20;

const defaultNodeHealth: RpcNodeHealth = {
  name: "",
  url: "",
  status: "online",
  latency: 0,
  lastChecked: Date.now(),
};

export const NetworkStatusProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [status, setStatus] = useState<NetworkStatus>({
    status: "online",
    latency: 0,
    congestion: "low",
    minFee: 100,
    horizonHealth: defaultNodeHealth,
    sorobanHealth: defaultNodeHealth,
  });
  const [history, setHistory] = useState<NetworkStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const newStatus = await getNetworkStatus();
      if (mountedRef.current) {
        setStatus(newStatus);
        setHistory((prev) => [...prev, newStatus].slice(-MAX_HISTORY));
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <NetworkStatusContext.Provider
      value={{ ...status, refresh, history, isRefreshing }}
    >
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider",
    );
  }
  return context;
};
