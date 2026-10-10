const { test, expect } = require("@playwright/test");
const sample = { name: "계약서-한글-and-a-very-long-filename-for-mobile-layout.txt", mimeType: "text/plain", buffer: Buffer.from("UX file fixture") };

async function choose(page) {
  await page.goto("/");
  await page.locator("#enc-file").setInputFiles(sample);
  await page.getByRole("button", { name: "Set a password", exact: true }).click();
}

// These checks cover state/data loss and real recovery actions, beyond appearance.
test("Korean browser language and removed locale preference resolve to Korean", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("language", "fr_FR"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { name: "파일을 안전하게 보호하세요" })).toBeVisible();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("combobox", { name: "언어", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("option", { name: "English", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "한국어", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test("language change requires acknowledgment before clearing selected files and secrets", async ({ page }) => {
  await choose(page);
  await page.getByLabel(/^Password\s*\*?$/).fill("Sample-password-123!");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel(/^Password\s*\*?$/)).toHaveValue("Sample-password-123!");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await page.getByRole("button", { name: "Change language", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByText(sample.name)).toBeHidden();
  await expect(page.locator("#encrypt-password")).toBeHidden();
  await expect(page.getByRole("heading", { name: "어떤 파일을 보호할까요?" })).toBeVisible();
});

test("generated word password and clipboard denial offer a usable manual fallback", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
  }));
  await choose(page);
  const generator = page.getByRole("combobox", { name: "Generate Password", exact: true });
  await generator.click();
  await page.getByRole("option", { name: "Memorable words", exact: true }).click();
  // MUI sets aria-hidden before its exit transition finishes. Wait for the
  // menu to unmount so its fading overlay cannot intercept the next click.
  await expect(page.getByRole("listbox", { includeHidden: true })).toHaveCount(0);
  await expect(generator).toHaveText("Memorable words");
  await page.getByRole("button", { name: "Create a password", exact: true }).click();
  const input = page.getByLabel(/^Password\s*\*?$/);
  await expect(input).not.toHaveValue("");
  const password = await input.inputValue();
  expect(password.split("-")).toHaveLength(5);
  await page.getByRole("button", { name: "Copy Password", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Copy Password", { exact: true })).toHaveValue(password);
  await expect(dialog.getByRole("alert")).toContainText("Could not copy");
  await expect(page.getByText("Password copied!", { exact: true })).toBeHidden();
});

test("going back keeps input, validates short passwords, and exposes one keyboard accessible key flow", async ({ page }) => {
  await choose(page);
  await page.getByLabel(/^Password\s*\*?$/).fill("short");
  await page.getByRole("button", { name: "Review encryption", exact: true }).click();
  await expect(page.getByLabel(/^Password\s*\*?$/)).toBeFocused();
  await expect(page.getByText("Use at least 12 characters for your password.")).toBeVisible();
  await page.getByLabel(/^Password\s*\*?$/).fill("Long-enough-password-123!");
  await page.getByRole("button", { name: "Review encryption", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel(/^Password\s*\*?$/)).toHaveValue("Long-enough-password-123!");
  await page.getByRole("button", { name: "Use public keys · Advanced", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/^Recipient's Public Key\s*\*?$/)).toBeVisible();
  await expect(page.getByLabel(/^Private key\s*\*?$/)).toBeVisible();
});

test("public-key invitation preserves base64 symbols", async ({ page }) => {
  const publicKey = "+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/s=";
  await page.goto("/?tab=encryption&publicKey=" + encodeURIComponent(publicKey));
  await page.locator("#enc-file").setInputFiles(sample);
  await page.getByRole("button", { name: "Set a password", exact: true }).click();
  await expect(page.getByLabel(/^Recipient's Public Key\s*\*?$/)).toHaveValue(publicKey);
  await expect(page.getByRole("button", { name: "Use a password instead", exact: true })).toBeVisible();
});

test("key backup, public-only sharing, and replacement confirmation preserve the current key pair", async ({ page }) => {
  const fs = require("node:fs/promises");
  await page.goto("/generate-keys/");
  await page.getByRole("button", { name: "Generate Key Pair", exact: true }).click();
  const publicInput = page.locator("#generatedPublicKey");
  const privateInput = page.locator("#generatedPrivateKey");
  await expect(publicInput).not.toHaveValue("");
  await expect(privateInput).toHaveAttribute("type", "password");
  const publicKey = await publicInput.inputValue();
  const privateKey = await privateInput.inputValue();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Private Key", exact: true }).click();
  const download = await backup;
  expect(await download.failure()).toBeNull();
  expect(await fs.readFile(await download.path(), "utf8")).toBe(privateKey);
  await page.getByRole("button", { name: "Generate QR code", exact: true }).click();
  const link = await page.getByRole("dialog").getByLabel("Public key link", { exact: true }).inputValue();
  expect(new URL(link).searchParams.get("publicKey")).toBe(publicKey);
  expect(link).not.toContain(privateKey);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Generate Another Pair", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(privateInput).toHaveValue(privateKey);
  await page.getByRole("button", { name: "Generate Another Pair", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create new keys", exact: true }).click();
  await expect(privateInput).not.toHaveValue(privateKey);
  await expect(privateInput).toHaveAttribute("type", "password");
});

test("narrow layouts and dark mode keep the workflow usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await choose(page);
  await page.getByLabel(/^Password\s*\*?$/).fill("Sample-password-123!");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const switchControl = page.getByRole("checkbox", { name: "Dark Mode", exact: true });
  await switchControl.check();
  await expect(switchControl).toBeChecked();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel(/^Password\s*\*?$/)).toHaveValue("Sample-password-123!");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(18, 24, 32)");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe("none");
});

test("stalled streaming can be cancelled without allowing tab or language changes", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Controlled service-worker streaming check");
  await page.addInitScript(() => {
    const post = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function (data, ...args) {
      // Hold encryption at the worker boundary so the processing state stays
      // active regardless of how the download is opened (currently an iframe).
      if (data.cmd === "requestEncryption") {
        window.encryptionStalled = true;
        return;
      }
      return post.call(this, data, ...args);
    };
  });
  await choose(page);
  if (await page.getByText("This browser processes one file at a time, up to 1 GiB. Available memory may require a smaller file.", { exact: true }).isVisible()) {
    test.skip(true, "Streaming is unavailable in this context");
  }
  await page.getByLabel(/^Password\s*\*?$/).fill("Sample-password-123!");
  await page.getByRole("button", { name: "Review encryption", exact: true }).click();
  await page.getByRole("button", { name: "Encrypt & download", exact: true }).click();
  await page.waitForFunction(() => window.encryptionStalled === true);
  await expect(page.getByRole("tab", { name: "Decrypt files", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Language", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Stop processing", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop processing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Which files would you like to protect?", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Decrypt files", exact: true })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Your files are encrypted", exact: true })).toBeHidden();
});

test("Korean password flow downloads the original plaintext after decryption", async ({ page }) => {
  const fs = require("node:fs/promises");
  await page.addInitScript(() => localStorage.setItem("language", "ko_KR"));
  await page.goto("/");
  const encryptPanel = page.locator("#simple-tabpanel-0");
  await page.locator("#enc-file").setInputFiles(sample);
  await encryptPanel.getByRole("button", { name: "비밀번호 설정하기", exact: true }).click();
  await encryptPanel.locator("#encrypt-password").fill("Korean-flow-password-123!");
  await encryptPanel.getByRole("button", { name: "암호화 준비하기", exact: true }).click();
  const encryptedDownload = page.waitForEvent("download");
  await encryptPanel.getByRole("button", { name: /^(암호화하고 다운로드|파일 암호화하기)$/ }).click();
  const saveEncrypted = encryptPanel.getByRole("button", { name: "암호화 파일 다운로드", exact: true });
  await Promise.race([encryptedDownload, saveEncrypted.waitFor({ state: "visible" }).then(() => saveEncrypted.click())]);
  const encryptedFile = await encryptedDownload;
  expect(await encryptedFile.failure()).toBeNull();
  const encrypted = await fs.readFile(await encryptedFile.path());
  await expect(encryptPanel.getByRole("heading", { name: "파일을 암호화했어요", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "파일 복호화", exact: true }).click();
  const decryptPanel = page.locator("#simple-tabpanel-1");
  await page.locator("#dec-file").setInputFiles({ ...sample, name: sample.name + ".enc", buffer: encrypted });
  await decryptPanel.getByRole("button", { name: "파일 확인하기", exact: true }).click();
  await decryptPanel.locator("#decrypt-password").fill("Korean-flow-password-123!");
  await decryptPanel.getByRole("button", { name: /^(비밀번호 확인하기|파일 복호화하기)$/ }).click();
  const streamAction = decryptPanel.getByRole("button", { name: "복호화하고 다운로드", exact: true });
  const saveDecrypted = decryptPanel.getByRole("button", { name: "복호화 파일 다운로드", exact: true });
  await Promise.race([streamAction.waitFor({ state: "visible" }), saveDecrypted.waitFor({ state: "visible" })]);
  const plaintextDownload = page.waitForEvent("download");
  if (await streamAction.isVisible()) await streamAction.click();
  else await saveDecrypted.click();
  const decryptedFile = await plaintextDownload;
  expect(await decryptedFile.failure()).toBeNull();
  expect(await fs.readFile(await decryptedFile.path())).toEqual(sample.buffer);
  await expect(decryptPanel.getByRole("heading", { name: "파일을 복호화하고 검증했어요", exact: true })).toBeVisible();
});

for (const locale of [
  { code: "en_US", weak: "Password strength: Very Weak (guessable)", strong: "Password strength: Strong" },
  { code: "ko_KR", weak: "비밀번호 강도: 매우 약해요", strong: "비밀번호 강도: 강해요" },
]) {
  test("password strength recognizes weak patterns and strong passwords in " + locale.code, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(code => localStorage.setItem("language", code), locale.code);
    await page.goto("/");
    await page.locator("#enc-file").setInputFiles(sample);
    await page.getByRole("button", { name: locale.code === "ko_KR" ? "비밀번호 설정하기" : "Set a password", exact: true }).click();
    const input = page.locator("#encrypt-password");
    for (const password of ["password", "qwertyuiop"]) {
      await input.fill(password);
      await expect(page.getByText(locale.weak, { exact: true })).toBeVisible();
    }
    await input.fill("j7!Qm2@Vp9#Lx4$Rt8");
    await expect(page.getByText(locale.strong, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("about page blockquotes are readable and styled for dark mode", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("language", "en_US");
    localStorage.setItem("darkTheme", "1");
  });
  await page.goto("/about/");
  const blockquote = page.locator("blockquote").first();
  await expect(blockquote).toBeVisible();
  const darkBg = await blockquote.evaluate(el => getComputedStyle(el).backgroundColor);
  const darkColor = await blockquote.evaluate(el => getComputedStyle(el).color);
  const paragraph = blockquote.locator("p").first();
  const darkPColor = await paragraph.evaluate(el => getComputedStyle(el).color);
  const darkBorderLeft = await blockquote.evaluate(el => getComputedStyle(el).borderLeftColor);
  expect(darkBg).toBe("rgb(40, 52, 67)");
  expect(darkColor).toBe("rgb(174, 187, 201)");
  expect(darkPColor).toBe("rgb(174, 187, 201)");
  expect(darkBorderLeft).toBe("rgb(88, 103, 122)");
});

test("about page blockquotes are styled for light mode", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("language", "en_US");
    localStorage.setItem("darkTheme", "0");
  });
  await page.goto("/about/");
  const blockquote = page.locator("blockquote").first();
  await expect(blockquote).toBeVisible();
  const lightBg = await blockquote.evaluate(el => getComputedStyle(el).backgroundColor);
  const lightColor = await blockquote.evaluate(el => getComputedStyle(el).color);
  const paragraph = blockquote.locator("p").first();
  const lightPColor = await paragraph.evaluate(el => getComputedStyle(el).color);
  const lightBorderLeft = await blockquote.evaluate(el => getComputedStyle(el).borderLeftColor);
  expect(lightBg).toBe("rgb(237, 241, 246)");
  expect(lightColor).toBe("rgb(88, 103, 122)");
  expect(lightPColor).toBe("rgb(88, 103, 122)");
  expect(lightBorderLeft).toBe("rgb(200, 204, 208)");
});

