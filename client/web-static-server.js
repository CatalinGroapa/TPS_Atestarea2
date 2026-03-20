const http = require('http');
const fs = require('fs');
const path = require('path');

const base = __dirname;
const projectRoot = path.join(__dirname, '..');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const safe = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  // Assets are in the parent project root (../assets/...)
  let filePath = safe.startsWith('assets/')
    ? path.join(projectRoot, safe)
    : path.join(base, safe);

  if (!filePath.startsWith(projectRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(8080, '127.0.0.1', () => {
  console.log('Web static server running on http://localhost:8080');
});
