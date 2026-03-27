/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { getNetworkStatus, NetworkStatus } from "../util/networkStatus";

interface NetworkStatusContextType extends NetworkStatus {
  refresh: () => Promise<void>;
}

const NetworkStatusContext = createContext<
  NetworkStatusContextType | undefined
>(undefined);

const REFRESH_INTERVAL = 30000; // 30 seconds

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
  });

  const refresh = async () => {
    const newStatus = await getNetworkStatus();
    setStatus(newStatus);
  };

  useEffect(() => {
    let active = true;

    async function updateStatus() {
      const newStatus = await getNetworkStatus();
      if (active) {
        setStatus(newStatus);
      }
    }

    void updateStatus();

    const interval = setInterval(() => {
      void updateStatus();
    }, REFRESH_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
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
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider",
    );
  }
  return context;
};
