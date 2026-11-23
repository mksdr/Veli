const { expect } = require("@playwright/test");
const fs = require("node:fs/promises");
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

module.exports = { contents, encrypt, decrypt, plaintext, password };
