import path from "path";
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const filePath =
    "file://" +
    path.resolve("/Users/adrienbeyondcrypto/Dev/hearst-os/docs/visual/dashboard-template.html");
  await page.goto(filePath + "#home");
  await page.waitForTimeout(5000); // give animations time to render
  await page.screenshot({ path: "screenshot3.png" });
  await browser.close();
})();
