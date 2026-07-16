export const buildPayrollSocketQuery = (
  token: string | null | undefined,
): { token: string } | null => {
  const normalizedToken = token?.trim();
  return normalizedToken ? { token: normalizedToken } : null;
};
