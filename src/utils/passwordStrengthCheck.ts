import { getTranslations as t } from "../../locales";
import type { TranslationKey } from "../../locales/en_US";

import { ZxcvbnFactory, type Score } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

const minute = 60,
  hour = minute * 60,
  day = hour * 24,
  month = day * 31,
  year = month * 12,
  century = year * 100;

const strength: Record<Score, TranslationKey> = {
  // Keep the estimator's scores, but group both guessable bands in the UI.
  0: "weak",
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
  // The password field is uncapped; preserve v3's full-input synchronous scoring.
  maxLength: Infinity,
  translations: zxcvbnEnPackage.translations,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
};
const zxcvbn = new ZxcvbnFactory(options);

const passwordStrengthCheck = (password: string): [string, string] => {
  const strengthResult = zxcvbn.check(password);
  const score = strengthResult.score;
  const crackTimeInSeconds = strengthResult.crackTimes.offlineSlowHashingXPerSecond.seconds;
  const crackTime = display_time(crackTimeInSeconds);

  return [t(strength[score]), crackTime];
};

export default passwordStrengthCheck;
