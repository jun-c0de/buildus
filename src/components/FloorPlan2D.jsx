import { useRef, useEffect, useState, useMemo } from 'react';
import { ROOM_CONFIG, STRUCT_COLORS, OPEN_PLAN_GROUPS, ROOM_FLOOR_COLOR } from '../data/roomConfig';

// ── 엣지 키 (인접 방 공유 엣지 검출, 3px 허용 오차) ──────────────
function edgeKey2D([x1, y1], [x2, y2]) {
  const r = v => Math.round(v / 3) * 3;
  const a = `${r(x1)},${r(y1)}`, b = `${r(x2)},${r(y2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ── 텍스처 소스 캔버스 (모듈 로드 시 한 번만 생성) ───────────────
const TEX = (() => {
  // 목재 마루 (아키스케치 스타일: 가로 판자, 따뜻한 나무색)
  function wood(color = '#C8A060') {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, 120, 16);
    // 판자 경계
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 0, 120, 1.5);
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(0, 1.5, 120, 1);
    x.fillStyle = 'rgba(0,0,0,0.10)'; x.fillRect(0, 14.5, 120, 1.5);
    // 나뭇결 (2줄)
    x.strokeStyle = 'rgba(0,0,0,0.06)'; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(0, 5); x.lineTo(120, 5.5); x.stroke();
    x.beginPath(); x.moveTo(0, 10); x.lineTo(120, 9.5); x.stroke();
    return c;
  }
  // 타일 (300×300 정사각 타일)
  function tile(dark = false) {
    const sz = 44, gap = 3;
    const c = document.createElement('canvas');
    c.width = sz + gap; c.height = sz + gap;
    const x = c.getContext('2d');
    // dark(발코니): 밝은 연회색 / bright(화장실): 밝은 흰색
    x.fillStyle = dark ? '#D4D2CE' : '#EDECEA'; x.fillRect(0, 0, sz+gap, sz+gap);
    x.fillStyle = dark ? '#DDDBD7' : '#F5F3EF';
    x.fillRect(gap, gap, sz, sz);
    x.strokeStyle = dark ? '#C4C2BE' : '#D8D6D2'; x.lineWidth = 0.6;
    x.strokeRect(gap+0.5, gap+0.5, sz-1, sz-1);
    return c;
  }
  return { wood: wood(), tileBright: tile(false), tileDark: tile(true) };
})();

function getPattern(ctx, name) {
  if (['공간_침실', '공간_드레스룸', '공간_다목적공간'].includes(name))
    return ctx.createPattern(TEX.wood, 'repeat');
  if (['공간_화장실', '공간_욕실'].includes(name))
    return ctx.createPattern(TEX.tileBright, 'repeat');
  if (name === '공간_발코니')
    return ctx.createPattern(TEX.tileDark, 'repeat');
  return ROOM_FLOOR_COLOR[name] ?? '#E0DDD8';
}

// ── Canvas 헬퍼 ───────────────────────────────────────────────────
function tracePoly(ctx, poly) {
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function drawDoorArc(ctx, poly, sw) {
  if (poly.length < 2) return;

  let hinge, door, arc, r;

  if (poly.length === 2) {
    // 2점 선분: 수직 방향으로 스윙
    const [[x1,y1],[x2,y2]] = poly;
    const dx=x2-x1, dy=y2-y1;
    r = Math.sqrt(dx*dx+dy*dy);
    if (r < 2) return;
    hinge=[x1,y1]; door=[x2,y2]; arc=[x1-dy, y1+dx];
  } else {
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

// ── 창문: 건축 도면 3선 심볼 ─────────────────────────────────────
function drawWindow(ctx, poly, lineW, wallW) {
  // 가장 긴 대각선 방향 찾기
  let maxDist=0, p1=poly[0], p2=poly[Math.min(1, poly.length-1)];
  for (let i=0; i<poly.length; i++) {
    for (let j=i+1; j<poly.length; j++) {
      const d = Math.hypot(poly[j][0]-poly[i][0], poly[j][1]-poly[i][1]);
      if (d > maxDist) { maxDist=d; p1=poly[i]; p2=poly[j]; }
    }
  }
  const dx=p2[0]-p1[0], dy=p2[1]-p1[1];
  const len=Math.hypot(dx,dy);
  if (len<4) return;
  const nx=-dy/len, ny=dx/len;
  // 벽 두께에 비례한 간격 (너무 크지 않게 cap)
  const spread = wallW * 0.38;

  ctx.save();
  ctx.lineCap = 'butt';
  // 흰 개구부 (벽 두께만큼만)
  ctx.strokeStyle = '#F5F3EE';
  ctx.lineWidth = wallW * 0.92;
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
  // 양쪽 벽 마감선
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = lineW * 0.85;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(p1[0]+nx*spread*s, p1[1]+ny*spread*s);
    ctx.lineTo(p2[0]+nx*spread*s, p2[1]+ny*spread*s);
    ctx.stroke();
  }
  // 유리선 (중간, 파란색)
  ctx.strokeStyle = '#5BA8D4';
  ctx.lineWidth = lineW * 1.1;
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
function renderCanvas({ ctx, W, H, roomPolys, svgEdges, windows, walls, img, hoveredSet, viewStyle }) {
  // Archisketch 기준 벽 두께
  const extW = Math.max(W * 0.018, 12);  // 외벽
  const intW = Math.max(W * 0.008, 5);   // 내벽
  const sw   = Math.max(W * 0.005, 4);

  ctx.clearRect(0, 0, W, H);

  if (viewStyle === 'styled' || !img) {
    // ① 배경 (그리드 패턴 - 아키스케치 스타일)
    ctx.fillStyle = '#F7F6F2'; ctx.fillRect(0, 0, W, H);
    const gs = Math.round(W / 46);
    ctx.save();
    ctx.strokeStyle = 'rgba(190,188,182,0.45)'; ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= W; gx += gs) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += gs) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();

    // ② 방 바닥재 fill (스트로크 없이 — 벽은 아래에서 엣지로 명시)
    for (const r of roomPolys) {
      const pat = getPattern(ctx, r.name);
      ctx.save();
      ctx.beginPath(); tracePoly(ctx, r.poly);
      ctx.fillStyle = pat; ctx.fill();
      ctx.restore();
    }

    // ③ 창문 (3선 건축 심볼)
    for (const poly of windows) drawWindow(ctx, poly, intW, extW);

    // ④ 외벽 (외곽 엣지만 → 일관된 두께)
    ctx.save();
    ctx.strokeStyle = '#1A1A18';
    ctx.lineWidth = extW * 2;  // 절반이 방 외부에 표시 = extW 두께 벽
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    for (const { p1, p2 } of svgEdges.external) {
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    ctx.restore();

    // ⑤ 내벽 (공유 엣지 → 균일한 선 두께)
    ctx.save();
    ctx.strokeStyle = '#1A1A18';
    ctx.lineWidth = intW;
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    for (const { p1, p2 } of svgEdges.internal) {
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    ctx.restore();
    // 오픈플랜 경계는 그리지 않음 (시각적 연속성 유지)

    // ⑥ 호버 하이라이트
    for (const r of roomPolys) {
      if (hoveredSet.has(r.key)) {
        ctx.save();
        ctx.beginPath(); tracePoly(ctx, r.poly);
        ctx.fillStyle = r.border + '38'; ctx.fill();
        ctx.restore();
      }
    }

    // ⑦ 라벨
    drawLabels(ctx, roomPolys, W, H, false);

  } else {
    // ── 도면 사진 모드 ──
    if (img) ctx.drawImage(img, 0, 0, W, H);

    // 오픈 플랜 그룹 연한 오버레이
    for (const r of roomPolys) {
      if (r.groupIdx !== null && r.groupIdx !== undefined) {
        ctx.save();
        ctx.beginPath(); tracePoly(ctx, r.poly);
        ctx.fillStyle = r.fill + '2E'; ctx.fill();
        ctx.restore();
      }
    }

    // 창문 오버레이
    for (const poly of windows) {
      if (poly.length === 2) {
        ctx.save();
        ctx.strokeStyle = '#64B5F6'; ctx.lineWidth = sw * 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); ctx.lineTo(poly[1][0], poly[1][1]); ctx.stroke();
        ctx.restore();
      } else {
        drawStructPoly(ctx, poly, 'rgba(218,238,255,0.75)', '#64B5F6', sw);
      }
    }

    // 호버 하이라이트
    for (const r of roomPolys) {
      if (hoveredSet.has(r.key)) {
        ctx.save();
        ctx.beginPath(); tracePoly(ctx, r.poly);
        ctx.fillStyle = r.border + '40'; ctx.fill();
        ctx.strokeStyle = r.border; ctx.lineWidth = Math.max(W * 0.005, 3); ctx.stroke();
        ctx.restore();
      }
    }

    // 라벨
    drawLabels(ctx, roomPolys, W, H, true);
  }
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
export default function FloorPlan2D({ data, imageUrl }) {
  const { imgWidth: W, imgHeight: H, walls, windows, rooms } = data;
  const canvasRef = useRef(null);
  const [hovered, setHovered]     = useState(null);
  const [loadedImg, setLoadedImg] = useState(null);
  const [viewStyle, setViewStyle] = useState('styled');

  // 이미지 로드
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
      if (counts[k] === 1) {
        external.push(v);
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
    renderCanvas({ ctx, W, H, roomPolys, svgEdges, windows, walls, img: loadedImg, hoveredSet, viewStyle });
  }, [roomPolys, svgEdges, windows, walls, loadedImg, hoveredSet, viewStyle, W, H]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', gap: 0 }}>

      {/* ── 메인 뷰어 ── */}
      <div style={{
        flex: 1, borderRadius: 16, overflow: 'hidden',
        border: '1px solid #E2E8F0', position: 'relative', background: '#F5F4F0',
      }}>
        {/* Canvas: 실제 렌더링 */}
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />

        {/* SVG 오버레이: 이벤트 감지 전용 (완전 투명) */}
        <svg viewBox={`0 0 ${W} ${H}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {roomPolys.map(r => (
            <polygon key={r.key}
              points={r.poly.map(p => p.join(',')).join(' ')}
              fill="transparent" stroke="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(r.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
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

        {/* 뷰 모드 토글 (이미지 있을 때만) */}
        {imageUrl && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', background: 'rgba(255,255,255,0.95)',
            border: '1px solid #E2E8F0', borderRadius: 10, padding: 3, gap: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {[{ id: 'styled', label: '스타일 뷰' }, { id: 'photo', label: '도면 사진' }].map(m => (
              <button key={m.id} onClick={() => setViewStyle(m.id)} style={{
                padding: '4px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, transition: 'all 0.12s',
                background: viewStyle === m.id ? '#1A1A2E' : 'transparent',
                color: viewStyle === m.id ? 'white' : '#64748B',
              }}>{m.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── 우측 패널 ── */}
      <div style={{ width: 196, marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>

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
      </div>
    </div>
  );
}
