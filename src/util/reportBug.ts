export function buildBugContext(error?: Error): string {
  const context = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    localStorageLocale: localStorage.getItem("quipay_locale"),
    errorName: error?.name,
    errorMessage: error?.message,
    stack: error?.stack,
  };
  return JSON.stringify(context, null, 2);
}

export async function copyBugContext(error?: Error): Promise<void> {
  const text = buildBugContext(error);
  await navigator.clipboard.writeText(text);
}

export function getBugReportUrl(error?: Error): string {
  const title = encodeURIComponent(
    `[Bug] ${error?.name ?? "Unhandled error"} in Quipay frontend`,
  );
  const body = encodeURIComponent(
    `Please describe what happened.\n\n### Captured Context\n\`\`\`json\n${buildBugContext(error)}\n\`\`\``,
  );
  return `https://github.com/LFGBanditLabs/Quipay/issues/new?title=${title}&body=${body}`;
}
