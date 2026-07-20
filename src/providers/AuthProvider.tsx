import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WalletProvisioner } from "./WalletProvisioner";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

/**
 * Real login (email OTP / Google / Apple) as the identity check. On login,
 * Privy auto-provisions an embedded EVM (Arc) wallet; the Stellar wallet is
 * created imperatively by WalletProvisioner (extended chains have no
 * createOnLogin). Both addresses are then saved to the account so the user
 * never pastes or separately authorizes an address — Privy holds the keys.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!PRIVY_APP_ID) {
    console.warn(
      "[AuthProvider] VITE_PRIVY_APP_ID is not set — login will not work.",
    );
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // email = passwordless OTP fallback; google/apple = one-tap, no code.
        // The google/apple providers must also be enabled in the Privy
        // dashboard (App settings → Authentication) or their buttons error.
        loginMethods: ["email", "google", "apple"],
        // Auto-create the EVM (Arc/Base) embedded wallet on login for any user
        // who doesn't already have one. Stellar is handled imperatively.
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#facc15",
        },
      }}
    >
      <WalletProvisioner />
      {children}
    </PrivyProvider>
  );
};
