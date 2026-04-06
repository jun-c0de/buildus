import { useRef, useEffect, useState, useMemo } from 'react';
import { ROOM_CONFIG, STRUCT_COLORS, OPEN_PLAN_GROUPS, ROOM_FLOOR_COLOR } from '../data/roomConfig';

// ── 아키스케치 실제 텍스처 이미지 (모듈 레벨 preload) ────────────
const ASKI = (() => {
  if (typeof window === 'undefined') return {};
  const mk = src => { const i = new Image(); i.src = src; return i; };
  return {
    wood:    mk('/textures/archisketch_wood.jpg'),
    bath:    mk('/textures/archisketch_tile_bath.jpg'),
    balcony: mk('/textures/archisketch_tile_balcony.jpg'),
  };
})();

// ── 외벽 엣지들을 연결된 폴리라인 체인으로 묶기 (모서리 miter 처리) ─
function groupEdgesToChains(edges) {
  if (!edges.length) return [];
  const S = 3; // snap tolerance
  const snap = p => `${Math.round(p[0]/S)*S},${Math.round(p[1]/S)*S}`;
  const ptCoords = new Map();
  const adj = new Map();

  for (const { p1, p2 } of edges) {
    const k1 = snap(p1), k2 = snap(p2);
    if (!ptCoords.has(k1)) ptCoords.set(k1, p1);
    if (!ptCoords.has(k2)) ptCoords.set(k2, p2);
    if (!adj.has(k1)) adj.set(k1, new Set());
    if (!adj.has(k2)) adj.set(k2, new Set());
    adj.get(k1).add(k2);
    adj.get(k2).add(k1);
  }

  const visited = new Set();
  const chains = [];

  for (const startK of adj.keys()) {
    if (visited.has(startK)) continue;
    const chain = [ptCoords.get(startK)];
    visited.add(startK);
    let cur = startK;

    while (true) {
      let nextK = null;
      for (const nk of adj.get(cur)) {
        if (!visited.has(nk)) { nextK = nk; break; }
      }
      if (!nextK) {
        // 루프로 닫히면 시작점 추가
        if (adj.get(cur).has(startK) && chain.length > 2)
          chain.push(ptCoords.get(startK));
        break;
      }
      visited.add(nextK);
      chain.push(ptCoords.get(nextK));
      cur = nextK;
    }
    if (chain.length > 1) chains.push(chain);
  }
  return chains;
}

// ── 엣지 키 (인접 방 공유 엣지 검출, 3px 허용 오차) ──────────────
function edgeKey2D([x1, y1], [x2, y2]) {
  const r = v => Math.round(v / 3) * 3;
  const a = `${r(x1)},${r(y1)}`, b = `${r(x2)},${r(y2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
// ── 포인트-인-폴리곤 (gap으로 분리된 오픈플랜 경계 감지용) ────────
function pip2D([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// ── 아키스케치 스타일 바닥 색상 (파스텔, 연한 톤) ─────────────────
const ASKI_FLOOR = {
  '공간_거실':       '#F5F0E8',  // 아이보리 화이트
  '공간_주방':       '#F5F0E8',
  '공간_현관':       '#EDE8DC',  // 살짝 어두운 아이보리
  '공간_침실':       '#E8D5A8',  // 연한 허니-밀색 (나무 느낌)
  '공간_드레스룸':   '#E5D09E',
  '공간_다목적공간': '#E8D5A8',
  '공간_화장실':     '#EDEDED',  // 연한 회색 타일
  '공간_욕실':       '#EDEDED',
  '공간_발코니':     '#DCDCD8',  // 연한 중성 회색
  '공간_실외기실':   '#D8D8D4',
  '공간_싱크대':     '#E8F0F5',
  '공간_가스레인지': '#F5EDE0',
  '공간_기타':       '#E8E8E4',
};

function getPattern(ctx, name) {
  return ASKI_FLOOR[name] ?? '#F0EDE6';
}

// ── 스켈레톤 문 심볼 (2점 선분 [p1,p2] 기반) ─────────────────────
function drawDoorSegment(ctx, seg, wallW, BG) {
  if (seg.length < 2) return;
  const [p1, p2] = seg;
  const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
  const len = Math.hypot(dx, dy);
  if (len < 2) return;

  ctx.save();
  // ① 개구부 지우기
  ctx.strokeStyle = BG; ctx.lineWidth = wallW * 2.2;
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();

  // ② 문짝 선
  ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = Math.max(wallW*0.55, 2);
  ctx.lineCap = 'round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();

  // ③ 개폐 호 (p1 경첩, p2까지 90도)
  const ang = Math.atan2(dy, dx);
  const nx = -dy/len, ny = dx/len;  // 법선 방향
  ctx.strokeStyle = 'rgba(40,40,40,0.40)';
  ctx.lineWidth = Math.max(wallW*0.35, 1.2);
  ctx.setLineDash([len*0.07, len*0.035]);
  ctx.beginPath(); ctx.arc(p1[0], p1[1], len, ang, ang - Math.PI/2, true); ctx.stroke();
  // 가이드선
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(40,40,40,0.25)'; ctx.lineWidth = Math.max(wallW*0.3, 1);
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p1[0] + len * Math.cos(ang - Math.PI/2), p1[1] + len * Math.sin(ang - Math.PI/2));
  ctx.stroke();

  // ④ 경첩 점
  ctx.fillStyle = '#F0C030';
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(p1[0], p1[1], Math.max(wallW*0.5,3), 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#C09020'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p1[0], p1[1], Math.max(wallW*0.5,3), 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// ── 스켈레톤 슬라이딩 도어 심볼 ────────────────────────────────────
function drawSlidingSegment(ctx, seg, wallW, BG) {
  if (seg.length < 2) return;
  const [p1, p2] = seg;
  const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  ctx.save();
  // 개구부 지우기
  ctx.strokeStyle = BG; ctx.lineWidth = wallW * 2.2; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
  // 슬라이딩 패널 (절반씩 겹치는 두 사각형 표시)
  const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2;
  const nx = -dy/len, ny = dx/len;
  const half = wallW * 0.5;
  for (const sign of [-1, 1]) {
    const ox = nx*half*sign, oy = ny*half*sign;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.strokeRect(p1[0]+ox - (sign<0?0:dx/2), p1[1]+oy - (sign<0?0:dy/2), dx/2, dy/2);
  }
  ctx.restore();
}

// ── Canvas 헬퍼 ───────────────────────────────────────────────────
function tracePoly(ctx, poly) {
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function drawDoorArc(ctx, poly, sw) {
  // 2점 선분(문턱 마커)은 스킵 — 3점 삼각형 아크만 렌더링
  if (poly.length < 3) return;

  let hinge, door, arc, r;

  {
    // 3점 삼각형: 경첩(hinge) = 다른 두 꼭짓점까지 거리가 가장 비슷한 꼭짓점
    const [A,B,C] = poly;
    const dAB = Math.hypot(B[0]-A[0], B[1]-A[1]);
    const dAC = Math.hypot(C[0]-A[0], C[1]-A[1]);
    const dBC = Math.hypot(C[0]-B[0], C[1]-B[1]);
    const diffA = Math.abs(dAB-dAC);
    const diffB = Math.abs(dAB-dBC);
    const diffC = Math.abs(dAC-dBC);
    if (diffA <= diffB && diffA <= diffC) {
      hinge=A; door=B; arc=C; r=(dAB+dAC)/2;
    } else if (diffB <= diffC) {
      hinge=B; door=A; arc=C; r=(dAB+dBC)/2;
    } else {
      hinge=C; door=A; arc=B; r=(dAC+dBC)/2;
    }
    if (r < 2) return;
  }

  const startA = Math.atan2(door[1]-hinge[1], door[0]-hinge[0]);
  const endA   = Math.atan2(arc[1]-hinge[1],  arc[0]-hinge[0]);
  let diff = endA - startA;
  while (diff >  Math.PI) diff -= 2*Math.PI;
  while (diff < -Math.PI) diff += 2*Math.PI;

  ctx.save();
  ctx.lineCap = 'butt';
  // 문짝 선
  ctx.strokeStyle = '#2A2A2A';
  ctx.lineWidth = sw * 2.0;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(hinge[0],hinge[1]); ctx.lineTo(door[0],door[1]); ctx.stroke();
  // 열린방향 가이드선
  ctx.strokeStyle = 'rgba(40,40,40,0.30)';
  ctx.lineWidth = sw * 0.65;
  ctx.beginPath(); ctx.moveTo(hinge[0],hinge[1]); ctx.lineTo(arc[0],arc[1]); ctx.stroke();
  // 점선 호
  ctx.strokeStyle = 'rgba(40,40,40,0.45)';
  ctx.lineWidth = sw * 0.75;
  ctx.setLineDash([r*0.08, r*0.04]);
  ctx.beginPath(); ctx.arc(hinge[0],hinge[1], r, startA, endA, diff < 0); ctx.stroke();
  ctx.setLineDash([]);
  // 경첩 점 (아키스케치 스타일 노란 원)
  ctx.fillStyle = '#F0C030';
  ctx.beginPath(); ctx.arc(hinge[0], hinge[1], sw * 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#C09020'; ctx.lineWidth = sw * 0.4;
  ctx.beginPath(); ctx.arc(hinge[0], hinge[1], sw * 1.4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ── 창문: 건축 도면 3선 심볼 (벽 위에 그려야 올바르게 보임) ──────
function drawWindow(ctx, poly, wallW, BG_COLOR) {
  if (poly.length < 2) return;
  // 가장 긴 방향 = 창문 길이 방향
  let maxDist=0, p1=poly[0], p2=poly[Math.min(1, poly.length-1)];
  for (let i=0; i<poly.length; i++) {
    for (let j=i+1; j<poly.length; j++) {
      const d = Math.hypot(poly[j][0]-poly[i][0], poly[j][1]-poly[i][1]);
      if (d > maxDist) { maxDist=d; p1=poly[i]; p2=poly[j]; }
    }
  }
  const dx=p2[0]-p1[0], dy=p2[1]-p1[1];
  const len=Math.hypot(dx,dy);
  if (len < 4) return;
  const nx=-dy/len, ny=dx/len;
  // 창문 심볼 폭 = 벽 두께의 절반 (3선이 안에 들어오게)
  const spread = Math.max(wallW * 0.55, 3);
  // 선 두께
  const frameW = Math.max(wallW * 0.28, 1.5);
  const glassW = Math.max(wallW * 0.22, 1.2);

  ctx.save();
  ctx.lineCap = 'butt';

  // ① 배경 지우기 — 벽 스트로크를 완전히 덮는 넓은 배경색 띠
  ctx.strokeStyle = BG_COLOR;
  ctx.lineWidth = wallW * 2.8;
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();

  // ② 창문 내부 흰색 채우기
  ctx.strokeStyle = '#F8F7F4';
  ctx.lineWidth = wallW * 1.8;
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();

  // ③ 양쪽 프레임선 (짙은 회색)
  ctx.strokeStyle = '#2A2A2A';
  ctx.lineWidth = frameW;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(p1[0]+nx*spread*s, p1[1]+ny*spread*s);
    ctx.lineTo(p2[0]+nx*spread*s, p2[1]+ny*spread*s);
    ctx.stroke();
  }

  // ④ 유리선 (중앙, 파란색)
  ctx.strokeStyle = '#5AABCF';
  ctx.lineWidth = glassW;
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();

  ctx.restore();
}

function drawStructPoly(ctx, poly, fillColor, strokeColor, sw) {
  ctx.save();
  ctx.beginPath(); tracePoly(ctx, poly);
  ctx.fillStyle = fillColor; ctx.fill();
  ctx.strokeStyle = strokeColor; ctx.lineWidth = sw; ctx.stroke();
  ctx.restore();
}

function drawLabels(ctx, roomPolys, W, H, photoMode = false) {
  const fMain = Math.min(W, H) * 0.022;
  const fSub  = Math.min(W, H) * 0.015;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of roomPolys) {
    const y0 = r.cy - H * (photoMode ? 0.008 : 0.01);
    const mainColor = photoMode ? 'white' : '#1A1A18';
    const subColor  = photoMode ? 'rgba(255,255,255,0.9)' : '#444';
    const shadowColor = photoMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';

    ctx.font = `700 ${fMain}px Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    ctx.strokeStyle = shadowColor; ctx.lineWidth = 3;
    ctx.strokeText(r.label, r.cx, y0);
    ctx.fillStyle = mainColor; ctx.fillText(r.label, r.cx, y0);

    if (r.area > 0.5) {
      ctx.font = `${fSub}px Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
      const y1 = r.cy + H * (photoMode ? 0.018 : 0.016);
      ctx.strokeStyle = photoMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(`${r.area.toFixed(1)}m²`, r.cx, y1);
      ctx.fillStyle = subColor; ctx.fillText(`${r.area.toFixed(1)}m²`, r.cx, y1);
    }
  }
}

// ── 메인 Canvas 렌더링 ────────────────────────────────────────────
function renderCanvas({ ctx, W, H, roomPolys, svgEdges, windows, doors, walls, img, hoveredSet, viewStyle, isSkeleton }) {
  ctx.clearRect(0, 0, W, H);

  if (viewStyle === 'styled') {
    const BG  = '#F2F2F0';
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

    // 방 바닥 fill
    for (const r of roomPolys) {
      const color = ASKI_FLOOR[r.name] ?? '#F0EDE6';
      ctx.save();
      ctx.beginPath(); tracePoly(ctx, r.poly);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }

    if (isSkeleton) {
      // ══════════════════════════════════════════════════════
      // 스켈레톤 렌더링: 직접 그린 선분 사용
      // ══════════════════════════════════════════════════════
      const wallW = Math.max(W * 0.007, 6);

      // 벽 선분
      ctx.save();
      ctx.strokeStyle = '#1A1A18'; ctx.lineWidth = wallW;
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.miterLimit = 10;
      for (const seg of walls) {
        ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
      }
      ctx.restore();

      // 창문 심볼
      for (const seg of windows) drawWindow(ctx, seg, wallW, BG);

      // 문 심볼 (슬라이딩 구분)
      for (const seg of doors) {
        if (seg._type === 'sliding') drawSlidingSegment(ctx, seg, wallW, BG);
        else drawDoorSegment(ctx, seg, wallW, BG);
      }

    } else {
      // ══════════════════════════════════════════════════════
      // 레거시 렌더링: SAM2 폴리곤 경계 기반
      // ══════════════════════════════════════════════════════
      const extW = Math.max(W * 0.007, 6);
      const intW = Math.max(W * 0.003, 2.5);
      const sw   = Math.max(W * 0.005, 4);

      const extChains = groupEdgesToChains(svgEdges.external);
      ctx.save();
      ctx.strokeStyle = '#1A1A18'; ctx.lineWidth = extW * 2;
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.miterLimit = 8;
      for (const chain of extChains) {
        ctx.beginPath(); ctx.moveTo(chain[0][0], chain[0][1]);
        for (let i = 1; i < chain.length; i++) ctx.lineTo(chain[i][0], chain[i][1]);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#1A1A18'; ctx.lineWidth = intW;
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (const { p1, p2 } of svgEdges.internal) {
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
      ctx.restore();

      for (const poly of windows) drawWindow(ctx, poly, extW, BG);
      for (const poly of doors) drawDoorArc(ctx, poly, sw);
    }

    // 호버
    for (const r of roomPolys) {
      if (hoveredSet.has(r.key)) {
        ctx.save();
        ctx.beginPath(); tracePoly(ctx, r.poly);
        ctx.fillStyle = r.border + '38'; ctx.fill();
        ctx.restore();
      }
    }

    drawLabels(ctx, roomPolys, W, H, false);

  } else {
    // ══════════════════════════════════════════════════════
    // 도면 사진 모드: 원본 이미지 그대로 + 호버
    // ══════════════════════════════════════════════════════
    if (img) ctx.drawImage(img, 0, 0, W, H);
    else { ctx.fillStyle = '#F2F2F0'; ctx.fillRect(0, 0, W, H); }

    for (const r of roomPolys) {
      if (hoveredSet.has(r.key)) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); tracePoly(ctx, r.poly);
        ctx.fillStyle = r.border; ctx.fill();
        ctx.restore();
      }
    }
    drawLabels(ctx, roomPolys, W, H, true);
  }
}

const SCALE = 10; // FloorPlan3D와 동일

// ── 2D ↔ 3D 좌표 변환 ────────────────────────────────────────────
function worldToSVG(wx, wz, W, H) {
  return { cx: (wx / SCALE + 0.5) * W, cy: (wz / SCALE + 0.5) * H };
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
export default function FloorPlan2D({
  data, imageUrl, compact = false,
  placedFurniture = [], placingFurniture = null, selectedUid = null,
  onPlace, onSelectPlaced, onRotate, onDelete, onUpdatePosition,
}) {
  const { imgWidth: W, imgHeight: H, walls, windows, doors = [], rooms, isSkeleton = false } = data;
  const canvasRef  = useRef(null);
  const svgRef     = useRef(null);
  const dragRef    = useRef(null);   // { uid, startWx, startWz, origX, origZ, hasMoved }
  const movedRef   = useRef(false);  // 드래그 후 SVG onClick 막기
  const [hovered, setHovered]     = useState(null);
  const [loadedImg, setLoadedImg] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewStyle = 'styled';

  // 클라이언트 좌표 → world 좌표
  const clientToWorld = (e) => {
    const svg = svgRef.current;
    if (!svg) return { wx: 0, wz: 0 };
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top)  * (H / rect.height);
    return { wx: (px / W - 0.5) * SCALE, wz: (py / H - 0.5) * SCALE };
  };

  // 도면 원본 이미지 로드 (photo 모드 폴백용으로만 유지)
  useEffect(() => {
    if (!imageUrl) { setLoadedImg(null); return; }
    const img = new Image();
    img.onload = () => setLoadedImg(img);
    img.src = imageUrl;
    return () => { img.onload = null; };
  }, [imageUrl]);

  const openGroupMap = useMemo(() => {
    const map = {};
    OPEN_PLAN_GROUPS.forEach((names, gi) => names.forEach(n => (map[n] = gi)));
    return map;
  }, []);

  const roomPolys = useMemo(() =>
    rooms.map((r, i) => {
      const cfg = ROOM_CONFIG[r.name] || { fill: '#F5F5F5', border: '#BDBDBD', label: r.name };
      const gi = openGroupMap[r.name] ?? null;
      return { ...r, ...cfg, label: r.displayName ?? cfg.label, key: i, groupIdx: gi };
    }), [rooms, openGroupMap]
  );

  // 호버는 개별 방 단위로 (오픈플랜도 방마다 따로)
  const hoveredSet = useMemo(() => {
    if (hovered === null) return new Set();
    return new Set([hovered]);
  }, [hovered]);

  // 외벽/내벽/오픈플랜 엣지 분류
  const svgEdges = useMemo(() => {
    if (!rooms.length) return { external: [], internal: [], openPlan: [] };
    const counts = {}, pts = {}, roomsByKey = {};
    rooms.forEach(room => {
      for (let i = 0; i < room.poly.length; i++) {
        const p1 = room.poly[i], p2 = room.poly[(i + 1) % room.poly.length];
        const k = edgeKey2D(p1, p2);
        counts[k] = (counts[k] || 0) + 1;
        pts[k] = { p1, p2 };
        if (!roomsByKey[k]) roomsByKey[k] = [];
        roomsByKey[k].push(room.name);
      }
    });
    const external = [], internal = [], openPlan = [];
    for (const [k, v] of Object.entries(pts)) {
      const { p1, p2 } = v;
      if (counts[k] === 1) {
        // gap으로 분리된 오픈플랜 경계 공간 체크
        const mx = (p1[0]+p2[0])/2, my = (p1[1]+p2[1])/2;
        const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
        const len = Math.hypot(dx, dy);
        let classified = false;
        if (len > 0) {
          const nx = -dy/len, ny = dx/len;
          const OFF = 8;  // 8px 오프셋 (gap 3-5px보다 크게)
          const r1 = rooms.find(r => pip2D([mx+nx*OFF, my+ny*OFF], r.poly))?.name;
          const r2 = rooms.find(r => pip2D([mx-nx*OFF, my-ny*OFF], r.poly))?.name;
          if (r1 && r2 && r1 !== r2) {
            // gap으로 분리된 경계: 양쪽에 방이 있으면 외벽이 아님
            const isOpen = OPEN_PLAN_GROUPS.some(g => g.includes(r1) && g.includes(r2));
            (isOpen ? openPlan : internal).push(v);
            classified = true;
          }
        }
        if (!classified) external.push(v);
      } else {
        const names = roomsByKey[k] ?? [];
        const isOpen = OPEN_PLAN_GROUPS.some(g => names.every(n => g.includes(n)));
        (isOpen ? openPlan : internal).push(v);
      }
    }
    return { external, internal, openPlan };
  }, [rooms]);

  // Canvas 렌더링 (상태 변화마다 재실행)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    renderCanvas({ ctx, W, H, roomPolys, svgEdges, windows, doors, walls, img: loadedImg, hoveredSet, viewStyle, isSkeleton });
  }, [roomPolys, svgEdges, windows, doors, walls, loadedImg, hoveredSet, viewStyle, isSkeleton, W, H]);

  // SVG 클릭 → 가구 배치 (드래그 직후엔 스킵)
  const handleSVGClick = (e) => {
    if (movedRef.current) return;
    if (!placingFurniture || !onPlace) return;
    const { wx, wz } = clientToWorld(e);
    onPlace(wx, wz);
  };

  // SVG 포인터 이동 → 드래그 중이면 위치 업데이트
  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { wx, wz } = clientToWorld(e);
    const dx = wx - dragRef.current.startWx;
    const dz = wz - dragRef.current.startWz;
    if (!dragRef.current.hasMoved && Math.hypot(dx, dz) > 0.08) {
      dragRef.current.hasMoved = true;
      movedRef.current = true;
      setIsDragging(true);
    }
    if (dragRef.current.hasMoved) {
      onUpdatePosition?.(dragRef.current.uid, dragRef.current.origX + dx, dragRef.current.origZ + dz);
    }
  };

  // SVG 포인터 업 → 드래그 종료
  const handlePointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
    // onClick이 먼저 처리된 뒤 초기화
    setTimeout(() => { movedRef.current = false; }, 10);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', gap: 0 }}>

      {/* ── 메인 뷰어 ── */}
      <div style={{
        flex: 1, borderRadius: compact ? 0 : 16, overflow: 'hidden',
        border: compact ? 'none' : '1px solid #E2E8F0',
        position: 'relative', background: '#F5F4F0',
        cursor: placingFurniture ? 'crosshair' : 'default',
      }}>
        {/* Canvas: 실제 렌더링 */}
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />

        {/* SVG 오버레이: 이벤트 + 가구 렌더링 */}
        <svg ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            cursor: isDragging ? 'grabbing' : placingFurniture ? 'crosshair' : 'default',
            touchAction: 'none',
          }}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSVGClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* 방 호버 영역 */}
          {roomPolys.map(r => (
            <polygon key={r.key}
              points={r.poly.map(p => p.join(',')).join(' ')}
              fill="transparent" stroke="transparent"
              style={{ cursor: placingFurniture ? 'crosshair' : 'pointer' }}
              onMouseEnter={() => setHovered(r.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* 배치된 가구 */}
          {placedFurniture.map(f => {
            const { cx, cy } = worldToSVG(f.x, f.z, W, H);
            const rw = f.config.width  * (W / SCALE);
            const rd = f.config.depth  * (H / SCALE);
            const deg = (f.rotation ?? 0) * 180 / Math.PI;
            const isSel = f.uid === selectedUid;
            const fontSize = Math.max(Math.min(rw, rd) * 0.28, 8);
            return (
              <g key={f.uid}
                transform={`rotate(${deg}, ${cx}, ${cy})`}
                style={{ cursor: isDragging && dragRef.current?.uid === f.uid ? 'grabbing' : 'grab' }}
                onPointerDown={e => {
                  e.stopPropagation();
                  movedRef.current = false;
                  const { wx, wz } = clientToWorld(e);
                  dragRef.current = { uid: f.uid, startWx: wx, startWz: wz, origX: f.x, origZ: f.z, hasMoved: false };
                  onSelectPlaced?.(f.uid);
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* 그림자 */}
                <rect
                  x={cx - rw/2 + 2} y={cy - rd/2 + 2}
                  width={rw} height={rd}
                  rx="4" fill="rgba(0,0,0,0.08)"
                />
                {/* 본체 */}
                <rect
                  x={cx - rw/2} y={cy - rd/2}
                  width={rw} height={rd} rx="4"
                  fill={isSel ? 'rgba(59,130,246,0.18)' : 'rgba(226,232,240,0.75)'}
                  stroke={isSel ? '#3B82F6' : '#94A3B8'}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
                {/* 방향 표시선 */}
                <line
                  x1={cx} y1={cy - rd/2} x2={cx} y2={cy - rd/2 + Math.min(rd * 0.3, 10)}
                  stroke={isSel ? '#3B82F6' : '#94A3B8'} strokeWidth="2" strokeLinecap="round"
                />
                {/* 라벨 */}
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize}
                  fontFamily="Pretendard,'Apple SD Gothic Neo',sans-serif"
                  fontWeight="700"
                  fill={isSel ? '#1D4ED8' : '#475569'}
                >{f.config.name}</text>

                {/* 선택 시 액션 버튼 */}
                {isSel && (
                  <>
                    {/* 회전 버튼 */}
                    <g onClick={e => { e.stopPropagation(); onRotate?.(f.uid); }} style={{ cursor: 'pointer' }}>
                      <circle cx={cx + rw/2 + 10} cy={cy - rd/2 - 10} r="12" fill="#3B82F6" />
                      <text x={cx + rw/2 + 10} y={cy - rd/2 - 10}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="12" fill="white" fontWeight="700">↻</text>
                    </g>
                    {/* 삭제 버튼 */}
                    <g onClick={e => { e.stopPropagation(); onDelete?.(f.uid); }} style={{ cursor: 'pointer' }}>
                      <circle cx={cx + rw/2 + 10} cy={cy - rd/2 + 12} r="12" fill="#EF4444" />
                      <text x={cx + rw/2 + 10} y={cy - rd/2 + 12}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="11" fill="white" fontWeight="700">✕</text>
                    </g>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* 나침반 */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0',
          borderRadius: '50%', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#E8540A', pointerEvents: 'none',
        }}>N</div>

        {/* 축척 */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0',
          borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#64748B', fontWeight: 500,
          pointerEvents: 'none',
        }}>1 : 100</div>

      </div>

      {/* ── 우측 패널 (compact 모드에선 숨김) ── */}
      {!compact && <div style={{ width: 196, marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, letterSpacing: '0.05em' }}>공간 목록</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {roomPolys.map(r => (
              <div key={r.key}
                onMouseEnter={() => setHovered(r.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                  background: hoveredSet.has(r.key) ? '#F1F5F9' : 'transparent',
                  border: hoveredSet.has(r.key) ? `1.5px solid ${r.border}` : '1.5px solid transparent',
                  transition: 'all 0.12s',
                }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: r.border, flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, color: '#334155', fontWeight: hoveredSet.has(r.key) ? 600 : 400 }}>{r.label}</span>
                {r.area > 0.1 && <span style={{ fontSize: 11, color: '#94A3B8' }}>{r.area.toFixed(1)}m²</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 10, letterSpacing: '0.05em' }}>구조 요소</div>
          {[
            { color: STRUCT_COLORS['구조_벽체'], label: '벽체', count: walls.length },
            { color: '#64B5F6', label: '창문', count: windows.length },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, color: '#334155' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{item.count}개</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
