// Builds the offline Windows package and writes it to public/downloads/CourtVision-Windows.zip,
// which is where the in-app download button (top-right corner) points.
//
//   npm run package:windows      -> refresh the zip
//   npm run build                -> runs this automatically BEFORE the web build, so the zip that ships with
//                                   the site is always rebuilt from the current source (never a stale copy)
//
// Works on Windows, macOS and Linux: it uses only Node and the `fflate` package (no system zip tool).

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const desktopDist = join(root, 'dist-desktop');
const templateDir = join(root, 'windows');
const outFile = join(root, 'public', 'downloads', 'CourtVision-Windows.zip');
const PACKAGE_FOLDER = 'CourtVision';

// 1. Build the desktop variant of the app (relative asset paths, no "download for Windows" button).
console.log('Building the desktop variant...');
execSync('npx vite build --mode desktop', { cwd: root, stdio: 'inherit' });

// The desktop build must never contain an older copy of the zip it is about to be shipped in.
rmSync(join(desktopDist, 'downloads'), { recursive: true, force: true });

// 2. Collect files.
const TEXT_LAUNCHER_FILES = new Set(['Start CourtVision.bat', 'server.ps1', 'README.txt']);
const files = {};

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const zipPath = [PACKAGE_FOLDER, 'app', ...relative(desktopDist, full).split(sep)].join('/');
      files[zipPath] = new Uint8Array(readFileSync(full));
    }
  }
}
walk(desktopDist);

for (const name of TEXT_LAUNCHER_FILES) {
  const src = join(templateDir, name);
  if (!existsSync(src)) throw new Error(`Missing launcher file: ${src}`);
  // Windows batch files and PowerShell scripts are safest (and Notepad-friendly) with CRLF line endings.
  const text = readFileSync(src, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  files[`${PACKAGE_FOLDER}/${name}`] = new Uint8Array(Buffer.from(text, 'utf8'));
}

// 3. Zip it.
// A fixed timestamp keeps the zip byte-identical when nothing changed, so rebuilding on every deploy doesn't churn git.
const zipped = zipSync(files, { level: 9, mtime: new Date('2000-01-01T00:00:00Z') });
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, zipped);

console.log(`\nWrote ${relative(root, outFile)}  (${Object.keys(files).length} files, ${(zipped.length / 1024 / 1024).toFixed(2)} MB)`);
