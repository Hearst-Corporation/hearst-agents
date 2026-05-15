import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173");
  // Wait for the canvas to render
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshot.png" });
  await browser.close();
})();
