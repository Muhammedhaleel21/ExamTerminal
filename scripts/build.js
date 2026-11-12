import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateManifest } from './generate-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'public', 'downloads');
const templatesDir = path.join(rootDir, 'templates');

function resolveBaseUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.URL) return process.env.URL.replace(/\/+$/, '');
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL.replace(/\/+$/, '');
  
  return 'https://YOURDOMAIN.com';
}

export function build() {
  console.log('[Build] Starting build process...');

  // Step 1: Scan and generate manifest.json
  const manifest = generateManifest();

  // Step 2: Determine deployment base URL
  const baseUrl = resolveBaseUrl();
  console.log(`[Build] Target Base URL configured as: ${baseUrl}`);

  // Step 3: Format embedded file arrays
  const shFiles = manifest.files
    .map(f => `  "${f.urlPath}|${f.relativePath}"`)
    .join('\n');

  const ps1Files = manifest.files
    .map(f => `    [PSCustomObject]@{ urlPath = '${f.urlPath}'; relativePath = '${f.relativePath.replace(/'/g, "''")}' }`)
    .join(',\n');

  // Step 4: Build download.sh
  const shTemplate = fs.readFileSync(path.join(templatesDir, 'download.sh'), 'utf-8');
  const compiledSh = shTemplate
    .replace('__BASE_URL__', baseUrl)
    .replace('__EMBEDDED_SH_FILES__', shFiles);

  const shOutPath = path.join(downloadsDir, 'download.sh');
  fs.writeFileSync(shOutPath, compiledSh, { encoding: 'utf-8', mode: 0o755 });
  console.log(`[Build] Generated: public/downloads/download.sh`);

  // Step 5: Build download.ps1
  const ps1Template = fs.readFileSync(path.join(templatesDir, 'download.ps1'), 'utf-8');
  const compiledPs1 = ps1Template
    .replace('__BASE_URL__', baseUrl)
    .replace('__EMBEDDED_PS1_FILES__', ps1Files);

  const ps1OutPath = path.join(downloadsDir, 'download.ps1');
  fs.writeFileSync(ps1OutPath, compiledPs1, { encoding: 'utf-8', mode: 0o755 });
  console.log(`[Build] Generated: public/downloads/download.ps1`);

  console.log('[Build] Build complete successfully!');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build();
}

