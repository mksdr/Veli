import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import locales, { type LocaleCode } from "./locales";
import en_US, { type TranslationKey } from "./en_US";
import { getStoredValue, setStoredValue } from "../src/utils/storage";

export interface LocaleContextValue {
  locale: LocaleCode;
  changeLocale: (next: string) => void;
}

const isLocaleCode = (value: string | null | undefined): value is LocaleCode =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(locales, value);

let activeLocale: LocaleCode = "en_US";
const LocaleContext = createContext<LocaleContextValue>({ locale: "en_US", changeLocale: () => {} });

export const checkLocale = (): LocaleCode => {
  if (typeof window === "undefined") return "en_US";
  const stored = getStoredValue("language");
  if (isLocaleCode(stored)) return stored;
  return /^ko(?:-|$)/i.test(navigator.language) ? "ko_KR" : "en_US";
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<LocaleCode>("en_US");
  const changeLocale = (next: string) => {
    if (!isLocaleCode(next)) return;
    activeLocale = next;
    document.documentElement.lang = next === "ko_KR" ? "ko" : "en";
    setStoredValue("language", next);
    setLocale(next);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the browser locale after hydration so the static HTML and first client render agree.
  useEffect(() => { changeLocale(checkLocale()); }, []);
  return <LocaleContext.Provider value={{ locale, changeLocale }}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): LocaleContextValue => useContext(LocaleContext);

export const getTranslations = (
  key: TranslationKey | (string & {}),
  locale: string = activeLocale,
): string => {
  const dictionary = isLocaleCode(locale) ? locales[locale] : undefined;
  return (dictionary as Record<string, string> | undefined)?.[key] ??
    (en_US as Record<string, string>)[key] ??
    key;
};
