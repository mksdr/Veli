import { createContext, useContext, useEffect, useState } from "react";
import locales from "./locales";
import en_US from "./en_US";
import { getStoredValue, setStoredValue } from "../src/utils/storage";
let activeLocale = "en_US";
const LocaleContext = createContext({ locale: "en_US", changeLocale: () => {} });
export const checkLocale = () => {
  if (typeof window === "undefined") return "en_US";
  const stored = getStoredValue("language");
  if (locales[stored]) return stored;
  return /^ko(?:-|$)/i.test(navigator.language) ? "ko_KR" : "en_US";
};
export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState("en_US");
  const changeLocale = next => {
    if (!locales[next]) return;
    activeLocale = next;
    document.documentElement.lang = next === "ko_KR" ? "ko" : "en";
    setStoredValue("language", next);
    setLocale(next);
  };
  useEffect(() => { changeLocale(checkLocale()); }, []);
  return <LocaleContext.Provider value={{ locale, changeLocale }}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
export const getTranslations = (key, locale = activeLocale) => locales[locale]?.[key] ?? en_US[key] ?? key;
