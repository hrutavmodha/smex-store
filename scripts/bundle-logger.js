#!/usr/bin/env node

/**
 * Smex Store - Next.js Production Bundle Size Logger
 *
 * Inspects client bundle assets emitted in .next/static/
 * Computes exact Raw and Gzip sizes and outputs a Vite-style terminal breakdown.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  const kb = bytes / k;
  if (kb < k) return `${kb.toFixed(2)} kB`;
  const mb = kb / k;
  return `${mb.toFixed(2)} MB`;
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content, { level: 9 }).length;
}

// Locate client/.next directory
function findNextStaticDir() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'client/.next/static'),
    path.resolve(process.cwd(), '.next/static'),
    path.resolve(__dirname, '../client/.next/static'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function collectFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      const rawSize = fs.statSync(fullPath).size;
      const gzSize = getGzipSize(fullPath);

      let type = 'other';
      if (ext === '.js' || ext === '.mjs') type = 'js';
      else if (ext === '.css') type = 'css';
      else if (['.woff', '.woff2', '.ttf', '.eot', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'].includes(ext)) {
        type = 'asset';
      }

      results.push({
        name: relPath,
        fullPath,
        rawSize,
        gzSize,
        type,
      });
    }
  }
  return results;
}

function logBundleReport() {
  const staticDir = findNextStaticDir();

  console.log(`\n${c.bold}${c.cyan}▲ Smex Store - Client Production Bundle Audit${c.reset}`);
  console.log(`${c.dim}─────────────────────────────────────────────────────────────────────────────${c.reset}`);

  if (!staticDir) {
    console.error(
      `${c.red}❌ Error: Could not locate .next/static directory.${c.reset}\n` +
      `   Please run ${c.yellow}pnpm --filter client build${c.reset} first before running bundle logger.\n`
    );
    process.exit(1);
  }

  const clientDir = path.dirname(staticDir);
  console.log(`${c.dim}Source:${c.reset} ${path.relative(process.cwd(), staticDir) || './'}`);

  const allFiles = collectFiles(staticDir);

  if (allFiles.length === 0) {
    console.log(`${c.yellow}No emitted static chunks found in ${staticDir}${c.reset}`);
    return;
  }

  // Filter JS and CSS files for the main breakdown
  const jsFiles = allFiles.filter((f) => f.type === 'js');
  const cssFiles = allFiles.filter((f) => f.type === 'css');
  const assetFiles = allFiles.filter((f) => f.type === 'asset');

  // Sort files by gzipped size descending
  const sortedFiles = [...allFiles].sort((a, b) => b.gzSize - a.gzSize);

  console.log(`\n${c.bold}Asset Chunks (Sorted by Gzip Size):${c.reset}`);
  console.log(
    `${c.dim}${'ASSET'.padEnd(46)} ${'RAW SIZE'.padStart(12)}  ${'GZIP SIZE'.padStart(12)}${c.reset}`
  );
  console.log(`${c.dim}─`.repeat(74) + `${c.reset}`);

  const showAll = process.argv.includes('--all') || process.argv.includes('-a');
  const displayLimit = showAll ? sortedFiles.length : 18;
  const displayedFiles = sortedFiles.slice(0, displayLimit);

  for (const f of displayedFiles) {
    let color = c.cyan;
    if (f.type === 'css') color = c.magenta;
    else if (f.type === 'asset') color = c.yellow;

    const shortName = f.name.length > 44 ? '...' + f.name.slice(-41) : f.name;
    const rawFormatted = formatBytes(f.rawSize).padStart(12);
    const gzFormatted = formatBytes(f.gzSize).padStart(12);

    console.log(`${color}${shortName.padEnd(46)}${c.reset} ${c.dim}${rawFormatted}${c.reset}  ${c.green}${c.bold}${gzFormatted}${c.reset}`);
  }

  if (sortedFiles.length > displayLimit) {
    console.log(
      `${c.dim}... and ${sortedFiles.length - displayLimit} more chunks. Pass ${c.yellow}--all${c.dim} to display everything.${c.reset}`
    );
  }

  // Summary Metrics
  const sumRaw = (list) => list.reduce((acc, f) => acc + f.rawSize, 0);
  const sumGz = (list) => list.reduce((acc, f) => acc + f.gzSize, 0);

  const totalJsRaw = sumRaw(jsFiles);
  const totalJsGz = sumGz(jsFiles);

  const totalCssRaw = sumRaw(cssFiles);
  const totalCssGz = sumGz(cssFiles);

  const totalAssetRaw = sumRaw(assetFiles);
  const totalAssetGz = sumGz(assetFiles);

  const totalAllRaw = sumRaw(allFiles);
  const totalAllGz = sumGz(allFiles);

  console.log(`\n${c.bold}Bundle Size Summary:${c.reset}`);
  console.log(`${c.dim}─────────────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(
    `  ${c.cyan}● JavaScript:${c.reset}  ${formatBytes(totalJsRaw).padStart(10)} raw  │  ${c.green}${formatBytes(totalJsGz).padStart(9)} gzip${c.reset}  (${jsFiles.length} files)`
  );
  console.log(
    `  ${c.magenta}● Stylesheets:${c.reset} ${formatBytes(totalCssRaw).padStart(10)} raw  │  ${c.green}${formatBytes(totalCssGz).padStart(9)} gzip${c.reset}  (${cssFiles.length} files)`
  );
  if (assetFiles.length > 0) {
    console.log(
      `  ${c.yellow}● Media/Fonts:${c.reset} ${formatBytes(totalAssetRaw).padStart(10)} raw  │  ${c.green}${formatBytes(totalAssetGz).padStart(9)} gzip${c.reset}  (${assetFiles.length} files)`
    );
  }
  console.log(`${c.dim}─────────────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(
    `  ${c.bold}Total Static:${c.reset}  ${formatBytes(totalAllRaw).padStart(10)} raw  │  ${c.green}${c.bold}${formatBytes(totalAllGz).padStart(9)} gzip${c.reset}  (${allFiles.length} total assets)`
  );
  console.log('');
}

logBundleReport();
