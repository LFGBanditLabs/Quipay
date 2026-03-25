import { useContext } from "react";
import { NetworkStatusContext } from "../providers/NetworkStatusProvider";

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    throw new Error("useNetworkStatus must be used within a NetworkStatusProvider");
  }
  return context;
};
