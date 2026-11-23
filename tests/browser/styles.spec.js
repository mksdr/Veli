const { test, expect } = require("@playwright/test");

async function expectDocumentStyles(page) {
  const main = page.locator("main");
  await expect(main).toHaveCSS("padding-top", "24px");
  await expect(main).toHaveCSS("margin-top", "20px");
  await expect(main.locator("h1").first()).toHaveCSS("padding-bottom", "15px");
  await expect(main.locator("h2").first()).toHaveCSS("padding-top", "20px");
  await expect(main.locator("li").first()).toHaveCSS("padding-left", "2.5px");
  await expect(main.locator(":not(pre) > code").first()).toHaveCSS("padding-left", "7px");
  const pre = main.locator("pre").first();
  await expect(pre).toHaveCSS("background-color", "rgb(46, 52, 64)");
  await expect(pre).toHaveCSS("padding-top", "13px");
  await expect(pre).toHaveCSS("border-radius", "3px");
  await expect(pre.locator("code")).toHaveCSS("color", "rgb(248, 248, 242)");
  await expect(main.locator("blockquote p").first()).toHaveCSS("padding-top", "10px");
}

async function expectPageLayout(page, route) {
  const root = page.locator("footer").locator("..");
  await expect(root).toHaveCSS("min-height", `${page.viewportSize().height}px`);
  if (route === "/about/") {
    await expectDocumentStyles(page);
  } else {
    await expect(root).toHaveCSS("display", "flex");
    await expect(root).toHaveCSS("flex-direction", "column");
    const container = page.locator(".MuiContainer-root").filter({ has: page.locator(".keyPairGenerateBtn") });
    await expect(container).toHaveCSS("max-width", "768px");
    await expect(page.locator(".keyPairGenerateBtn")).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("exported pages include their styles before JavaScript runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const route of ["/about/", "/generate-keys/"]) {
      await page.goto(route);
      await expect(page.locator("footer").locator("..")).toHaveCSS("background-color", "rgb(245, 247, 250)");
      await expectPageLayout(page, route);
    }
  } finally {
    await context.close();
  }
});

test("exported help includes working section anchors and highlighted JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/about/");
    const main = page.locator("main");
    await expect(main.locator("h1#technical-details")).toHaveText("Technical Details");
    const missingTargets = await main.locator('a[href^="#"]').evaluateAll((links) =>
      links.map((link) => link.hash.slice(1)).filter((id) => !document.getElementById(id)),
    );
    expect(missingTargets).toEqual([]);
    await expect(main.locator("pre code.language-javascript .token.keyword").first()).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const route of ["/about/", "/generate-keys/"]) {
  test(`${route} keeps its layout when switching themes and reloading`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem("language", "en_US");
      // Leave a saved theme intact when reloading.
      if (localStorage.getItem("darkTheme") === null) localStorage.setItem("darkTheme", "0");
    });
    await page.goto(route);
    const root = page.locator("footer").locator("..");
    await expect(root).toHaveCSS("background-color", "rgb(245, 247, 250)");
    await expectPageLayout(page, route);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("checkbox", { name: "Dark Mode", exact: true }).check();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(root).toHaveCSS("background-color", "rgb(18, 24, 32)");
    await expectPageLayout(page, route);
    await page.reload();
    await expect(root).toHaveCSS("background-color", "rgb(18, 24, 32)");
    await expectPageLayout(page, route);
    expect(errors).toEqual([]);
  });
}
