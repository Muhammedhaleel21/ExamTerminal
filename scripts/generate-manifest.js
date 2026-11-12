import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'public', 'downloads');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function generateManifest() {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const allTxtFiles = [];

  function scanDir(currentDir, relativeBase = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (entry.isFile()) {
        // Only include .txt files; explicitly exclude scripts and manifest
        if (entry.name.toLowerCase().endsWith('.txt')) {
          const stats = fs.statSync(fullPath);
          const parts = relPath.split('/');
          const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';

          // Correct URL encoding preserving path slashes and spaces as %20
          const urlPath = parts.map(encodeURIComponent).join('/');

          allTxtFiles.push({
            name: entry.name,
            folder,
            relativePath: relPath,
            urlPath,
            size: stats.size,
            formattedSize: formatBytes(stats.size),
            lastModified: stats.mtime.toISOString(),
          });
        }
      }
    }
  }

  scanDir(downloadsDir);

  // Group by folders
  const folderMap = new Map();
  for (const file of allTxtFiles) {
    if (!folderMap.has(file.folder)) {
      folderMap.set(file.folder, []);
    }
    folderMap.get(file.folder).push(file);
  }

  const folders = Array.from(folderMap.entries())
    .map(([folderName, files]) => ({
      name: folderName,
      count: files.length,
      files: files.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalFiles: allTxtFiles.length,
    totalFolders: folders.length,
    folders,
    files: allTxtFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
  };

  const manifestPath = path.join(downloadsDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[Manifest] Successfully generated manifest.json:`);
  console.log(` - Total folders: ${manifest.totalFolders}`);
  console.log(` - Total TXT files: ${manifest.totalFiles}`);
  folders.forEach(f => {
    console.log(`   * ${f.name} (${f.count} files)`);
  });

  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateManifest();
}

