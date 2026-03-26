import React from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "../i18n/config";

const languages = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: code === "es" ? "Español" : "English",
}));

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-(--surface-subtle) border border-border text-(--text) text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-all duration-200 hover:bg-(--surface)"
        aria-label={t("nav.select_language")}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
