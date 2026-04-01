/**
 * auto_skeleton.js
 * spa.json 방 폴리곤 + str.json 문 직사각형 → structure_skeleton 자동 생성
 * 사용: node scripts/auto_skeleton.js CentralIpark 169
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const SNAP   = 14;   // 노드 스냅 거리 (px) — 벽 두께 ~10px
const MIN_LEN = 12;  // 너무 짧은 엣지 무시 (px)

// ── 좌표 헬퍼 ──────────────────────────────────────────────────────
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midPt = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const edgeLen = (e) => dist(e.p1, e.p2);

// 두 선분이 평행+근접 여부 (간격 < maxGap, 오버랩 있어야)
function nearParallel(e1, e2, maxGap = SNAP * 2) {
  const dx1 = e1.p2.x - e1.p1.x, dy1 = e1.p2.y - e1.p1.y;
  const len1 = Math.hypot(dx1, dy1);
  if (len1 < 1) return false;
  // e2의 중점이 e1의 수직 방향으로 얼마나 떨어져 있는지
  const nx = -dy1 / len1, ny = dx1 / len1; // 법선
  const m2 = midPt(e2.p1, e2.p2);
  const m1 = midPt(e1.p1, e1.p2);
  const perpDist = Math.abs((m2.x - m1.x) * nx + (m2.y - m1.y) * ny);
  if (perpDist > maxGap) return false;
  // 오버랩: 두 선분의 접선 방향 투영이 겹쳐야
  const tx = dx1 / len1, ty = dy1 / len1;
  const proj = (p) => (p.x - e1.p1.x) * tx + (p.y - e1.p1.y) * ty;
  const [a1, a2] = [0, len1];
  const [b1, b2] = [proj(e2.p1), proj(e2.p2)].sort((a, b) => a - b);
  return Math.min(a2, b2) - Math.max(a1, b1) > MIN_LEN * 0.5;
}

// ── 폴리곤 → 엣지 배열 ────────────────────────────────────────────
function polyToEdges(seg) {
  const coords = seg[0];
  const pts = [];
  for (let i = 0; i < coords.length; i += 2)
    pts.push({ x: coords[i], y: coords[i + 1] });
  const edges = [];
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    if (dist(p1, p2) >= MIN_LEN) edges.push({ p1, p2 });
  }
  return edges;
}

// ── 문 직사각형 → 선분 (긴 쪽 중심선) ────────────────────────────
function doorRectToSeg(seg) {
  const coords = seg[0];
  const xs = coords.filter((_, i) => i % 2 === 0);
  const ys = coords.filter((_, i) => i % 2 !== 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // 긴 쪽을 문 세그먼트로
  if (w >= h) {
    return { p1: { x: minX, y: cy }, p2: { x: maxX, y: cy } };
  } else {
    return { p1: { x: cx, y: minY }, p2: { x: cx, y: maxY } };
  }
}

// ── 노드 스냅 집합 ────────────────────────────────────────────────
class NodeSet {
  constructor() { this.nodes = []; this.nextId = 1; }
  snap(pt) {
    let best = null, bestD = SNAP;
    for (const n of this.nodes) {
      const d = dist(n, pt);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best) return best;
    const n = { id: this.nextId++, x: Math.round(pt.x), y: Math.round(pt.y) };
    this.nodes.push(n);
    return n;
  }
}

// ── 메인 변환 ──────────────────────────────────────────────────────
function convertToSkeleton(spaPath, strPath) {
  const spa = JSON.parse(fs.readFileSync(spaPath, 'utf8'));
  const str = JSON.parse(fs.readFileSync(strPath, 'utf8'));

  const cats = Object.fromEntries(spa.categories.map(c => [c.id, c.name]));
  const imgInfo = str.images[0];
  const W = imgInfo.width, H = imgInfo.height;

  // 1. 방 폴리곤에서 모든 엣지 수집
  const roomAnns = spa.annotations.filter(a => cats[a.category_id]?.startsWith('공간_'));
  const allRoomEdges = roomAnns.flatMap(a => polyToEdges(a.segmentation));

  // 2. 문 직사각형 수집 (str.json)
  const strCats = Object.fromEntries(str.categories.map(c => [c.id, c.name]));
  const doorSegs = str.annotations
    .filter(a => strCats[a.category_id] === '구조_출입문')
    .map(a => doorRectToSeg(a.segmentation));

  // 3. 문 위치와 겹치는 방 경계 엣지를 '문'으로 분류
  const wallEdges = [], doorEdges = [];
  for (const e of allRoomEdges) {
    const isDoor = doorSegs.some(d => nearParallel(e, d, SNAP * 1.5));
    if (isDoor) doorEdges.push(e);
    else        wallEdges.push(e);
  }

  // 4. 근접·평행한 방 경계 엣지 중복 제거 (두 방이 공유하는 벽)
  const mergedWalls = [];
  const used = new Set();
  for (let i = 0; i < wallEdges.length; i++) {
    if (used.has(i)) continue;
    const candidates = [wallEdges[i]];
    for (let j = i + 1; j < wallEdges.length; j++) {
      if (!used.has(j) && nearParallel(wallEdges[i], wallEdges[j])) {
        candidates.push(wallEdges[j]);
        used.add(j);
      }
    }
    // 평균으로 병합
    const avgP1x = candidates.reduce((s, e) => s + e.p1.x, 0) / candidates.length;
    const avgP1y = candidates.reduce((s, e) => s + e.p1.y, 0) / candidates.length;
    const avgP2x = candidates.reduce((s, e) => s + e.p2.x, 0) / candidates.length;
    const avgP2y = candidates.reduce((s, e) => s + e.p2.y, 0) / candidates.length;
    mergedWalls.push({ p1: { x: avgP1x, y: avgP1y }, p2: { x: avgP2x, y: avgP2y }, type: 'wall' });
  }

  // 문 엣지도 중복 제거
  const mergedDoors = [];
  const usedD = new Set();
  for (let i = 0; i < doorEdges.length; i++) {
    if (usedD.has(i)) continue;
    const candidates = [doorEdges[i]];
    for (let j = i + 1; j < doorEdges.length; j++) {
      if (!usedD.has(j) && nearParallel(doorEdges[i], doorEdges[j])) {
        candidates.push(doorEdges[j]);
        usedD.add(j);
      }
    }
    const avgP1x = candidates.reduce((s, e) => s + e.p1.x, 0) / candidates.length;
    const avgP1y = candidates.reduce((s, e) => s + e.p1.y, 0) / candidates.length;
    const avgP2x = candidates.reduce((s, e) => s + e.p2.x, 0) / candidates.length;
    const avgP2y = candidates.reduce((s, e) => s + e.p2.y, 0) / candidates.length;
    mergedDoors.push({ p1: { x: avgP1x, y: avgP1y }, p2: { x: avgP2x, y: avgP2y }, type: 'door' });
  }

  // 문 직사각형을 직접 선분으로도 추가 (방 경계에 없는 경우 보완)
  for (const d of doorSegs) {
    const alreadyCovered = mergedDoors.some(md => nearParallel(md, d, SNAP));
    if (!alreadyCovered) mergedDoors.push({ p1: d.p1, p2: d.p2, type: 'door' });
  }

  // 5. 노드+엣지 구조 생성
  const nodeSet = new NodeSet();
  const edges = [];
  let edgeId = 1;

  for (const seg of [...mergedWalls, ...mergedDoors]) {
    const n1 = nodeSet.snap(seg.p1);
    const n2 = nodeSet.snap(seg.p2);
    if (n1.id === n2.id) continue; // 너무 짧아서 같은 노드로 스냅됨
    edges.push({ id: edgeId++, from: n1.id, to: n2.id, type: seg.type });
  }

  // 6. 출력 str.json 구성
  const newStr = {
    info: str.info ?? {},
    licenses: str.licenses ?? [],
    categories: str.categories,
    images: str.images,
    annotations: [],
    structure_skeleton: {
      nodes: nodeSet.nodes,
      edges,
    }
  };

  fs.writeFileSync(strPath, JSON.stringify(newStr, null, 2), 'utf-8');
  console.log(`✅ ${path.basename(strPath)}: nodes=${nodeSet.nodes.length} edges=${edges.length} (wall:${mergedWalls.length} door:${mergedDoors.length})`);
}

// ── CLI ────────────────────────────────────────────────────────────
const [complex, type] = process.argv.slice(2);
if (!complex || !type) {
  console.log('사용법: node scripts/auto_skeleton.js <단지폴더> <타입>');
  console.log('예: node scripts/auto_skeleton.js CentralIpark 169');
  process.exit(1);
}

const spaPath = path.join(PUBLIC, 'floorplans', complex, `${type}_spa.json`);
const strPath = path.join(PUBLIC, 'floorplans', complex, `${type}_str.json`);
convertToSkeleton(spaPath, strPath);
