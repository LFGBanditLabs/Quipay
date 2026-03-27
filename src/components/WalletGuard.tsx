import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

interface WalletGuardProps {
  children: ReactNode;
}

/**
 * A higher-order component that protects routes by checking for a connected wallet.
 * If no wallet is connected, it redirects to the home page.
 */
const WalletGuard: React.FC<WalletGuardProps> = ({ children }) => {
  const { address } = useWallet();
  const location = useLocation();

  if (!address) {
    // If the wallet is not connected, redirect to the home page.
    // We could also show a "Connect your wallet" modal here instead.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default WalletGuard;
