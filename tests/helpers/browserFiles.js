const { expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const password = "Browser-test-password-123!";
const plaintext = Buffer.from("Veli browser round trip: 한글 🔐\n");

async function contents(download) {
  expect(await download.failure()).toBeNull();
  return fs.readFile(await download.path());
}

async function selectFile(panel, file) {
  await expect(panel.locator('input[type="file"]')).toBeAttached();
  // A first worker claim can replace the input. Resolve and populate the
  // current input in one browser task under the stable workflow panel.
  await panel.evaluate((root, { name, mimeType, data }) => {
    const input = root.querySelector('input[type="file"]');
    if (!input) throw new Error("The workflow has no file input");
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: mimeType }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { name: file.name, mimeType: file.mimeType, data: file.buffer.toString("base64") });
  await expect(panel.getByText(file.name, { exact: true })).toBeVisible();
}

async function encrypt(page, path = "/", keys, { streaming = false } = {}) {
  await page.goto(path);
  const input = page.locator("#enc-file");
  if (streaming) await expect(input).toHaveAttribute("multiple", "");
  const panel = page.locator("#simple-tabpanel-0");
  await selectFile(panel, { name: "한글 document.txt", mimeType: "text/plain", buffer: plaintext });
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
  const panel = page.locator("#simple-tabpanel-1");
  await selectFile(panel, { name: "한글 document.txt.enc", mimeType: "application/octet-stream", buffer: encrypted });
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

module.exports = { selectFile, contents, encrypt, decrypt, plaintext, password };
