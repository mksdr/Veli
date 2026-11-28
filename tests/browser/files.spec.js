const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const sodium = require("libsodium-wrappers-sumo");
const { encryptLegacy, decryptLegacy } = require("../helpers/legacyCrypto");
const plaintext = Buffer.from("Veli browser round trip: 한글 🔐\n");

const { selectFile, contents, encrypt, decrypt, password } = require("../helpers/browserFiles");

for (const path of ["/", "/headless/"]) {
  test("password file round trip at " + path, async ({ page }) => {
    const errors = [];
    const dialogs = [];
    // Reproduce a user cancelling any unexpected leave-site prompt. Downloads
    // must complete without prompting, in both streaming directions.
    page.on("dialog", async dialog => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });
    page.on("pageerror", error => errors.push(error.message));
    const encrypted = await encrypt(page, path);
    expect(encrypted.subarray(0, 11).toString()).toBe("zDKO6XYXioc");
    expect(await decryptLegacy(encrypted, password)).toEqual(plaintext);
    // The browser can receive the complete download before React handles the
    // worker's completion message. Wait before intentionally leaving the page.
    await expect(page.getByRole("heading", { name: "Your files are encrypted", exact: true })).toBeVisible();
    const panel = await decrypt(page, encrypted, path);
    const download = page.waitForEvent("download");
    const streamButton = panel.getByRole("button", { name: "Decrypt & download", exact: true });
    if (await streamButton.isVisible()) await streamButton.click();
    else await panel.getByRole("button", { name: "Download decrypted file", exact: true }).click();
    expect(await contents(await download)).toEqual(plaintext);
    expect(dialogs).toEqual([]);
    expect(new URL(page.url()).pathname).toBe(path);
    expect(new URL(page.url()).search).toBe("?tab=decryption");
    expect(errors).toEqual([]);
  });
}

test("cancelling a real page exit keeps streaming encryption alive", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Exercise the streaming page-exit guard in Chromium");
  await page.addInitScript(() => {
    const post = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function (data, ...args) {
      if (data.cmd === "requestEncryption") {
        window.resumeEncryption = () => post.call(this, data, ...args);
        return;
      }
      return post.call(this, data, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#enc-file")).toHaveAttribute("multiple", "");
  const panel = page.locator("#simple-tabpanel-0");
  await selectFile(panel, { name: "exit-test.txt", mimeType: "text/plain", buffer: plaintext });
  await panel.getByRole("button", { name: "Set a password", exact: true }).click();
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole("button", { name: "Review encryption", exact: true }).click();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Encrypt & download", exact: true }).click();
  await page.waitForFunction(() => !!window.resumeEncryption);
  await expect(page.getByRole("tab", { name: "Decrypt files", exact: true })).toBeDisabled();
  const dialog = page.waitForEvent("dialog");
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Exercise a real document exit and beforeunload prompt rather than client-side routing.
  const leave = page.evaluate(() => window.location.assign("/about/"));
  const prompt = await dialog;
  expect(prompt.type()).toBe("beforeunload");
  await prompt.dismiss();
  await leave;
  await page.evaluate(() => window.resumeEncryption());
  expect((await contents(await download)).subarray(0, 11).toString()).toBe("zDKO6XYXioc");
  await expect(page.getByRole("heading", { name: "Your files are encrypted", exact: true })).toBeVisible();
});

test("blocked storage still loads and encrypts", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("Blocked", "SecurityError"); },
  }));
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  expect((await encrypt(page)).byteLength).toBeGreaterThan(plaintext.byteLength);
  expect(errors).toEqual([]);
});

test("public-key file round trip", async ({ page }) => {
  await sodium.ready;
  const sender = sodium.crypto_kx_keypair(), receiver = sodium.crypto_kx_keypair();
  const encrypted = await encrypt(page, "/", {
    publicKey: sodium.to_base64(receiver.publicKey), privateKey: sodium.to_base64(sender.privateKey),
  });
  expect(encrypted.subarray(0, 11).toString()).toBe("hTWKbfoikeg");
  expect(await decryptLegacy(encrypted, password, { sender, receiver })).toEqual(plaintext);
  const panel = await decrypt(page, encrypted, "/", {
    publicKey: sodium.to_base64(sender.publicKey), privateKey: sodium.to_base64(receiver.privateKey),
  });
  const download = page.waitForEvent("download");
  const streamButton = panel.getByRole("button", { name: "Decrypt & download", exact: true });
  if (await streamButton.isVisible()) await streamButton.click();
  else await panel.getByRole("button", { name: "Download decrypted file", exact: true }).click();
  expect(await contents(await download)).toEqual(plaintext);
});

for (const mode of ["password", "public-key"]) {
  test(`decrypts a legacy 0.7.10 ${mode} file`, async ({ page }) => {
    await sodium.ready;
    const keys = mode === "public-key" ? { sender: sodium.crypto_kx_keypair(), receiver: sodium.crypto_kx_keypair() } : null;
    const encrypted = await encryptLegacy(plaintext, password, keys);
    const panel = await decrypt(page, encrypted, "/", keys ? {
      publicKey: sodium.to_base64(keys.sender.publicKey), privateKey: sodium.to_base64(keys.receiver.privateKey),
    } : undefined);
    const download = page.waitForEvent("download");
    const streamButton = panel.getByRole("button", { name: "Decrypt & download", exact: true });
    if (await streamButton.isVisible()) await streamButton.click();
    else await panel.getByRole("button", { name: "Download decrypted file", exact: true }).click();
    expect(await contents(await download)).toEqual(plaintext);
  });
}

test("malformed short encrypted file releases busy state", async ({ page }) => {
  await page.goto("/?tab=decryption");
  const panel = page.locator("#simple-tabpanel-1");
  await selectFile(panel, {
    name: "short.enc", mimeType: "application/octet-stream", buffer: Buffer.from("zDKO6XYXioc"),
  });
  await panel.getByRole("button", { name: "Check file", exact: true }).click();
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole("button", { name: /^(Check password|Decrypt file)$/ }).click();
  await expect(panel.getByText(/File processing failed|Could not open this file/i).first()).toBeVisible();
  await expect(panel.getByRole("button", { name: /^(Check password|Decrypt file)$/ }).last()).toBeEnabled();
});

for (const mode of ["buffered", "streaming"]) {
  test.describe(mode + " decryption", () => {
    if (mode === "buffered") test.use({ serviceWorkers: "block" });
    else test.skip(({ browserName }) => browserName !== "chromium", "Exercise streaming in a controlled Chromium page");

    test("does not accept an authenticated non-final chunk as a complete file", async ({ page }) => {
      await sodium.ready;
      const salt = sodium.randombytes_buf(16);
      const key = sodium.crypto_pwhash(32, password, salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_ARGON2ID13);
      const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
      const chunk = sodium.crypto_secretstream_xchacha20poly1305_push(state, plaintext, null, sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE);
      const encrypted = Buffer.concat([Buffer.from("zDKO6XYXioc"), Buffer.from(salt), Buffer.from(header), Buffer.from(chunk)]);

      await page.goto("/");
      if (mode === "streaming") {
        // The first worker can replace the buffered file input as it takes control.
        await expect(page.locator("#dec-file")).toHaveAttribute("multiple", "");
      }
      const panel = await decrypt(page, encrypted, "/", undefined, false);
      if (mode === "streaming") {
        const streamButton = panel.getByRole("button", { name: "Decrypt & download", exact: true });
        await expect(streamButton).toBeEnabled();
        await streamButton.click();
      }
      await expect(panel.getByRole("alert").filter({ hasText: "File processing failed" })).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Your files are decrypted and verified", exact: true })).toBeHidden();
      await expect(panel.getByRole("button", { name: "Download decrypted file", exact: true })).toBeHidden();
    });
  });
}

test("large file metadata does not read the entire file for hashing", async ({ page }) => {
  await page.goto("/");
  // File contents are synthesized in the browser to avoid an enormous fixture.
  const panel = page.locator("#simple-tabpanel-0");
  await expect(panel.locator("#enc-file")).toBeAttached();
  await panel.evaluate(root => {
    const input = root.querySelector("#enc-file");
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(33 * 1024 * 1024)], "large.bin"));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "File information: large.bin", exact: true }).click();
  await expect(page.getByText("Hashes are calculated only for files up to 32 MiB to limit memory use.")).toBeVisible();
});

test("Firefox streams files in a normal persistent profile", async ({ browserName, playwright }) => {
  test.skip(browserName !== "firefox", "Firefox-specific persistent profile");
  const os = require("node:os"), path = require("node:path");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "veli-firefox-"));
  const context = await playwright.firefox.launchPersistentContext(directory, {
    headless: true, baseURL: "http://127.0.0.1:3000", acceptDownloads: true,
  });
  try {
    const page = await context.newPage();
    const encrypted = await encrypt(page, "/", undefined, { streaming: true });
    await expect(page.getByRole("heading", { name: "Your files are encrypted", exact: true })).toBeVisible();
    // Firefox automation navigation can bypass worker control. Exercise both
    // stream directions within the same controlled page using the app's tab.
    const panel = await decrypt(page, encrypted, "/", undefined, false);
    const download = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Decrypt & download", exact: true }).click();
    expect(await contents(await download)).toEqual(plaintext);
  } finally {
    await context.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
