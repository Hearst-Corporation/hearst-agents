import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

const CONFIG = {
  paths: [
    'components/spatial',
    'hooks/spatial',
    'lib/spatial'
  ],
  extensions: ['.ts', '.tsx'],
  exclude_files: [
    'components/spatial/orbital/OrbitalRing.tsx',
    'components/spatial/orbital/OrbitalItem.tsx',
    'components/spatial/orbital/ActionRing.tsx',
    'components/spatial/core/SpatialLogoCore.tsx',
    'components/spatial/core/SpatialLogoInteraction.tsx',
    'components/spatial/core/SpatialRoot.tsx',
    'components/spatial/core/SpatialScene.tsx',
    'components/spatial/core/SpatialLayout.tsx'
  ]
};

const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

let errorCount = 0;
let warningCount = 0;

/**
 * Report a finding
 */
function report(file, line, message, severity = 'error') {
  const color = severity === 'error' ? ANSI.red : ANSI.yellow;
  const label = severity.toUpperCase();
  console.log(`${color}${ANSI.bold}[${label}]${ANSI.reset} ${ANSI.blue}${file}:${line}${ANSI.reset} - ${message}`);
  if (severity === 'error') errorCount++;
  else warningCount++;
}

/**
 * Check if a file is a type/constant only file
 */
function isTypeOrConstantFile(content) {
  const hasJSX = /<[a-z0-9]+|React\.createElement/.test(content);
  return !hasJSX;
}

/**
 * Lint a single file
 */
function lintFile(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Rule D: components/spatial/ must have "use client" or be types/constants
  if (relativePath.startsWith('components/spatial/') && !content.includes('"use client"') && !content.includes("'use client'")) {
    if (!isTypeOrConstantFile(content)) {
      report(relativePath, 1, 'Composant spatial doit avoir "use client"', 'error');
    }
  }

  // Rule E: No any (warning) or @ts-ignore (error)
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    
    if (line.includes(': any') || line.includes('<any>') || line.includes('as any')) {
      // Avoid false positives in comments if possible, but simple check for now
      if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        report(relativePath, lineNum, 'Usage de "any" détecté', 'warning');
      }
    }

    if (line.includes('@ts-ignore')) {
      report(relativePath, lineNum, 'Usage de "@ts-ignore" interdit', 'error');
    }

    // Rule B: intensity on lights
    // Match <AnyLight intensity={N} /> or intensity={N}
    const intensityMatch = line.match(/intensity=\{([\d.]+)\}/);
    if (intensityMatch) {
      const val = parseFloat(intensityMatch[1]);
      if (val < 0 || val > 10) {
        report(relativePath, lineNum, `Intensité lumineuse aberrante: ${val} (doit être entre 0 et 10)`, 'error');
      } else if (val < 0.05 || val > 5) {
        report(relativePath, lineNum, `Intensité lumineuse hors plage recommandée (0.05 - 5): ${val}`, 'warning');
      }
    }

    // Rule C: count={N} on particles
    const countMatch = line.match(/count=\{([\d.]+)\}/);
    if (countMatch) {
      const val = parseInt(countMatch[1]);
      if (val > 500) {
        report(relativePath, lineNum, `Nombre de particules trop élevé: ${val} (max 500)`, 'error');
      } else if (val > 200) {
        report(relativePath, lineNum, `Nombre de particules élevé: ${val} (recommandé max 200)`, 'warning');
      }
    }
  });

  // Rule F: useFrame requires useRef
  if (content.includes('useFrame')) {
    const hasUseRef = content.includes('useRef');
    const hasUseThree = content.includes('useThree');
    const hasObject3DProp = /:\s*(THREE\.)?Object3D|:\s*(THREE\.)?Mesh|:\s*(THREE\.)?Camera|:\s*(THREE\.)?Group/.test(content);
    const hasDOMAccess = /document\.getElementById|document\.querySelector/.test(content);
    
    if (!hasUseRef && !hasUseThree && !hasObject3DProp && !hasDOMAccess) {
      report(relativePath, 1, 'Usage de useFrame sans useRef détecté (risque de mutation directe)', 'warning');
    }
  }

  // Rule A: mesh, group, points, instancedMesh must have name
  // This is a bit complex for a regex, but we'll look for tags without name attribute
  const tags = ['mesh', 'group', 'points', 'instancedMesh'];
  tags.forEach(tag => {
    const regex = new RegExp(`<\\s*${tag}\\b(?![^>]*\\bname=)[^>]*>`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const offset = match.index;
      const lineNum = content.substring(0, offset).split('\n').length;
      
      const severity = tag === 'group' ? 'warning' : 'error';
      report(relativePath, lineNum, `<${tag}> sans attribut "name"`, severity);
    }
  });
}

/**
 * Recursive directory walk
 */
function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (CONFIG.extensions.includes(path.extname(file))) {
      const relativePath = path.relative(ROOT, fullPath);
      if (!CONFIG.exclude_files.includes(relativePath)) {
        lintFile(fullPath);
      }
    }
  }
}

console.log(`${ANSI.bold}${ANSI.blue}Demarrage du linter Spatial...${ANSI.reset}\n`);

CONFIG.paths.forEach(p => {
  const fullPath = path.join(ROOT, p);
  if (fs.existsSync(fullPath)) {
    walk(fullPath);
  }
});

console.log(`\n${ANSI.bold}Rapport final :${ANSI.reset}`);
if (errorCount > 0) {
  console.log(`${ANSI.red}[ERREUR] ${errorCount} erreurs${ANSI.reset}`);
} else {
  console.log(`${ANSI.green}[OK] 0 erreur${ANSI.reset}`);
}

if (warningCount > 0) {
  console.log(`${ANSI.yellow}[WARNING] ${warningCount} warnings${ANSI.reset}`);
} else {
  console.log(`${ANSI.green}[OK] 0 warning${ANSI.reset}`);
}

if (errorCount > 0) {
  process.exit(1);
} else {
  console.log(`\n${ANSI.green}${ANSI.bold}Spatial Lint termine avec succes !${ANSI.reset}`);
  process.exit(0);
}
