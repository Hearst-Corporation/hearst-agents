import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const URL_ARG = process.argv[2];
const SLUG = process.argv[3];
const OUT = `themes/${SLUG}`;
await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(`${OUT}/assets`, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Heist-DS-Scraper/1.0",
});
const page = await ctx.newPage();

await page.goto(URL_ARG, { waitUntil: "networkidle", timeout: 45_000 });
await page.waitForTimeout(2500);

await page.screenshot({ path: `${OUT}/reference.png`, fullPage: false });
await page.screenshot({ path: `${OUT}/reference-full.png`, fullPage: true });

const tokens = await page.evaluate(() => {
  const SELECTORS = [
    "body", "main", "header", "nav", "footer", "section", "article",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "small", "code",
    "button", "input", "textarea", "select", "label",
    "[class*='btn']", "[class*='button']", "[class*='card']", "[class*='primary']",
    "[class*='accent']", "[class*='hero']", "[class*='cta']", "[class*='link']",
    ".container", ".wrapper", ".grid", "[role='button']", "[role='link']",
  ];

  const seen = new Set();
  const samples = [];
  for (const sel of SELECTORS) {
    try {
      const nodes = document.querySelectorAll(sel);
      for (const node of Array.from(nodes).slice(0, 3)) {
        const cs = getComputedStyle(node);
        const key = `${sel}::${cs.color}::${cs.backgroundColor}::${cs.fontSize}`;
        if (seen.has(key)) continue;
        seen.add(key);
        samples.push({
          selector: sel,
          tag: node.tagName.toLowerCase(),
          text: node.textContent?.slice(0, 60),
          color: cs.color,
          background: cs.backgroundColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          padding: cs.padding,
          margin: cs.margin,
          gap: cs.gap,
          borderRadius: cs.borderRadius,
          border: cs.border,
          boxShadow: cs.boxShadow,
          transition: cs.transition,
          transform: cs.transform,
        });
      }
    } catch {}
  }

  const allColors = {};
  const allBg = {};
  const allFg = {};
  const all = document.querySelectorAll("*");
  for (const el of Array.from(all).slice(0, 3000)) {
    const cs = getComputedStyle(el);
    const c = cs.color;
    const b = cs.backgroundColor;
    const br = cs.borderColor;
    if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
      allColors[c] = (allColors[c] || 0) + 1;
      allFg[c] = (allFg[c] || 0) + 1;
    }
    if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") {
      allColors[b] = (allColors[b] || 0) + 1;
      allBg[b] = (allBg[b] || 0) + 1;
    }
    if (br && br !== "rgba(0, 0, 0, 0)" && br !== "transparent") {
      allColors[br] = (allColors[br] || 0) + 1;
    }
  }
  const palette = Object.entries(allColors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([color, count]) => ({ color, count }));
  const topBg = Object.entries(allBg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => ({ c, n }));
  const topFg = Object.entries(allFg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => ({ c, n }));

  const fonts = new Set();
  for (const el of Array.from(all).slice(0, 1000)) {
    fonts.add(getComputedStyle(el).fontFamily);
  }

  // Font sizes distribution
  const sizes = {};
  for (const el of Array.from(all).slice(0, 2000)) {
    const fs = getComputedStyle(el).fontSize;
    if (fs) sizes[fs] = (sizes[fs] || 0) + 1;
  }
  const topSizes = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s, n]) => ({ s, n }));

  // Radii distribution
  const radii = {};
  for (const el of Array.from(all).slice(0, 2000)) {
    const r = getComputedStyle(el).borderRadius;
    if (r && r !== "0px") radii[r] = (radii[r] || 0) + 1;
  }
  const topRadii = Object.entries(radii).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => ({ r, n }));

  // Shadows
  const shadows = {};
  for (const el of Array.from(all).slice(0, 2000)) {
    const sh = getComputedStyle(el).boxShadow;
    if (sh && sh !== "none") shadows[sh] = (shadows[sh] || 0) + 1;
  }
  const topShadows = Object.entries(shadows).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, n]) => ({ s, n }));

  const logo =
    document.querySelector("link[rel*='icon']")?.href ||
    document.querySelector("header img")?.src ||
    document.querySelector("nav img")?.src ||
    null;

  const images = Array.from(document.querySelectorAll("img"))
    .slice(0, 12)
    .map((img) => ({ src: img.src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight }));

  const cssVars = {};
  for (const el of [document.documentElement, document.body]) {
    const style = el.style;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith("--")) cssVars[prop] = style.getPropertyValue(prop);
    }
  }
  const rootCs = getComputedStyle(document.documentElement);
  for (let i = 0; i < rootCs.length; i++) {
    const prop = rootCs[i];
    if (prop.startsWith("--")) cssVars[prop] = rootCs.getPropertyValue(prop);
  }

  return { samples, palette, topBg, topFg, topSizes, topRadii, topShadows, fonts: [...fonts], logo, images, cssVars, title: document.title, host: location.host };
});

await fs.writeFile(`${OUT}/raw.json`, JSON.stringify(tokens, null, 2));

if (tokens.logo) {
  try {
    const res = await fetch(tokens.logo);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (tokens.logo.split(".").pop() || "png").split("?")[0].slice(0, 5);
    await fs.writeFile(`${OUT}/assets/logo.${ext}`, buf);
  } catch (e) { console.warn("logo fail", e.message); }
}

for (const img of tokens.images.slice(0, 6)) {
  try {
    const res = await fetch(img.src);
    const buf = Buffer.from(await res.arrayBuffer());
    const name = path.basename(new URL(img.src).pathname).slice(0, 40) || "img.bin";
    await fs.writeFile(`${OUT}/assets/${name}`, buf);
  } catch (e) {}
}

await browser.close();
console.log(`Tokens extraits → ${OUT}/raw.json`);
console.log(`  palette: ${tokens.palette.length} couleurs`);
console.log(`  fonts: ${tokens.fonts.length} familles`);
console.log(`  sizes: ${tokens.topSizes.length} tailles dominantes`);
console.log(`  radii: ${tokens.topRadii.length} radius`);
console.log(`  shadows: ${tokens.topShadows.length} shadows`);
