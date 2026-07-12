import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface WalletGuardProps {
  children: ReactNode;
}

/**
 * Protects dashboard routes by checking for a logged-in Quipay account
 * (real Privy login), not a connected wallet — wallet-connect is no longer
 * the identity check.
 */
const WalletGuard: React.FC<WalletGuardProps> = ({ children }) => {
  const { ready, authenticated } = useAuth();
  const location = useLocation();

  if (!ready) return null;

  if (!authenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default WalletGuard;
