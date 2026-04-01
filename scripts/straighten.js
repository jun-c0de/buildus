/**
 * straighten.js  — 수평/수직 벽 좌표 정렬 (5도 이내만 처리)
 * 사용: node scripts/straighten.js CentralIpark 135
 *       node scripts/straighten.js CentralIpark  (전체 타입)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const AXIS_THRESH_DEG = 5;   // 5도 이내만 축 정렬
const SNAP_AFTER = 2;        // 정렬 후 2px 이내 노드 병합

// ── Union-Find ───────────────────────────────────────────────────
class UF {
  constructor() { this.parent = {}; }
  find(x) {
    if (this.parent[x] == null) this.parent[x] = x;
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
  groups(ids) {
    const m = new Map();
    for (const id of ids) {
      const r = this.find(id);
      if (!m.has(r)) m.set(r, []);
      m.get(r).push(id);
    }
    return m;
  }
}

function straighten(strPath) {
  const str = JSON.parse(fs.readFileSync(strPath, 'utf8'));
  if (!str.structure_skeleton) { console.log('skeleton 없음, 건너뜀:', strPath); return; }

  const { nodes, edges } = str.structure_skeleton;
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));

  const xUF = new UF();  // 같은 X를 공유해야 하는 그룹 (수직선)
  const yUF = new UF();  // 같은 Y를 공유해야 하는 그룹 (수평선)

  let alignedCount = 0, skippedCount = 0;

  for (const e of edges) {
    const n1 = nodeMap.get(e.from), n2 = nodeMap.get(e.to);
    if (!n1 || !n2) continue;
    const dx = Math.abs(n2.x - n1.x), dy = Math.abs(n2.y - n1.y);
    if (dx === 0 && dy === 0) continue;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const offAxis = Math.min(angle, 90 - angle);

    if (offAxis > AXIS_THRESH_DEG) { skippedCount++; continue; }

    alignedCount++;
    if (dx <= dy) {
      // 수직에 가까움 → 같은 X로 정렬
      xUF.union(n1.id, n2.id);
    } else {
      // 수평에 가까움 → 같은 Y로 정렬
      yUF.union(n1.id, n2.id);
    }
  }

  const allIds = nodes.map(n => n.id);

  // X 그룹 평균 적용
  for (const [, group] of xUF.groups(allIds)) {
    if (group.length < 2) continue;
    const avgX = Math.round(group.reduce((s, id) => s + nodeMap.get(id).x, 0) / group.length);
    group.forEach(id => { nodeMap.get(id).x = avgX; });
  }

  // Y 그룹 평균 적용
  for (const [, group] of yUF.groups(allIds)) {
    if (group.length < 2) continue;
    const avgY = Math.round(group.reduce((s, id) => s + nodeMap.get(id).y, 0) / group.length);
    group.forEach(id => { nodeMap.get(id).y = avgY; });
  }

  // 정렬 후 가까운 노드 병합 (SNAP_AFTER 이내)
  const mergeMap = new Map();  // oldId → survivorId
  const survivors = [...nodeMap.values()];
  for (let i = 0; i < survivors.length; i++) {
    for (let j = i + 1; j < survivors.length; j++) {
      const a = survivors[i], b = survivors[j];
      if (Math.abs(a.x - b.x) <= SNAP_AFTER && Math.abs(a.y - b.y) <= SNAP_AFTER) {
        // b → a로 병합
        const root = mergeMap.get(a.id) ?? a.id;
        mergeMap.set(b.id, root);
        a.x = Math.round((a.x + b.x) / 2);
        a.y = Math.round((a.y + b.y) / 2);
      }
    }
  }

  // 병합된 노드 제거 + 엣지 업데이트
  const resolveId = (id) => {
    let cur = id;
    while (mergeMap.has(cur)) cur = mergeMap.get(cur);
    return cur;
  };

  const newNodes = survivors.filter(n => !mergeMap.has(n.id));
  const newEdges = edges
    .map(e => ({ ...e, from: resolveId(e.from), to: resolveId(e.to) }))
    .filter(e => e.from !== e.to);  // 같은 노드로 붙은 zero-length 엣지 제거

  // 중복 엣지 제거
  const edgeSeen = new Set();
  const dedupEdges = newEdges.filter(e => {
    const k = [Math.min(e.from,e.to), Math.max(e.from,e.to)].join('-');
    if (edgeSeen.has(k)) return false;
    edgeSeen.add(k); return true;
  });

  str.structure_skeleton = { nodes: newNodes, edges: dedupEdges };
  fs.writeFileSync(strPath, JSON.stringify(str, null, 2), 'utf-8');

  console.log(`✅ ${path.basename(strPath)}: 정렬=${alignedCount}개 대각선유지=${skippedCount}개 | 노드 ${nodes.length}→${newNodes.length} 엣지 ${edges.length}→${dedupEdges.length}`);
}

// ── CLI ────────────────────────────────────────────────────────────
const [complex, type] = process.argv.slice(2);
if (!complex) { console.log('사용법: node scripts/straighten.js <단지> [타입]'); process.exit(1); }

const folder = path.join(PUBLIC, 'floorplans', complex);
if (type) {
  straighten(path.join(folder, `${type}_str.json`));
} else {
  for (const f of fs.readdirSync(folder).filter(f => f.endsWith('_str.json'))) {
    straighten(path.join(folder, f));
  }
}
