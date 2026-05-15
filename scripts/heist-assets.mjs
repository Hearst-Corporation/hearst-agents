/**
 * heist-assets.mjs — Multi-page asset crawler pour un thème /heist.
 *
 * Usage : node scripts/heist-assets.mjs <base-url> <slug>
 * Ex    : node scripts/heist-assets.mjs https://robotflowtemplate.webflow.io robotflowtemplate-webflow-io
 *
 * Produit :
 *   - public/themes/<slug>/assets/<files>     (fichiers téléchargés)
 *   - themes/<slug>/assets.json               (manifest complet)
 *   - themes/<slug>/catalog.html              (catalogue HTML navigable)
 *   - themes/<slug>/seed.sql                  (INSERT pour theme_assets)
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE_URL = process.argv[2];
const SLUG     = process.argv[3];

if (!BASE_URL || !SLUG) {
  console.error("Usage: node scripts/heist-assets.mjs <base-url> <slug>");
  process.exit(1);
}

const HOST      = new URL(BASE_URL).hostname;
const ASSET_DIR = `public/themes/${SLUG}/assets`;
const META_DIR  = `themes/${SLUG}`;
const MAX_PAGES = 40;
const CONCURRENCY = 3;

await fs.mkdir(ASSET_DIR, { recursive: true });
await fs.mkdir(META_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameHost(url) {
  try { return new URL(url).hostname === HOST; } catch { return false; }
}

function classifyAsset(url, width, height, alt = "") {
  const u = url.toLowerCase();
  const name = path.basename(u).split("?")[0];

  if (u.includes(".mp4") || u.includes(".webm") || u.includes(".mov")) return "video";
  if (u.includes("font") || u.endsWith(".woff") || u.endsWith(".woff2") || u.endsWith(".ttf")) return "font";

  const isSvg = u.endsWith(".svg") || u.includes(".svg");
  const smallDim = width > 0 && height > 0 && width < 100 && height < 100;

  const logoPatterns = ["logo", "brand", "mark", "wordmark"];
  const iconPatterns = ["icon", "ico", "arrow", "chevron", "check", "plus", "minus", "close", "menu"];
  const bgPatterns   = ["bg", "background", "pattern", "texture", "noise", "grain", "gradient", "blob"];
  const photoPatterns = ["photo", "image", "img", "picture", "hero", "banner", "cover", "thumbnail", "feature", "product"];

  const isLogo   = logoPatterns.some(p => name.includes(p) || alt.toLowerCase().includes(p));
  const isIcon   = iconPatterns.some(p => name.includes(p) || alt.toLowerCase().includes(p)) || smallDim;
  const isBg     = bgPatterns.some(p => name.includes(p));
  const isPhoto  = photoPatterns.some(p => name.includes(p));

  if (isLogo) return "logo";
  if (isSvg && isIcon) return "icon";
  if (isSvg) return "svg";
  if (isIcon) return "icon";
  if (isBg) return "background";
  if (isPhoto || (width > 400 && height > 400)) return "photo";
  return "image";
}

function safeFilename(url) {
  try {
    const u = new URL(url);
    const name = path.basename(u.pathname).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
    const ext  = path.extname(name) || ".bin";
    const base = path.basename(name, ext).slice(0, 50);
    return `${base}_${hash}${ext}`;
  } catch {
    return `asset_${createHash("sha1").update(url).digest("hex").slice(0, 12)}.bin`;
  }
}

async function downloadAsset(url, filename) {
  const dest = path.join(ASSET_DIR, filename);
  try {
    const existing = await fs.stat(dest).catch(() => null);
    if (existing) return { ok: true, size: existing.size, cached: true };

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Heist-DS-Scraper/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const buf     = Buffer.from(await res.arrayBuffer());
    const mime    = res.headers.get("content-type") || "application/octet-stream";
    await fs.writeFile(dest, buf);
    return { ok: true, size: buf.byteLength, mime };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ─── Phase 1 : découverte des pages ───────────────────────────────────────────

console.log(`\n🕷  Heist Assets — ${HOST}`);
console.log(`   Slug : ${SLUG}`);
console.log(`   Max  : ${MAX_PAGES} pages\n`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (Macintosh) Heist-DS-Scraper/1.0",
  ignoreHTTPSErrors: true,
});

const discovered = new Set([BASE_URL]);
const queue      = [BASE_URL];
const visited    = new Set();

// Visite la homepage pour trouver tous les liens internes
{
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForTimeout(2000);

  const links = await page.$$eval("a[href]", (els) =>
    els.map((a) => a.href).filter(Boolean)
  );

  for (const link of links) {
    try {
      const u = new URL(link);
      if (u.hostname !== new URL(BASE_URL).hostname) continue;
      const clean = `${u.origin}${u.pathname}`;
      if (!discovered.has(clean)) {
        discovered.add(clean);
        queue.push(clean);
      }
    } catch {}
  }
  await page.close();
  console.log(`📋 Pages découvertes : ${discovered.size}`);
}

// ─── Phase 2 : scrape assets par page ─────────────────────────────────────────

const allAssets = new Map(); // url → asset meta
const pageStats = [];

async function scrapePage(pageUrl) {
  if (visited.has(pageUrl)) return;
  visited.add(pageUrl);

  const page = await ctx.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(1500);

    const extracted = await page.evaluate(() => {
      const assets = [];
      const seen = new Set();

      function addAsset(url, type, { alt = "", width = 0, height = 0, tag = "" } = {}) {
        if (!url || url.startsWith("data:") || seen.has(url)) return;
        seen.add(url);
        assets.push({ url, alt, width, height, tag, type });
      }

      // <img>
      document.querySelectorAll("img").forEach((img) => {
        addAsset(img.src, "img", {
          alt: img.alt,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          tag: "img",
        });
        // srcset
        if (img.srcset) {
          img.srcset.split(",").forEach((entry) => {
            const url = entry.trim().split(/\s+/)[0];
            if (url) addAsset(url, "img", { alt: img.alt, tag: "img-srcset" });
          });
        }
      });

      // <video>/<source>
      document.querySelectorAll("video, source").forEach((el) => {
        const src = el.src || el.getAttribute("src");
        if (src) addAsset(src, "video", { tag: el.tagName.toLowerCase() });
      });

      // SVG inline (keep top-level, take outerHTML snippet)
      document.querySelectorAll("svg").forEach((svg) => {
        const id = svg.id || svg.classList[0] || "";
        const w  = svg.viewBox?.baseVal?.width || svg.width?.baseVal?.value || 0;
        const h  = svg.viewBox?.baseVal?.height || svg.height?.baseVal?.value || 0;
        // Only keep meaningful SVGs (not tiny decorative)
        if (w > 0 || h > 0 || svg.children.length > 1) {
          const snippet = svg.outerHTML.slice(0, 4000);
          // Mark as inline SVG — we'll save separately
          assets.push({ url: `inline-svg:${id}:${w}x${h}`, alt: id, width: w, height: h, tag: "svg", type: "svg", snippet });
        }
      });

      // background-image CSS
      const all = document.querySelectorAll("*");
      for (const el of Array.from(all).slice(0, 4000)) {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg.startsWith("url(")) {
          const match = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/);
          if (match?.[1] && !match[1].startsWith("data:")) {
            addAsset(match[1], "img", { tag: "css-bg" });
          }
        }
      }

      // <link rel="icon">
      document.querySelectorAll("link[rel*='icon'], link[rel*='apple']").forEach((link) => {
        if (link.href) addAsset(link.href, "img", { alt: "favicon", tag: "link-icon" });
      });

      return assets;
    });

    const pagePath = new URL(pageUrl).pathname || "/";
    let pageCount = 0;

    for (const a of extracted) {
      // Inline SVGs: save as .svg file
      if (a.url.startsWith("inline-svg:") && a.snippet) {
        const svgId    = a.url.replace(/^inline-svg:/, "").replace(/[^a-zA-Z0-9-]/g, "_");
        const filename = `inline_${svgId}_${createHash("sha1").update(a.snippet).digest("hex").slice(0, 8)}.svg`;
        const existing = allAssets.get(`inline:${filename}`);
        if (!existing) {
          await fs.writeFile(path.join(ASSET_DIR, filename), a.snippet).catch(() => {});
          allAssets.set(`inline:${filename}`, {
            url: `inline:${filename}`,
            alt: a.alt || svgId,
            width: a.width,
            height: a.height,
            type: "svg",
            category: "svg",
            filename,
            local_path: `/themes/${SLUG}/assets/${filename}`,
            source_page: pagePath,
            file_size: a.snippet.length,
            mime_type: "image/svg+xml",
          });
          pageCount++;
        }
        continue;
      }

      // Resolve relative URLs
      let resolvedUrl;
      try { resolvedUrl = new URL(a.url, pageUrl).href; } catch { continue; }

      if (allAssets.has(resolvedUrl)) continue;

      const filename = safeFilename(resolvedUrl);
      const dl       = await downloadAsset(resolvedUrl, filename);

      const category = classifyAsset(resolvedUrl, a.width, a.height, a.alt);

      allAssets.set(resolvedUrl, {
        url: resolvedUrl,
        alt: a.alt || "",
        width: a.width || 0,
        height: a.height || 0,
        type: a.type || "image",
        category,
        filename,
        local_path: `/themes/${SLUG}/assets/${filename}`,
        source_page: pagePath,
        file_size: dl.size || 0,
        mime_type: dl.mime || guessMime(resolvedUrl),
        download_ok: dl.ok,
        cached: dl.cached,
      });
      pageCount++;
    }

    pageStats.push({ url: pageUrl, path: pagePath, assets: pageCount });
    process.stdout.write(`  ✓ [${visited.size}] ${pagePath} → ${pageCount} assets\n`);
  } catch (e) {
    process.stdout.write(`  ✗ [${visited.size}] ${pageUrl} → ${e.message.slice(0, 60)}\n`);
  } finally {
    await page.close();
  }
}

function guessMime(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const map = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  };
  return map[ext] || "application/octet-stream";
}

// Scrape pages with limited concurrency
const pageList = [...queue].slice(0, MAX_PAGES);
console.log(`\n📄 Scrape de ${pageList.length} pages...\n`);

for (let i = 0; i < pageList.length; i += CONCURRENCY) {
  const batch = pageList.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(scrapePage));
}

await browser.close();

// ─── Phase 3 : manifest assets.json ───────────────────────────────────────────

const assets = [...allAssets.values()].filter((a) => a.download_ok !== false);
const byCategory = {};
for (const a of assets) {
  if (!byCategory[a.category]) byCategory[a.category] = [];
  byCategory[a.category].push(a);
}

const manifest = {
  slug: SLUG,
  source: BASE_URL,
  captured: new Date().toISOString(),
  pages_scraped: pageStats.length,
  total_assets: assets.length,
  by_category: Object.fromEntries(
    Object.entries(byCategory).map(([cat, items]) => [cat, items.length])
  ),
  assets,
};

await fs.writeFile(`${META_DIR}/assets.json`, JSON.stringify(manifest, null, 2));
console.log(`\n📦 Manifest → ${META_DIR}/assets.json (${assets.length} assets)`);

// ─── Phase 4 : seed.sql ───────────────────────────────────────────────────────

const rows = assets.map((a) => {
  const esc = (s) => String(s || "").replace(/'/g, "''").slice(0, 500);
  return `  ('${SLUG}', '${esc(a.url)}', '${esc(a.local_path)}', '${esc(a.type)}', '${esc(a.category)}', '${esc(a.alt)}', ${a.width || 0}, ${a.height || 0}, ${a.file_size || 0}, '${esc(a.mime_type)}', '${esc(a.source_page)}', '${esc(a.filename)}')`;
});

const seedSql = `-- Seed theme_assets pour le thème "${SLUG}"
-- Généré le ${new Date().toISOString()}
-- Lancer APRÈS migration 0082_theme_assets.sql

insert into public.theme_assets
  (theme_slug, asset_url, local_path, asset_type, category, alt_text, width, height, file_size, mime_type, source_page, filename)
values
${rows.join(",\n")}
on conflict (theme_slug, asset_url) do update set
  local_path = excluded.local_path,
  category   = excluded.category,
  alt_text   = excluded.alt_text,
  width      = excluded.width,
  height     = excluded.height,
  file_size  = excluded.file_size;
`;

await fs.writeFile(`${META_DIR}/seed.sql`, seedSql);
console.log(`💾 Seed SQL → ${META_DIR}/seed.sql`);

// ─── Phase 5 : catalog.html ───────────────────────────────────────────────────

const CATEGORY_LABELS = {
  photo: "📸 Photos",
  logo: "🏷  Logos",
  icon: "🔷 Icons",
  svg: "✦  SVGs inline",
  background: "🌌 Backgrounds",
  image: "🖼  Images",
  video: "🎬 Vidéos",
  font: "🔠 Fonts",
};

const categoryOrder = ["logo", "photo", "image", "background", "icon", "svg", "video", "font"];
const sortedCategories = categoryOrder.filter((c) => byCategory[c]?.length);

function assetCard(a) {
  const isVideo = a.category === "video";
  const isFont  = a.category === "font";
  const isSvg   = a.url.startsWith("inline:");
  const thumb   = isSvg
    ? `/themes/${SLUG}/assets/${a.filename}`
    : isVideo
    ? ""
    : `/themes/${SLUG}/assets/${a.filename}`;
  const dim = a.width && a.height ? `${a.width}×${a.height}` : "";
  const size = a.file_size > 0
    ? a.file_size > 1024 * 1024
      ? `${(a.file_size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(a.file_size / 1024)} KB`
    : "";

  const preview = isVideo
    ? `<div class="thumb video-thumb"><span class="play">▶</span></div>`
    : isFont
    ? `<div class="thumb font-thumb"><span>Aa</span></div>`
    : `<img class="thumb" src="${thumb}" alt="${a.alt || a.filename}" loading="lazy" onerror="this.src='/themes/${SLUG}/assets/placeholder.svg';this.onerror=null" />`;

  const srcDisplay = a.url.startsWith("inline:") ? "(inline SVG)" : a.url;

  return `<div class="card" data-cat="${a.category}" data-src="${a.source_page}" data-name="${a.filename.toLowerCase()}">
  ${preview}
  <div class="card-body">
    <div class="card-name" title="${a.filename}">${a.filename.slice(0, 48)}</div>
    <div class="card-meta">
      ${dim ? `<span class="pill">${dim}</span>` : ""}
      ${size ? `<span class="pill">${size}</span>` : ""}
      <span class="pill cat-pill cat-${a.category}">${a.category}</span>
    </div>
    ${a.alt ? `<div class="card-alt">${a.alt.slice(0, 80)}</div>` : ""}
    <div class="card-source">${a.source_page || "/"}</div>
  </div>
  <div class="card-actions">
    <a class="btn-dl" href="/themes/${SLUG}/assets/${a.filename}" download="${a.filename}" title="Télécharger">↓ dl</a>
    <button class="btn-copy" data-url="/themes/${SLUG}/assets/${a.filename}" title="Copier le chemin">⌅ copy</button>
  </div>
</div>`;
}

const totalByPage = Object.fromEntries(pageStats.map((p) => [p.path, p.assets]));

const catalog = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SLUG} — Asset Catalog</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#05060A;color:#B6BCC9;font-size:14px;min-height:100vh}
  a{color:inherit;text-decoration:none}

  /* ── Layout ── */
  .layout{display:grid;grid-template-columns:240px 1fr;grid-template-rows:56px 1fr;height:100vh;overflow:hidden}
  .topbar{grid-column:1/-1;background:#0D0F14;border-bottom:1px solid #1E2028;display:flex;align-items:center;gap:16px;padding:0 24px}
  .sidebar{background:#090B10;border-right:1px solid #1E2028;overflow-y:auto;padding:16px 0}
  .main{overflow-y:auto;padding:24px}

  /* ── Topbar ── */
  .logo{font-weight:600;font-size:15px;color:#fff;letter-spacing:-.3px}
  .logo span{color:#523FF5}
  .subtitle{color:#666D7F;font-size:13px}
  .searchbox{margin-left:auto;display:flex;align-items:center;gap:8px}
  .searchbox input{background:#1A1D24;border:1px solid #2A2F3A;border-radius:8px;color:#E8EAF0;padding:7px 12px;font-size:13px;outline:none;width:240px;font-family:inherit}
  .searchbox input:focus{border-color:#523FF5}
  .stat-badge{background:#1A1D24;border:1px solid #2A2F3A;border-radius:6px;padding:4px 10px;font-size:12px;color:#7C818D;white-space:nowrap}
  .stat-badge strong{color:#E8EAF0}

  /* ── Sidebar ── */
  .sidebar-section{padding:8px 16px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#3E4455;font-weight:600}
  .nav-item{display:flex;align-items:center;justify-content:space-between;padding:7px 16px;cursor:pointer;border-radius:0;transition:background .15s;color:#9BA3B5;font-size:13px}
  .nav-item:hover{background:#111318;color:#E8EAF0}
  .nav-item.active{background:#111318;color:#E8EAF0;border-left:2px solid #523FF5}
  .nav-item .count{background:#1E2028;border-radius:4px;padding:1px 6px;font-size:11px;font-family:monospace}
  .divider{border:none;border-top:1px solid #1E2028;margin:8px 16px}

  /* ── Page filter ── */
  .page-list{padding:0 16px;margin-top:4px}
  .page-item{display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;cursor:pointer;color:#7C818D;font-size:12px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .page-item:hover{background:#111318;color:#E8EAF0}
  .page-item.active{background:#111318;color:#E8EAF0}
  .page-item .pcnt{font-size:11px;opacity:.6;flex-shrink:0;margin-left:4px}

  /* ── Main ── */
  .section-header{display:flex;align-items:baseline;gap:12px;margin-bottom:16px;margin-top:32px;padding-bottom:8px;border-bottom:1px solid #1E2028}
  .section-header:first-child{margin-top:0}
  .section-title{font-size:17px;font-weight:600;color:#E8EAF0}
  .section-count{font-size:12px;color:#4A5066}

  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:8px}

  /* ── Cards ── */
  .card{background:#0D0F14;border:1px solid #1E2028;border-radius:12px;overflow:hidden;transition:border-color .2s,transform .2s;display:flex;flex-direction:column}
  .card:hover{border-color:#2A3050;transform:translateY(-1px)}
  .card[data-hidden="true"]{display:none}

  .thumb{width:100%;aspect-ratio:4/3;object-fit:contain;background:#08090E;display:block;padding:8px}
  .video-thumb,.font-thumb{width:100%;aspect-ratio:4/3;background:#08090E;display:flex;align-items:center;justify-content:center;font-size:28px;color:#2A2F3A}
  .font-thumb span{font-size:40px;font-weight:700;color:#3A4055}

  .card-body{padding:10px 12px;flex:1;min-width:0}
  .card-name{font-size:11px;font-family:monospace;color:#8A90A0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px}
  .card-meta{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
  .pill{font-size:10px;padding:2px 6px;border-radius:4px;background:#131620;color:#5A6080;font-family:monospace;border:1px solid #1E2028}
  .cat-pill{font-weight:600}
  .cat-photo{color:#4A9DFF;background:#0D1828;border-color:#1A2A40}
  .cat-logo{color:#B86AEE;background:#150D22;border-color:#251535}
  .cat-icon{color:#59D9B0;background:#081512;border-color:#102520}
  .cat-svg{color:#F5A623;background:#1A1100;border-color:#302000}
  .cat-background{color:#8A8AFF;background:#0D0D1E;border-color:#1A1A35}
  .cat-image{color:#9BA3B5;background:#131620;border-color:#1E2028}
  .cat-video{color:#FF5B5B;background:#1A0B0B;border-color:#301515}
  .cat-font{color:#60D060;background:#0A150A;border-color:#142514}

  .card-alt{font-size:10px;color:#4A5066;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
  .card-source{font-size:10px;font-family:monospace;color:#3A4055;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .card-actions{display:flex;gap:6px;padding:8px 12px;border-top:1px solid #0D0F14;background:#09090E}
  .btn-dl,.btn-copy{flex:1;padding:5px;border-radius:6px;font-size:11px;font-family:monospace;cursor:pointer;border:1px solid #1E2028;background:#131620;color:#7C818D;transition:all .15s;text-align:center;white-space:nowrap}
  .btn-dl:hover{background:#1A1D2A;color:#B6BCC9;border-color:#2A2F40}
  .btn-copy:hover{background:#1A1D2A;color:#B6BCC9;border-color:#2A2F40}
  .btn-copy.copied{color:#59D9B0;border-color:#102520}

  /* ── Empty ── */
  .empty{padding:40px;text-align:center;color:#3A4055;font-size:13px;grid-column:1/-1}

  /* ── Toast ── */
  .toast{position:fixed;bottom:24px;right:24px;background:#131620;border:1px solid #2A3050;border-radius:8px;padding:10px 16px;font-size:12px;color:#B6BCC9;display:none;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.5)}
  .toast.show{display:block}
</style>
</head>
<body>
<div class="layout">

<!-- TOPBAR -->
<header class="topbar">
  <div>
    <div class="logo">Heist Catalog <span>·</span> ${SLUG}</div>
    <div class="subtitle">Source : ${BASE_URL} · Capturé ${new Date().toLocaleDateString("fr-FR")}</div>
  </div>
  <div class="searchbox">
    <input type="search" id="search" placeholder="Filtrer par nom, alt, page…" autocomplete="off" />
  </div>
  <span class="stat-badge"><strong>${assets.length}</strong> assets</span>
  <span class="stat-badge"><strong>${pageStats.length}</strong> pages</span>
  <span class="stat-badge">${sortedCategories.length} catégories</span>
</header>

<!-- SIDEBAR -->
<nav class="sidebar">
  <div class="sidebar-section">Catégories</div>
  <div class="nav-item active" data-filter-cat="all">
    Tous
    <span class="count">${assets.length}</span>
  </div>
  ${sortedCategories.map((cat) => `
  <div class="nav-item" data-filter-cat="${cat}">
    ${CATEGORY_LABELS[cat] || cat}
    <span class="count">${byCategory[cat].length}</span>
  </div>`).join("")}

  <hr class="divider">
  <div class="sidebar-section">Pages (${pageStats.length})</div>
  <div class="page-list">
    <div class="page-item active" data-filter-page="all">
      Toutes les pages
    </div>
    ${pageStats.sort((a, b) => b.assets - a.assets).map((p) => `
    <div class="page-item" data-filter-page="${p.path}" title="${p.url}">
      <span style="overflow:hidden;text-overflow:ellipsis">${p.path || "/"}</span>
      <span class="pcnt">${p.assets}</span>
    </div>`).join("")}
  </div>
</nav>

<!-- MAIN -->
<main class="main" id="main">
${sortedCategories.map((cat) => `
<section class="cat-section" data-section="${cat}">
  <div class="section-header">
    <span class="section-title">${CATEGORY_LABELS[cat] || cat}</span>
    <span class="section-count">${byCategory[cat].length} assets</span>
  </div>
  <div class="grid">
    ${byCategory[cat].map(assetCard).join("\n    ")}
    <div class="empty" data-empty="${cat}" style="display:none">Aucun asset visible avec ce filtre.</div>
  </div>
</section>`).join("")}
</main>

</div>

<!-- TOAST -->
<div class="toast" id="toast">Copié !</div>

<script>
const state = { cat: "all", page: "all", search: "" };

function applyFilters() {
  const q = state.search.toLowerCase();
  let totalVisible = 0;

  document.querySelectorAll(".cat-section").forEach((section) => {
    const cat = section.dataset.section;
    const catOk = state.cat === "all" || state.cat === cat;
    if (!catOk) { section.style.display = "none"; return; }
    section.style.display = "";

    let visibleInSection = 0;
    section.querySelectorAll(".card").forEach((card) => {
      const pageOk = state.page === "all" || card.dataset.src === state.page;
      const nameOk = !q || card.dataset.name?.includes(q) || card.querySelector(".card-alt")?.textContent.toLowerCase().includes(q) || card.querySelector(".card-source")?.textContent.toLowerCase().includes(q);
      const show = pageOk && nameOk;
      card.dataset.hidden = show ? "false" : "true";
      if (show) { visibleInSection++; totalVisible++; }
    });

    const empty = section.querySelector("[data-empty]");
    if (empty) empty.style.display = visibleInSection === 0 ? "block" : "none";
  });
}

// Category filter
document.querySelectorAll("[data-filter-cat]").forEach((el) => {
  el.addEventListener("click", () => {
    state.cat = el.dataset.filterCat;
    document.querySelectorAll("[data-filter-cat]").forEach((e) => e.classList.toggle("active", e === el));
    applyFilters();
  });
});

// Page filter
document.querySelectorAll("[data-filter-page]").forEach((el) => {
  el.addEventListener("click", () => {
    state.page = el.dataset.filterPage;
    document.querySelectorAll("[data-filter-page]").forEach((e) => e.classList.toggle("active", e === el));
    applyFilters();
  });
});

// Search
document.getElementById("search").addEventListener("input", (e) => {
  state.search = e.target.value;
  applyFilters();
});

// Copy
document.querySelectorAll(".btn-copy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.dataset.url;
    navigator.clipboard.writeText(url).then(() => {
      btn.classList.add("copied");
      btn.textContent = "✓ copied";
      setTimeout(() => { btn.classList.remove("copied"); btn.textContent = "⌅ copy"; }, 1500);
    });
    const toast = document.getElementById("toast");
    toast.textContent = url;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  });
});
</script>
</body>
</html>`;

await fs.writeFile(`${META_DIR}/catalog.html`, catalog);
console.log(`\n🗂  Catalogue → ${META_DIR}/catalog.html`);

// ─── Résumé ───────────────────────────────────────────────────────────────────

const bycat = Object.entries(byCategory)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([cat, items]) => `    ${cat.padEnd(12)} ${items.length}`)
  .join("\n");

console.log(`
╔══════════════════════════════════════════╗
║  Heist Assets — résumé                  ║
╠══════════════════════════════════════════╣
║  Pages visitées : ${String(pageStats.length).padEnd(22)}║
║  Assets uniques : ${String(assets.length).padEnd(22)}║
╠══════════════════════════════════════════╣
${bycat.split("\n").map((l) => `║  ${l.padEnd(41)}║`).join("\n")}
╚══════════════════════════════════════════╝

  ✓ Fichiers → public/themes/${SLUG}/assets/
  ✓ Manifest → themes/${SLUG}/assets.json
  ✓ Seed SQL → themes/${SLUG}/seed.sql
  ✓ Catalogue → themes/${SLUG}/catalog.html
`);
