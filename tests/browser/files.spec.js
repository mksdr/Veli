const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const sodium = require("libsodium-wrappers-sumo");
const { encryptLegacy, decryptLegacy } = require("../helpers/legacyCrypto");
const password = "Browser-test-password-123!";
const plaintext = Buffer.from("Veli browser round trip: 한글 🔐\n");

async function contents(download) {
  expect(await download.failure()).toBeNull();
  return fs.readFile(await download.path());
}

async function encrypt(page, path = "/", keys) {
  await page.goto(path);
  await page.locator("#enc-file").setInputFiles({ name: "한글 document.txt", mimeType: "text/plain", buffer: plaintext });
  const panel = page.locator("#simple-tabpanel-0");
  await panel.getByRole("button", { name: "Set a password", exact: true }).last().click();
  if (keys) {
    await panel.getByRole("button", { name: "Use public keys · Advanced", exact: true }).click();
    await panel.getByPlaceholder("Enter recipient's public key").fill(keys.publicKey);
    await panel.getByPlaceholder("Enter your private key").fill(keys.privateKey);
  } else {
    await panel.locator('input[type="password"]').fill(password);
  }
  await panel.getByRole("button", { name: "Review encryption", exact: true }).click();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: /^(Encrypt & download|Encrypt file)$/ }).click();
  // Buffered mode presents a separate download button after encryption.
  const buffered = panel.getByRole("button", { name: "Download encrypted file", exact: true });
  if (await buffered.isVisible()) await buffered.click();
  else {
    await Promise.race([
      download,
      buffered.waitFor({ state: "visible" }).then(() => buffered.click()),
    ]);
  }
  return contents(await download);
}

async function decrypt(page, encrypted, path = "/", keys, navigate = true) {
  if (navigate) await page.goto(path + "?tab=decryption");
  else await page.getByRole("tab", { name: "Decrypt files", exact: true }).click();
  await page.locator("#dec-file").setInputFiles({ name: "한글 document.txt.enc", mimeType: "application/octet-stream", buffer: encrypted });
  const panel = page.locator("#simple-tabpanel-1");
  await panel.getByRole("button", { name: "Check file", exact: true }).click();
  if (keys) {
    await panel.getByPlaceholder("Enter sender's public key").fill(keys.publicKey);
    await panel.getByPlaceholder("Enter your private key").fill(keys.privateKey);
  } else {
    await panel.locator('input[type="password"]').fill(password);
  }
  await panel.getByRole("button", { name: /^(Check password|Check keys|Decrypt file)$/ }).click();
  await Promise.race([
    panel.getByRole("button", { name: "Decrypt & download", exact: true }).waitFor({ state: "visible" }),
    panel.getByRole("button", { name: "Download decrypted file", exact: true }).waitFor({ state: "visible" }),
    panel.getByRole("alert").filter({ hasText: "File processing failed" }).waitFor({ state: "visible" }),
  ]);
  return panel;
}

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
  await page.locator("#enc-file").setInputFiles({ name: "exit-test.txt", mimeType: "text/plain", buffer: plaintext });
  const panel = page.locator("#simple-tabpanel-0");
  await panel.getByRole("button", { name: "Set a password", exact: true }).click();
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole("button", { name: "Review encryption", exact: true }).click();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Encrypt & download", exact: true }).click();
  await page.waitForFunction(() => !!window.resumeEncryption);
  await expect(page.getByRole("tab", { name: "Decrypt files", exact: true })).toBeDisabled();
  const dialog = page.waitForEvent("dialog");
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
  await page.locator("#dec-file").setInputFiles({
    name: "short.enc", mimeType: "application/octet-stream", buffer: Buffer.from("zDKO6XYXioc"),
  });
  const panel = page.locator("#simple-tabpanel-1");
  await panel.getByRole("button", { name: "Check file", exact: true }).click();
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole("button", { name: /^(Check password|Decrypt file)$/ }).click();
  await expect(panel.getByText(/File processing failed|Could not open this file/i).first()).toBeVisible();
  await expect(panel.getByRole("button", { name: /^(Check password|Decrypt file)$/ }).last()).toBeEnabled();
});

test("does not accept an authenticated non-final chunk as a complete file", async ({ page }) => {
  await sodium.ready;
  const salt = sodium.randombytes_buf(16);
  const key = sodium.crypto_pwhash(32, password, salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_ARGON2ID13);
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const chunk = sodium.crypto_secretstream_xchacha20poly1305_push(state, plaintext, null, 0);
  const encrypted = Buffer.concat([Buffer.from("zDKO6XYXioc"), Buffer.from(salt), Buffer.from(header), Buffer.from(chunk)]);
  const panel = await decrypt(page, encrypted);
  const streamButton = panel.getByRole("button", { name: "Decrypt & download", exact: true });
  await Promise.race([
    streamButton.waitFor({ state: "visible" }),
    panel.getByRole("alert").filter({ hasText: "File processing failed" }).waitFor({ state: "visible" }),
  ]);
  if (await streamButton.isVisible()) await streamButton.click();
  await expect(panel.getByRole("alert").filter({ hasText: "File processing failed" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Download decrypted file", exact: true })).toBeHidden();
});

test("large file metadata does not read the entire file for hashing", async ({ page }) => {
  await page.goto("/");
  // File contents are synthesized in the browser to avoid an enormous fixture.
  await page.locator("#enc-file").evaluate(input => {
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
    const encrypted = await encrypt(page);
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
