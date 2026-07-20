import { usePrivy } from "@privy-io/react-auth";

/**
 * Thin wrapper around Privy so the rest of the app doesn't reach into
 * @privy-io/react-auth directly — keeps the identity provider swappable.
 */
export function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();

  return {
    ready,
    authenticated,
    email: user?.email?.address,
    privyId: user?.id,
    login,
    logout,
    getAccessToken,
  };
}
