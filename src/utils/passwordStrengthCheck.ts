import { getTranslations as t } from "../../locales";
import type { TranslationKey } from "../../locales/en_US";

import { zxcvbn, zxcvbnOptions, type Score } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

const minute = 60,
  hour = minute * 60,
  day = hour * 24,
  month = day * 31,
  year = month * 12,
  century = year * 100;

const strength: Record<Score, TranslationKey> = {
  0: "very_weak",
  1: "weak",
  2: "moderate",
  3: "good",
  4: "strong",
};

const display_time = (seconds: number): string => {
  let base: number;

  const ref: [number | null, string] =
    seconds < 1
      ? [null, `${t("less_second")}`]
      : seconds < minute
      ? ((base = Math.round(seconds)), [base, base + ` ${t("seconds")}`])
      : seconds < hour
      ? ((base = Math.round(seconds / minute)), [base, base + ` ${t("minutes")}`])
      : seconds < day
      ? ((base = Math.round(seconds / hour)), [base, base + ` ${t("hours")}`])
      : seconds < month
      ? ((base = Math.round(seconds / day)), [base, base + ` ${t("days")}`])
      : seconds < year
      ? ((base = Math.round(seconds / month)), [base, base + ` ${t("months")}`])
      : seconds < century
      ? ((base = Math.round(seconds / year)), [base, base + ` ${t("years")}`])
      : [null, t("centuries")];
  const display_str = ref[1];
  return display_str;
};

const options = {
  translations: zxcvbnEnPackage.translations,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
};
zxcvbnOptions.setOptions(options);

const passwordStrengthCheck = (password: string): [string, string] => {
  const strengthResult = zxcvbn(password);
  const score = strengthResult.score;
  const crackTimeInSeconds = strengthResult.crackTimesSeconds.offlineSlowHashing1e4PerSecond;
  const crackTime = display_time(crackTimeInSeconds);

  return [t(strength[score]), crackTime];
};

export default passwordStrengthCheck;
