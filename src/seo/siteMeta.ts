export const SITE_NAME = "Quipay";
export const DEFAULT_SITE_URL = "https://quipay.app";

function normalizeCandidate(candidate: string | undefined): string | null {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  const envUrl = normalizeCandidate(
    import.meta.env.VITE_SITE_URL as string | undefined,
  );
  if (envUrl) {
    return envUrl;
  }

  const publicEnvUrl = normalizeCandidate(
    import.meta.env.PUBLIC_SITE_URL as string | undefined,
  );
  if (publicEnvUrl) {
    return publicEnvUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return DEFAULT_SITE_URL;
}

export function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}
