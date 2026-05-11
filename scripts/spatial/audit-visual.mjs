import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const SNAPSHOTS_DIR = path.join(ROOT, 'docs/spatial/snapshots');

// Config par défaut
const DEFAULT_CONFIG = {
  url: 'http://localhost:9001/spatial-rnd',
  threshold: 0.02, // 2%
  viewport: { width: 1440, height: 900 },
  waitMs: 3000
};

// Parsing des arguments CLI
const args = process.argv.slice(2);
const updateReference = args.includes('--update-reference');

function getArgValue(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < args.length) return args[index + 1];
  return null;
}

const urlArg = getArgValue('url');
const thresholdArg = getArgValue('threshold');

const config = {
  ...DEFAULT_CONFIG,
  url: urlArg || DEFAULT_CONFIG.url,
  threshold: thresholdArg ? parseFloat(thresholdArg) / 100 : DEFAULT_CONFIG.threshold
};

const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

async function runAudit() {
  console.log(`${ANSI.bold}${ANSI.blue}Demarrage de l'audit visuel Spatial...${ANSI.reset}`);
  console.log(`URL: ${config.url}`);
  console.log(`Seuil: ${(config.threshold * 100).toFixed(1)}%`);

  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: config.viewport
  });
  const page = await context.newPage();

  try {
    console.log(`Navigation vers ${config.url}...`);
    const response = await page.goto(config.url, { waitUntil: 'networkidle', timeout: 10000 });
    
    if (!response || response.status() !== 200) {
      console.error(`${ANSI.red}[ERREUR] La page ${config.url} est introuvable (Status: ${response?.status() || 'N/A'}).${ANSI.reset}`);
      console.error(`Assurez-vous que le serveur de développement est lancé (npm run dev).`);
      await browser.close();
      process.exit(1);
    }

    console.log(`Attente de ${config.waitMs}ms pour la stabilisation de la scene...`);
    await page.waitForTimeout(config.waitMs);

    const currentPath = path.join(SNAPSHOTS_DIR, 'current.png');
    const referencePath = path.join(SNAPSHOTS_DIR, 'reference.png');
    const diffPath = path.join(SNAPSHOTS_DIR, 'diff.png');

    await page.screenshot({ path: currentPath, fullPage: true });
    console.log(`Screenshot capture: docs/spatial/snapshots/current.png`);

    if (updateReference || !fs.existsSync(referencePath)) {
      fs.copyFileSync(currentPath, referencePath);
      console.log(`${ANSI.green}[OK] Reference ${updateReference ? 'mise a jour' : 'creee'}. Re-run pour comparer.${ANSI.reset}`);
      await browser.close();
      process.exit(0);
    }

    // Comparaison
    const img1 = PNG.sync.read(fs.readFileSync(referencePath));
    const img2 = PNG.sync.read(fs.readFileSync(currentPath));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const diffPercentage = (numDiffPixels / (width * height)) * 100;
    const isRegression = diffPercentage > (config.threshold * 100);

    if (numDiffPixels > 0) {
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      console.log(`Diff genere: docs/spatial/snapshots/diff.png`);
    }

    console.log(`\n${ANSI.bold}Resultat de la comparaison :${ANSI.reset}`);
    const color = isRegression ? ANSI.red : ANSI.green;
    console.log(`${color}${diffPercentage.toFixed(2)}% de pixels differents${ANSI.reset}`);

    if (isRegression) {
      console.log(`\n${ANSI.red}${ANSI.bold}[ERREUR] REGRESSION VISUELLE DETECTEE${ANSI.reset}`);
      console.log(`Le seuil de ${(config.threshold * 100).toFixed(1)}% a ete depasse.`);
      await browser.close();
      process.exit(1);
    } else {
      console.log(`\n${ANSI.green}${ANSI.bold}[OK] Audit visuel reussi !${ANSI.reset}`);
      await browser.close();
      process.exit(0);
    }

  } catch (error) {
    console.error(`${ANSI.red}[ERREUR] Une erreur est survenue pendant l'audit :${ANSI.reset}`);
    console.error(error.message);
    await browser.close();
    process.exit(1);
  }
}

runAudit();
