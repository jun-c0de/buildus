// 저장 서버 (포트 3001) - spa.json / str.json 파일 저장용
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = 3002;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { path: filePath, data } = JSON.parse(body);
        const abs = path.resolve(PUBLIC, filePath);
        if (!abs.startsWith(PUBLIC)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, JSON.stringify(data, null, 2), 'utf-8');
        console.log('저장됨:', abs);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('저장 서버 실행 중: http://localhost:' + PORT);
});
