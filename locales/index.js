import locales from "./locales";
import en_US from "./en_US"; // default locale
import { getStoredValue } from "../src/utils/storage";

const checkLocale = () => {
  if (typeof window !== "undefined") {
    let language = getStoredValue("language");
    let userLanguage = navigator.language.replace("-", "_");
    return language ? language : locales[userLanguage] ? userLanguage : "en_US";
  }
  return "en_US";
};

const getTranslations = (key, locale = checkLocale()) => {
  const currLocale = locales[locale] ? locales[locale] : en_US;
  let translated = currLocale[key] ? currLocale[key] : en_US[key];
  return translated;
};

export { getTranslations, checkLocale };
