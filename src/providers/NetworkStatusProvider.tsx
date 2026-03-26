import React, { createContext, useContext, useEffect, useState } from "react";
import { getNetworkStatus, NetworkStatus } from "../util/networkStatus";
import { useNotification } from "../hooks/useNotification";

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
  const { addNotification } = useNotification();
  const [status, setStatus] = useState<NetworkStatus>({
    status: "online",
    latency: 0,
    congestion: "low",
    minFee: 100,
    horizon: { status: "online", latency: 0 },
    sorobanRpc: { status: "online", latency: 0 },
    issues: [],
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
        if (
          status.status !== "offline" &&
          newStatus.status === "offline" &&
          newStatus.issues.length > 0
        ) {
          addNotification(
            `Network degraded: ${newStatus.issues[0]}. Retry once endpoints recover.`,
            "error",
          );
        }
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
  }, [addNotification, status.status]);

  return (
    <NetworkStatusContext.Provider value={{ ...status, refresh }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider",
    );
  }
  return context;
};
