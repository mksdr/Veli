const { test, expect } = require("@playwright/test");

const copy = {
  en_US: {
    continue: "Set a password",
    strength: "Password strength",
    weak: "Weak",
    moderate: "Moderate",
    good: "Good",
    strong: "Strong",
    removedHint: "Strength depends on common passwords and patterns",
    review: "Review encryption",
    short: "Use at least 12 characters for your password.",
    back: "Back",
  },
  ko_KR: {
    continue: "비밀번호 설정하기",
    strength: "비밀번호 강도",
    weak: "약해요",
    moderate: "적절해요",
    good: "좋아요",
    strong: "강해요",
    removedHint: "길이뿐 아니라 흔한 비밀번호와 패턴도 평가해요.",
    review: "암호화 준비하기",
    short: "비밀번호를 12자 이상 입력해주세요.",
    back: "이전",
  },
};

for (const path of ["/", "/headless/"]) {
  for (const [language, text] of Object.entries(copy)) {
    test(`password strength groups guessable scores at ${path} in ${language}`, async ({ page }) => {
      await page.addInitScript(language => localStorage.setItem("language", language), language);
      await page.goto(path);
      await page.locator("#enc-file").setInputFiles({ name: "strength.txt", mimeType: "text/plain", buffer: Buffer.from("Password strength fixture") });
      const panel = page.locator("#simple-tabpanel-0");
      await panel.getByRole("button", { name: text.continue, exact: true }).click();
      const input = panel.locator("#encrypt-password");
      const strength = panel.getByText(new RegExp(`^${text.strength}:`));
      await expect(strength).toHaveCount(0);

      await input.focus();
      for (const character of "password123") {
        await input.pressSequentially(character);
        await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
      }
      await expect(panel.getByText(text.removedHint)).toHaveCount(0);
      // Strength is advice; the existing minimum length still controls review.
      await panel.getByRole("button", { name: text.review, exact: true }).click();
      await expect(panel.getByText(text.short, { exact: true })).toBeVisible();
      await input.fill("password1234");
      await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
      await panel.getByRole("button", { name: text.review, exact: true }).click();
      await expect(input).toBeHidden();
      await panel.getByRole("button", { name: text.back, exact: true }).click();
      await expect(input).toHaveValue("password1234");

      for (const [password, label] of [["mN7!qT9", text.moderate], ["mN7!qT9@v", text.good], ["mN7!qT9@vL2#", text.strong]]) {
        await input.fill(password);
        await expect(strength).toHaveText(`${text.strength}: ${label}`);
      }

      // Score the suffix too: the password field accepts more than 256 UTF-16 code units.
      await input.fill("a".repeat(256));
      await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
      for (const password of ["a".repeat(256) + "mN7!qT9@vL2#", "a".repeat(255) + "🔐mN7!qT9@vL2#"]) {
        await input.fill(password);
        await expect(input).toHaveValue(password);
        await expect(strength).toHaveText(`${text.strength}: ${text.strong}`);
      }
      await input.fill("");
      await expect(strength).toHaveCount(0);
      // Bulk insertion (as with paste) must agree with incremental typing.
      await input.focus();
      await page.keyboard.insertText("password123");
      await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
      await input.press("Backspace");
      await expect(input).toHaveValue("password12");
      await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
      await input.pressSequentially("3");
      await expect(strength).toHaveText(`${text.strength}: ${text.weak}`);
    });
  }
}
