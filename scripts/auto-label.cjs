/**
 * auto-label.cjs  —  Google Cloud Vision API 기반 평면도 자동 라벨링
 * 실행: GOOGLE_VISION_KEY=AIza... node scripts/auto-label.cjs [단지명] [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY = process.env.GOOGLE_VISION_KEY;
const BASE    = path.join(__dirname, '..', 'public', 'floorplans');

// ── 방 이름 키워드 → 카테고리 ─────────────────────────────────────
const ROOM_RULES = [
  { kw: ['주방및식당','주방 및 식당','주방','식당','부엌'], cat: '공간_주방' },
  { kw: ['거실'],                                           cat: '공간_거실' },
  { kw: ['침실','안방'],                                    cat: '공간_침실' },
  { kw: ['화장실'],                                         cat: '공간_화장실' },
  { kw: ['욕실'],                                           cat: '공간_욕실' },
  { kw: ['현관'],                                           cat: '공간_현관' },
  { kw: ['발코니','베란다'],                                cat: '공간_발코니' },
  { kw: ['드레스룸'],                                       cat: '공간_드레스룸' },
  { kw: ['다목적공간','다목적'],                            cat: '공간_다목적공간' },
  { kw: ['실외기실','실외기'],                              cat: '공간_실외기실' },
];

const VALID_CATS = new Set(ROOM_RULES.map(r => r.cat));

function textToCat(text) {
  const t = text.replace(/\s+/g, '');
  for (const { kw, cat } of ROOM_RULES) {
    if (kw.some(k => t.includes(k.replace(/\s+/g, '')))) return cat;
  }
  return null;
}

// ── Google Vision API 호출 ────────────────────────────────────────
function visionRequest(base64) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    });

    const req = https.request({
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON 파싱 실패: ' + data.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── 이미지에서 방 이름 위치 추출 ─────────────────────────────────
async function detectRooms(imgPath) {
  const base64 = fs.readFileSync(imgPath).toString('base64');
  const result = await visionRequest(base64);

  const resp = result.responses?.[0];
  if (resp?.error) throw new Error(resp.error.message);

  const annotations = resp?.textAnnotations || [];
  if (annotations.length === 0) return [];

  // 첫 번째 항목은 전체 텍스트 → 개별 단어는 [1:]
  const words = annotations.slice(1);
  const found = [];
  const used  = new Set();

  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const w = words[i];
    if (!/[가-힣]/.test(w.description)) continue;

    const vy  = avgY(w.boundingPoly.vertices);
    const vx1 = Math.max(...w.boundingPoly.vertices.map(v => v.x || 0));

    // "주방 및 식당" 처럼 가까운 단어끼리만 합치기
    // 조건: ① y좌표 15px 이내 ② x 간격 60px 이내 ③ 최대 4단어
    let merged   = w.description;
    let allVerts = [...w.boundingPoly.vertices];
    let prevX1   = vx1;

    for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
      if (used.has(j)) continue;
      const w2  = words[j];
      const vx0 = Math.min(...w2.boundingPoly.vertices.map(v => v.x || 0));
      if (!/[가-힣및]/.test(w2.description)) break;
      if (Math.abs(avgY(w2.boundingPoly.vertices) - vy) > 15) break;
      if (vx0 < prevX1 - 5) break;           // 오른쪽 방향이어야 함 (역방향 병합 방지)
      if (vx0 - prevX1 > 50) break;          // 간격이 너무 크면 중단
      merged   = merged + w2.description;
      allVerts = [...allVerts, ...w2.boundingPoly.vertices];
      prevX1   = Math.max(...w2.boundingPoly.vertices.map(v => v.x || 0));
      used.add(j);
    }
    used.add(i);

    const cat = textToCat(merged);
    if (!cat) continue;

    const xs = allVerts.map(v => v.x || 0);
    const ys = allVerts.map(v => v.y || 0);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const x1 = Math.max(...xs), y1 = Math.max(...ys);

    // 이미 같은 카테고리가 거의 같은 위치에 추가됐으면 스킵
    const cx = Math.round((x0+x1)/2), cy = Math.round((y0+y1)/2);
    if (found.some(f => f.cat === cat && dist(f.cx, f.cy, cx, cy) < 80)) continue;

    found.push({ text: merged, cat, cx, cy, bbox: { x0, y0, x1, y1 } });
  }

  return found;
}

function avgY(verts) {
  return verts.reduce((s, v) => s + (v.y || 0), 0) / verts.length;
}

// ── 폴리곤 중심 ───────────────────────────────────────────────────
function centroid(ann) {
  const seg = ann.segmentation[0];
  const pts = [];
  for (let i = 0; i < seg.length; i += 2) pts.push([seg[i], seg[i+1]]);
  return {
    cx: Math.round(pts.reduce((s,p) => s+p[0], 0) / pts.length),
    cy: Math.round(pts.reduce((s,p) => s+p[1], 0) / pts.length),
  };
}

function dist(ax, ay, bx, by) {
  return Math.sqrt((ax-bx)**2 + (ay-by)**2);
}

// ── spa.json 업데이트 ─────────────────────────────────────────────
function applySpaUpdate(spaPath, ocrRooms, dryRun) {
  const spa        = JSON.parse(fs.readFileSync(spaPath, 'utf8'));
  const { width:W, height:H } = spa.images[0];
  const catsByName = Object.fromEntries(spa.categories.map(c => [c.name, c.id]));
  const catsById   = Object.fromEntries(spa.categories.map(c => [c.id,   c.name]));
  let maxCatId = Math.max(...spa.categories.map(c => c.id));
  let maxAnnId = Math.max(...spa.annotations.map(a => a.id));
  let changes  = 0;
  const log    = [];

  function ensureCat(name) {
    if (!catsByName[name]) {
      maxCatId++;
      spa.categories.push({ id: maxCatId, name });
      catsByName[name] = maxCatId;
      catsById[maxCatId] = name;
    }
    return catsByName[name];
  }

  // 현재 spa.json에 존재하는 카테고리 목록
  const existingCats = new Set(
    spa.annotations.map(a => catsById[a.category_id])
  );

  // ── 없는 카테고리만 추가 (기존 폴리곤 일절 수정 안 함) ──────────
  for (const room of ocrRooms) {
    // 이미 이 카테고리가 존재하면 스킵
    if (existingCats.has(room.cat)) continue;

    // 텍스트 bbox를 방 크기로 확장해 폴리곤 생성
    const { x0, y0, x1, y1 } = room.bbox;
    const tw = x1 - x0, th = y1 - y0;
    const pad = Math.max(tw, th) * 1.5;
    const nx1 = Math.max(0, Math.round(x0 - pad));
    const ny1 = Math.max(0, Math.round(y0 - pad));
    const nx2 = Math.min(W, Math.round(x1 + pad));
    const ny2 = Math.min(H, Math.round(y1 + pad * 2.0));
    if ((nx2-nx1) < 30 || (ny2-ny1) < 30) continue;

    log.push(`  추가: ${room.cat} "${room.text}" [${nx1},${ny1} ~ ${nx2},${ny2}]`);
    if (!dryRun) {
      maxAnnId++;
      const areaM2 = parseFloat(((nx2-nx1)*(ny2-ny1)/10000).toFixed(1));
      spa.annotations.push({
        id: maxAnnId,
        category_id: ensureCat(room.cat),
        image_id: spa.images[0].id,
        segmentation: [[nx1,ny1, nx2,ny1, nx2,ny2, nx1,ny2]],
        area: (nx2-nx1)*(ny2-ny1),
        bbox: [nx1, ny1, nx2-nx1, ny2-ny1],
        iscrowd: 0,
        room_name: room.text,
        area_m2: areaM2,
      });
    }
    // 다음 루프에서 중복 추가 방지
    existingCats.add(room.cat);
    changes++;
  }

  if (!dryRun && changes > 0) fs.writeFileSync(spaPath, JSON.stringify(spa, null, 2));
  return { changes, log };
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filter = args.find(a => !a.startsWith('--'));

  if (!API_KEY) {
    console.error('GOOGLE_VISION_KEY 환경변수가 없습니다.');
    console.error('실행: GOOGLE_VISION_KEY=AIza... node scripts/auto-label.cjs');
    process.exit(1);
  }
  if (dryRun) console.log('🔍 DRY RUN (파일 수정 없음)\n');

  const complexes = fs.readdirSync(BASE).filter(cx => !filter || cx === filter);
  let done=0, skip=0, err=0;

  for (const cx of complexes) {
    const dir      = path.join(BASE, cx);
    const spaFiles = fs.readdirSync(dir).filter(f => f.endsWith('_spa.json'));

    for (const spaFile of spaFiles) {
      const spaPath = path.join(dir, spaFile);
      const imgPath = path.join(dir, spaFile.replace('_spa.json', '.jpg'));

      if (!fs.existsSync(imgPath)) { skip++; continue; }

      // 이미 주방 있으면 스킵
      const spa  = JSON.parse(fs.readFileSync(spaPath, 'utf8'));
      const cats = Object.fromEntries(spa.categories.map(c => [c.id, c.name]));
      if (spa.annotations.some(a => cats[a.category_id] === '공간_주방')) {
        console.log(`⏭  ${cx}/${spaFile}`);
        skip++; continue;
      }

      process.stdout.write(`🔍 ${cx}/${spaFile} ... `);
      try {
        const ocrRooms = await detectRooms(imgPath);
        const found    = ocrRooms.map(r => `"${r.text}"`).join(', ');
        process.stdout.write(`OCR:[${found || '없음'}] `);

        const { changes, log } = applySpaUpdate(spaPath, ocrRooms, dryRun);
        console.log(`→ ${changes}개 변경`);
        log.forEach(l => console.log(l));
        done++;
      } catch(e) {
        console.log(`❌ ${e.message.slice(0, 100)}`);
        err++;
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n완료: 처리 ${done}개, 스킵 ${skip}개, 오류 ${err}개`);
}

main().catch(e => { console.error(e); process.exit(1); });
