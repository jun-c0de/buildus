/**
 * 로컬 라벨 저장 서버
 * 실행: node save-server.js
 * 포트: 3001
 */
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PORT          = 3001;
const FLOORPLAN_DIR = path.join(__dirname, 'public', 'floorplans');

const CATEGORY_MAP = {
  '거실':       { id: 1,  catName: '공간_거실' },
  '침실':       { id: 2,  catName: '공간_침실' },
  '화장실':     { id: 3,  catName: '공간_화장실' },
  '발코니':     { id: 4,  catName: '공간_발코니' },
  '주방':       { id: 5,  catName: '공간_주방' },
  '현관':       { id: 6,  catName: '공간_현관' },
  '드레스룸':   { id: 7,  catName: '공간_드레스룸' },
  '다목적공간': { id: 8,  catName: '공간_다목적공간' },
  '욕실':       { id: 13, catName: '공간_욕실' },
  '실외기실':   { id: 14, catName: '공간_실외기실' },
  '기타':       { id: 15, catName: '공간_기타' },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end',  () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // POST /save-corrections
  if (req.method === 'POST' && req.url === '/save-corrections') {
    try {
      const payload = await readBody(req);
      const { complex, stem, imageFile, corrections = [], deletions = [], additions = [], structAdditions = [] } = payload;
      if (!complex || !stem) {
        return send(res, 400, { error: 'complex, stem required' });
      }
      if (!corrections.length && !deletions.length && !additions.length && !structAdditions.length) {
        return send(res, 400, { error: '변경사항이 없습니다' });
      }

      const dir      = path.join(FLOORPLAN_DIR, complex);
      const corrFile = path.join(dir, `${stem}_corrections.json`);
      fs.writeFileSync(corrFile, JSON.stringify(
        { complex, stem, imageFile, savedAt: new Date().toISOString(), corrections, structAdditions },
        null, 2
      ), 'utf-8');
      console.log(`[저장] ${corrFile}  (${corrections.length}건)`);

      // spa.json 즉시 패치
      const spaFile = path.join(dir, `${stem}_spa.json`);
      if (fs.existsSync(spaFile)) {
        const spa = JSON.parse(fs.readFileSync(spaFile, 'utf-8'));
        // corrections, deletions, additions already destructured above

        // 1. 타입 수정
        for (const corr of corrections) {
          const ann = spa.annotations.find(a => a.id === corr.annId);
          if (ann) {
            ann.room_name   = corr.newName;
            ann.category_id = CATEGORY_MAP[corr.newName]?.id ?? ann.category_id;
          }
        }

        // 2. 삭제
        if (deletions.length) {
          const delSet = new Set(deletions);
          spa.annotations = spa.annotations.filter(a => !delSet.has(a.id));
        }

        // 카테고리가 없으면 spa.json categories에 추가
        function ensureCategory(spa, catId, catName) {
          if (!spa.categories.find(c => c.id === catId)) {
            spa.categories.push({ id: catId, name: catName });
          }
        }

        // 3. 신규 추가
        let nextId = spa.annotations.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        for (const add of additions) {
          const mapped = CATEGORY_MAP[add.newName];
          const catId = mapped?.id ?? 15;
          if (mapped) ensureCategory(spa, catId, mapped.catName);

          const poly = add.poly; // [[x,y], ...]
          const flat = poly.flatMap(p => p);
          const cx   = poly.reduce((s, p) => s + p[0], 0) / poly.length;
          const cy   = poly.reduce((s, p) => s + p[1], 0) / poly.length;
          // shoelace area
          let area = 0;
          for (let i = 0; i < poly.length; i++) {
            const [x1,y1] = poly[i], [x2,y2] = poly[(i+1)%poly.length];
            area += x1*y2 - x2*y1;
          }
          area = Math.abs(area) / 2;
          spa.annotations.push({
            id:           nextId++,
            category_id:  catId,
            image_id:     1,
            segmentation: [flat],
            area:         Math.round(area),
            area_m2:      null,
            room_name:    add.newName,
            bbox:         [Math.min(...poly.map(p=>p[0])), Math.min(...poly.map(p=>p[1])),
                           Math.max(...poly.map(p=>p[0])) - Math.min(...poly.map(p=>p[0])),
                           Math.max(...poly.map(p=>p[1])) - Math.min(...poly.map(p=>p[1]))],
            iscrowd:      0,
          });
        }

        fs.writeFileSync(spaFile, JSON.stringify(spa, null, 2), 'utf-8');
        console.log(`[패치] ${spaFile}  수정:${corrections.length} 삭제:${deletions.length} 추가:${additions.length}`);
      }

      // str.json 패치: 구조 요소(문/창문) 추가
      if (structAdditions.length) {
        const strFile = path.join(dir, `${stem}_str.json`);
        if (fs.existsSync(strFile)) {
          const str = JSON.parse(fs.readFileSync(strFile, 'utf-8'));
          // 카테고리명 → ID 맵
          const catIdMap = {};
          str.categories.forEach(c => (catIdMap[c.name] = c.id));

          let nextId = str.annotations.reduce((m, a) => Math.max(m, a.id), 0) + 1;
          for (const add of structAdditions) {
            const catId = catIdMap[add.catName];
            if (!catId) continue;
            const poly = add.poly;
            const flat = poly.flatMap(p => p);
            let area = 0;
            for (let i = 0; i < poly.length; i++) {
              const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
              area += x1 * y2 - x2 * y1;
            }
            str.annotations.push({
              id:           nextId++,
              category_id:  catId,
              image_id:     1,
              segmentation: [flat],
              area:         Math.round(Math.abs(area) / 2),
              bbox: [
                Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])),
                Math.max(...poly.map(p => p[0])) - Math.min(...poly.map(p => p[0])),
                Math.max(...poly.map(p => p[1])) - Math.min(...poly.map(p => p[1])),
              ],
              iscrowd: 0,
            });
          }
          fs.writeFileSync(strFile, JSON.stringify(str, null, 2), 'utf-8');
          console.log(`[패치] ${strFile}  구조요소 추가:${structAdditions.length}`);
        }
      }

      send(res, 200, { ok: true });
    } catch (e) {
      console.error(e);
      send(res, 500, { error: String(e) });
    }
    return;
  }

  // POST /apply-all  — 모든 corrections를 spa.json에 일괄 적용
  if (req.method === 'POST' && req.url === '/apply-all') {
    const results = [];
    const dirs = fs.readdirSync(FLOORPLAN_DIR)
      .filter(d => fs.statSync(path.join(FLOORPLAN_DIR, d)).isDirectory());

    for (const complex of dirs) {
      const dir = path.join(FLOORPLAN_DIR, complex);
      for (const cf of fs.readdirSync(dir).filter(f => f.endsWith('_corrections.json'))) {
        const stem    = cf.replace('_corrections.json', '');
        const corrData = JSON.parse(fs.readFileSync(path.join(dir, cf), 'utf-8'));
        const spaFile  = path.join(dir, `${stem}_spa.json`);
        if (!fs.existsSync(spaFile)) continue;
        const spa = JSON.parse(fs.readFileSync(spaFile, 'utf-8'));
        let patched = 0;
        for (const corr of corrData.corrections) {
          const ann = spa.annotations.find(a => a.id === corr.annId);
          if (ann) {
            ann.room_name   = corr.newName;
            ann.category_id = CATEGORY_MAP[corr.newName]?.id ?? ann.category_id;
            patched++;
          }
        }
        fs.writeFileSync(spaFile, JSON.stringify(spa, null, 2), 'utf-8');
        results.push({ complex, stem, patched });
        console.log(`[일괄패치] ${complex}/${stem}  ${patched}건`);
      }
    }
    return send(res, 200, { ok: true, results });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`\n라벨 저장 서버: http://localhost:${PORT}`);
  console.log(`도면 경로: ${FLOORPLAN_DIR}\n`);
  console.log('POST /save-corrections  — 수정사항 저장 + spa.json 패치');
  console.log('POST /apply-all         — 모든 corrections 일괄 적용\n');
});
