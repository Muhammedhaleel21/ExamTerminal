import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateManifest } from './generate-manifest.js';
import { build } from './build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const PORT = process.env.PORT || 3000;

// Ensure manifest and scripts are built
build();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.ps1': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const currentBaseUrl = `${protocol}://${host}`;

  const parsedUrl = new URL(req.url, currentBaseUrl);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Short endpoint: /get -> serves download.sh
  if (pathname === '/get') {
    const shPath = path.join(publicDir, 'downloads', 'download.sh');
    if (fs.existsSync(shPath)) {
      let content = fs.readFileSync(shPath, 'utf-8');
      content = content.replace(/DEFAULT_BASE_URL=".*?"/, `DEFAULT_BASE_URL="${currentBaseUrl}"`);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
      return;
    }
  }

  // Short endpoint: /get.ps1 -> serves download.ps1
  if (pathname === '/get.ps1') {
    const ps1Path = path.join(publicDir, 'downloads', 'download.ps1');
    if (fs.existsSync(ps1Path)) {
      let content = fs.readFileSync(ps1Path, 'utf-8');
      content = content.replace(/\$DefaultBaseUrl = ".*?"/, `$DefaultBaseUrl = "${currentBaseUrl}"`);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
      return;
    }
  }

  // Default to index.html for root
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(publicDir, pathname);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ExamTerminal File Server Running!`);
  console.log(`  Local UI:        http://localhost:${PORT}`);
  console.log(`  Short Linux/Mac: curl -fsSL http://localhost:${PORT}/get | bash`);
  console.log(`  Short Windows:   irm http://localhost:${PORT}/get.ps1 | iex`);
  console.log(`======================================================\n`);
});

