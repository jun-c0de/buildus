/**
 * relabel.cjs — OCR 텍스트 위치 기반 폴리곤 카테고리 재지정
 *
 * 전략:
 *   1. auto-label.cjs 가 추가한 사각형 폴리곤(room_name 필드 있음) 제거
 *   2. Google Vision OCR 로 텍스트 위치 감지
 *   3. 각 텍스트 중심점이 어느 SAM2 폴리곤 안에 있는지 계산
 *   4. 해당 폴리곤의 category 를 OCR 결과로 재지정
 *
 * 실행: GOOGLE_VISION_KEY=AIza... node scripts/relabel.cjs [단지명] [--dry-run]
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY = process.env.GOOGLE_VISION_KEY;
const BASE    = path.join(__dirname, '..', 'public', 'floorplans');

// 구조/배경 카테고리는 절대 변경 안 함
const SKIP_CATS = new Set(['background', '구조_벽체', '구조_창호', '구조_출입문']);

// auto-label.cjs 가 만든 직사각형인지 판별
// 조건: 8좌표 + 축-정렬 사각형 (x1=x4, y1=y2, x2=x3, y3=y4)
function isAutoLabelRect(ann) {
  const seg = ann.segmentation?.[0];
  if (!seg || seg.length !== 8) return false;
  const [x1,y1, x2,y2, x3,y3, x4,y4] = seg;
  return x1 === x4 && y1 === y2 && x2 === x3 && y3 === y4;
}

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

function textToCat(text) {
  const t = text.replace(/\s+/g, '');
  for (const { kw, cat } of ROOM_RULES) {
    if (kw.some(k => t.includes(k.replace(/\s+/g, '')))) return cat;
  }
  return null;
}

// ── Google Vision API ─────────────────────────────────────────────
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

function avgY(verts) {
  return verts.reduce((s, v) => s + (v.y || 0), 0) / verts.length;
}

// ── OCR 에서 방 텍스트 + 중심점 추출 ─────────────────────────────
async function detectRooms(imgPath) {
  const base64 = fs.readFileSync(imgPath).toString('base64');
  const result = await visionRequest(base64);
  const resp = result.responses?.[0];
  if (resp?.error) throw new Error(resp.error.message);

  const annotations = resp?.textAnnotations || [];
  if (annotations.length === 0) return [];

  const words = annotations.slice(1);
  const found = [];
  const used  = new Set();

  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const w = words[i];
    if (!/[가-힣]/.test(w.description)) continue;

    const vy  = avgY(w.boundingPoly.vertices);
    const vx1 = Math.max(...w.boundingPoly.vertices.map(v => v.x || 0));

    let merged   = w.description;
    let allVerts = [...w.boundingPoly.vertices];
    let prevX1   = vx1;

    for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
      if (used.has(j)) continue;
      const w2  = words[j];
      const vx0 = Math.min(...w2.boundingPoly.vertices.map(v => v.x || 0));
      if (!/[가-힣및]/.test(w2.description)) break;
      if (Math.abs(avgY(w2.boundingPoly.vertices) - vy) > 15) break;
      if (vx0 < prevX1 - 5) break;
      if (vx0 - prevX1 > 50) break;
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
    const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);

    found.push({ text: merged, cat, cx, cy });
  }
  return found;
}

// ── 점이 폴리곤 안에 있는지 (ray casting) ────────────────────────
function pointInPolygon(px, py, flatSeg) {
  const pts = [];
  for (let i = 0; i < flatSeg.length; i += 2) pts.push([flatSeg[i], flatSeg[i+1]]);
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── 폴리곤 bbox 와 점의 거리 (fallback 용) ───────────────────────
function distToBbox(px, py, ann) {
  const [bx, by, bw, bh] = ann.bbox;
  const cx = bx + bw / 2, cy = by + bh / 2;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// ── spa.json 재지정 ───────────────────────────────────────────────
function applyRelabel(spaPath, ocrRooms, dryRun) {
  const spa      = JSON.parse(fs.readFileSync(spaPath, 'utf8'));
  const catByName = Object.fromEntries(spa.categories.map(c => [c.name, c.id]));
  const catById   = Object.fromEntries(spa.categories.map(c => [c.id,   c.name]));
  let maxCatId    = Math.max(...spa.categories.map(c => c.id));
  const log       = [];
  let changes     = 0;

  function ensureCat(name) {
    if (!catByName[name]) {
      maxCatId++;
      spa.categories.push({ id: maxCatId, name });
      catByName[name] = maxCatId;
      catById[maxCatId] = name;
    }
    return catByName[name];
  }

  // ① auto-label 이 추가한 직사각형 폴리곤만 제거
  const before = spa.annotations.length;
  spa.annotations = spa.annotations.filter(a => !isAutoLabelRect(a));
  const removed = before - spa.annotations.length;
  if (removed > 0) log.push(`  이전 OCR 사각형 ${removed}개 제거`);

  // ② 재지정 대상 어노테이션 (구조/배경 제외)
  const targets = spa.annotations.filter(a => !SKIP_CATS.has(catById[a.category_id]));
  const usedIds = new Set(); // 한 폴리곤은 한 번만 매칭

  for (const room of ocrRooms) {
    const { text, cat, cx, cy } = room;

    // 텍스트 중심점을 포함하는 폴리곤 찾기 (미사용 폴리곤만)
    let hit = targets.find(a =>
      !usedIds.has(a.id) && a.segmentation?.[0] && pointInPolygon(cx, cy, a.segmentation[0])
    );

    // point-in-polygon 만 사용 (fallback 제거 — 오탐 방지)

    if (!hit) {
      log.push(`  미매칭: "${text}" (${cat}) — 포함 폴리곤 없음`);
      continue;
    }

    usedIds.add(hit.id); // 사용된 폴리곤 기록

    const oldCat = catById[hit.category_id];
    if (oldCat === cat) {
      log.push(`  유지: ann#${hit.id} ${cat}  ("${text}")`);
      continue;
    }

    // ── 오탐 방지: 주요 공간끼리 교체는 막음 ────────────────────
    // 거실/침실/주방은 이미 올바르게 분류됐을 가능성이 높음
    // 허용: 화장실↔욕실, 발코니→주방/거실, 기타→*, 현관→실외기실 등
    const PRIMARY = new Set(['공간_거실', '공간_침실', '공간_주방']);
    if (PRIMARY.has(oldCat) && PRIMARY.has(cat) && oldCat !== cat) {
      log.push(`  스킵(주요공간보호): ann#${hit.id} ${oldCat} → ${cat}  ("${text}")`);
      continue;
    }

    log.push(`  재지정: ann#${hit.id} ${oldCat} → ${cat}  ("${text}")`);
    if (!dryRun) {
      hit.category_id = ensureCat(cat);
    }
    changes++;
  }

  if (!dryRun && (changes > 0 || removed > 0)) {
    fs.writeFileSync(spaPath, JSON.stringify(spa, null, 2));
  }
  return { changes, removed, log };
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filter = args.find(a => !a.startsWith('--'));

  if (!API_KEY) {
    console.error('GOOGLE_VISION_KEY 환경변수가 없습니다.');
    process.exit(1);
  }
  if (dryRun) console.log('🔍 DRY RUN (파일 수정 없음)\n');

  const complexes = fs.readdirSync(BASE).filter(cx => !filter || cx === filter);
  let done = 0, skip = 0, err = 0;

  for (const cx of complexes) {
    const dir      = path.join(BASE, cx);
    const spaFiles = fs.readdirSync(dir).filter(f => f.endsWith('_spa.json'));

    for (const spaFile of spaFiles) {
      const spaPath = path.join(dir, spaFile);
      // jpg 우선, 없으면 jpeg
      let imgPath = path.join(dir, spaFile.replace('_spa.json', '.jpg'));
      if (!fs.existsSync(imgPath)) {
        imgPath = path.join(dir, spaFile.replace('_spa.json', '.jpeg'));
      }
      if (!fs.existsSync(imgPath)) { skip++; continue; }

      process.stdout.write(`🔍 ${cx}/${spaFile} ... `);
      try {
        const ocrRooms = await detectRooms(imgPath);
        const found    = ocrRooms.map(r => `"${r.text}"`).join(', ');
        process.stdout.write(`OCR:[${found || '없음'}]\n`);

        const { changes, removed, log } = applyRelabel(spaPath, ocrRooms, dryRun);
        console.log(`  → 재지정 ${changes}개 / OCR박스 제거 ${removed}개`);
        log.forEach(l => console.log(l));
        done++;
      } catch(e) {
        console.log(`❌ ${e.message.slice(0, 120)}`);
        err++;
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n완료: 처리 ${done}개, 스킵 ${skip}개, 오류 ${err}개`);
}

main().catch(e => { console.error(e); process.exit(1); });
