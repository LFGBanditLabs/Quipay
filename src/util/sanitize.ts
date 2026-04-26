import DOMPurify from "isomorphic-dompurify";

export const sanitizeText = (input: string): string => {
  if (!input) return "";
  const cleaned = DOMPurify.sanitize(input, { RETURN_TRUSTED_TYPE: false });
  return cleaned.trim();
};
