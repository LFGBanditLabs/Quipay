import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import translationEN from "./locales/en/translation.json";
import translationES from "./locales/es/translation.json";
import translationFR from "./locales/fr/translation.json";
import translationAR from "./locales/ar/translation.json";
import translationHE from "./locales/he/translation.json";

const resources = {
  en: { translation: translationEN },
  es: { translation: translationES },
  fr: { translation: translationFR },
  ar: { translation: translationAR },
  he: { translation: translationHE },
};

/** Languages that use right-to-left script direction. */
export const RTL_LANGUAGES = new Set(["ar", "he"]);

/** Returns `true` when the given language code is RTL. */
export function isRtlLanguage(lng: string): boolean {
  const base = lng.split("-")[0].toLowerCase();
  return RTL_LANGUAGES.has(base);
}

/** Returns `"rtl"` or `"ltr"` for a given language code. */
export function getDirection(lng: string): "rtl" | "ltr" {
  return isRtlLanguage(lng) ? "rtl" : "ltr";
}

/**
 * Apply the document-level `dir` and `lang` attributes for the current
 * language.  Called once on boot and again every time the language changes.
 */
function applyDirection(lng: string): void {
  const dir = getDirection(lng);
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

// Apply direction every time the language changes — no page reload needed.
i18n.on("languageChanged", applyDirection);

// Set direction on initial load.
applyDirection(i18n.language);

export default i18n;
