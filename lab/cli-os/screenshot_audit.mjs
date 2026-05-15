import path from "path";
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina display for better audit
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4202/cockpit");

  // Wait for animations and canvas
  await page.waitForTimeout(3000);

  // Ensure the directory exists
  const outputPath = path.resolve("../../docs/visual/refs/lab-cockpit-4202-recheck.jpeg");

  await page.screenshot({ path: outputPath, type: "jpeg", quality: 90 });
  await browser.close();
  console.log("Screenshot saved to", outputPath);
})();
