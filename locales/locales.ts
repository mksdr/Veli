import en_US, { type Translations } from "./en_US";
import ko_KR from "./ko_KR";

const locales = { en_US, ko_KR } satisfies Record<string, Translations>;
export type LocaleCode = keyof typeof locales;
export default locales;
