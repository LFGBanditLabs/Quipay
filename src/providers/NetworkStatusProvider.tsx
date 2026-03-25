import React, { createContext, useContext, useEffect, useState } from "react";
import { getNetworkStatus, NetworkStatus } from "../util/networkStatus";

interface NetworkStatusContextType extends NetworkStatus {
  refresh: () => Promise<void>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined);

const REFRESH_INTERVAL = 30000; // 30 seconds

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<NetworkStatus>({
    status: "online",
    latency: 0,
    congestion: "low",
    minFee: 100
  });

  const refresh = async () => {
    const newStatus = await getNetworkStatus();
    setStatus(newStatus);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ ...status, refresh }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error("useNetworkStatus must be used within a NetworkStatusProvider");
  }
  return context;
};
