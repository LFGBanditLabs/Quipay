import React from "react";
import { useTranslation } from "react-i18next";
import { isRtlLanguage } from "../i18n/config";

const languages = [
  { code: "en", label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "es", label: "Espa\u00F1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "fr", label: "Fran\u00E7ais", flag: "\u{1F1EB}\u{1F1F7}" },
  {
    code: "ar",
    label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    flag: "\u{1F1F8}\u{1F1E6}",
  },
  {
    code: "he",
    label: "\u05E2\u05D1\u05E8\u05D9\u05EA",
    flag: "\u{1F1EE}\u{1F1F1}",
  },
];

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  const currentIsRtl = isRtlLanguage(i18n.language);

  return (
    <div className="flex items-center gap-2">
      {currentIsRtl && (
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 opacity-70"
          aria-hidden="true"
        >
          RTL
        </span>
      )}
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text)] text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-all duration-200 hover:bg-[var(--surface)]"
        aria-label={t("nav.select_language")}
        dir="ltr"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
