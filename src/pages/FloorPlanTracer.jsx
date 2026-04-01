import { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { getFloorplanIndex } from '../api/floorplan';

const SAVE_SERVER = 'http://localhost:3002';
const SNAP_R = 12; // 스냅 반경 (SVG 단위)
const WALL_W = 6;  // 벽 선 두께 (렌더링)

// ── 레이어 설정 ───────────────────────────────────────────────────────────────
const LAYER_ORDER = ['구조_벽체', '공간'];

const LAYER_CFG = {
  '구조_벽체': { label: '① 구조', shortLabel: '구조', stroke: '#37474F', hint: '벽·문·창문 교차점을 클릭 → 자동 연결' },
  '공간':      { label: '② 공간', shortLabel: '공간', stroke: '#2563EB', fill: 'rgba(37,99,235,0.18)', hint: '방 영역을 폴리곤으로 그리세요 — OCR 자동 추천' },
};

// 구조 레이어 드로우 모드 (벽·문·창 통합)
const WALL_MODE_CFG = {
  wall:    { stroke: '#37474F', strokeWidth: 6,   dash: null,    label: '벽',      desc: '벽 세그먼트' },
  door:    { stroke: '#E65100', strokeWidth: 3.5, dash: '10 5',  label: '문',      desc: '여닫이 문 개구부' },
  sliding: { stroke: '#7B3FA0', strokeWidth: 3.5, dash: '4 3',   label: '슬라이딩', desc: '슬라이딩 도어 개구부' },
  window:  { stroke: '#1565C0', strokeWidth: 4,   dash: '2 3',   label: '창호',    desc: '창문 구간' },
};

// ── OCR 매핑 ─────────────────────────────────────────────────────────────────
const OCR_MAP = [
  { patterns: ['거실'],                       catName: '공간_거실',       label: '거실' },
  { patterns: ['침실'],                       catName: '공간_침실',       label: '침실' },
  { patterns: ['주방', '식당', '주방및식당'],  catName: '공간_주방',       label: '주방' },
  { patterns: ['화장실'],                     catName: '공간_화장실',     label: '화장실' },
  { patterns: ['욕실'],                       catName: '공간_욕실',       label: '욕실' },
  { patterns: ['발코니'],                     catName: '공간_발코니',     label: '발코니' },
  { patterns: ['전실', '현관'],               catName: '공간_현관',       label: '현관' },
  { patterns: ['드레스룸', '드레스'],         catName: '공간_드레스룸',   label: '드레스룸' },
  { patterns: ['다목적'],                     catName: '공간_다목적공간', label: '다목적' },
  { patterns: ['실외기'],                     catName: '공간_실외기실',   label: '실외기실' },
];

const SPACE_COLORS = {
  '공간_거실':       { fill: 'rgba(245,240,232,0.55)', stroke: '#E8A030' },
  '공간_침실':       { fill: 'rgba(232,213,168,0.55)', stroke: '#C08030' },
  '공간_주방':       { fill: 'rgba(245,240,232,0.55)', stroke: '#70B070' },
  '공간_화장실':     { fill: 'rgba(200,220,240,0.55)', stroke: '#6090C0' },
  '공간_욕실':       { fill: 'rgba(200,220,240,0.55)', stroke: '#6090C0' },
  '공간_발코니':     { fill: 'rgba(210,220,210,0.45)', stroke: '#70A070' },
  '공간_현관':       { fill: 'rgba(240,230,210,0.55)', stroke: '#C0A060' },
  '공간_드레스룸':   { fill: 'rgba(255,245,200,0.55)', stroke: '#C0B040' },
  '공간_다목적공간': { fill: 'rgba(230,220,210,0.55)', stroke: '#A09080' },
  '공간_실외기실':   { fill: 'rgba(220,225,225,0.45)', stroke: '#90A0A0' },
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function pip([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function inferRoomType(text) {
  const clean = text.replace(/\s/g, '').replace(/[0-9.,]/g, '');
  for (const entry of OCR_MAP) {
    if (entry.patterns.some(p => clean.includes(p))) return entry;
  }
  return null;
}

function svgPt(svgEl, e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}

function ptsStr(pts) { return pts.map(p => p.join(',')).join(' '); }

function centroid(pts) {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function findNearNode(nodes, x, y, r = SNAP_R) {
  let best = null, bestD = r;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) { best = n; bestD = d; }
  }
  return best;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function FloorPlanTracer() {
  const svgRef = useRef(null);

  const [index, setIndex]                     = useState(null);
  const [selectedComplex, setSelectedComplex] = useState(null);
  const [selectedUnit, setSelectedUnit]       = useState(null);
  const [imageUrl, setImageUrl]               = useState(null);
  const [imgSize, setImgSize]                 = useState({ w: 923, h: 676 });

  const [activeLayer, setActiveLayer] = useState('구조_벽체');

  // ── 벽체: 노드+엣지 그래프 ──────────────────────────────────
  const [wallNodes, setWallNodes]           = useState([]); // [{id, x, y}]
  const [wallEdges, setWallEdges]           = useState([]); // [{id, from, to, type}]  type: 'wall'|'door'
  const [activeWallNode, setActiveWallNode] = useState(null);
  const [wallDrawMode, setWallDrawMode]     = useState('wall'); // 'wall' | 'door'

  // ── 공간: 폴리곤 ─────────────────────────────────────────────
  const [polyShapes, setPolyShapes] = useState({ '공간': [] });

  const [drawing, setDrawing]         = useState([]);
  const [mousePos, setMousePos]       = useState(null);
  const [pendingPoly, setPendingPoly] = useState(null);

  const [ocrWords, setOcrWords]   = useState([]);
  const [ocrStatus, setOcrStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // ── 줌/패닝 ──────────────────────────────────────────────────
  const [vb, setVb] = useState({ x: 0, y: 0, w: 923, h: 676 }); // viewBox
  const isPanning   = useRef(false);
  const panLast     = useRef({ x: 0, y: 0 });

  useEffect(() => { getFloorplanIndex().then(setIndex); }, []);

  const complexList = index ?? [];
  const unitList = complexList.find(c => c.complex === selectedComplex)?.units ?? [];

  function selectUnit(unit) {
    setSelectedUnit(unit);
    const url = unit.imageFile ? `/floorplans/${selectedComplex}/${unit.imageFile}` : null;
    setImageUrl(url);
    setWallNodes([]); setWallEdges([]); setActiveWallNode(null); setWallDrawMode('wall');
    setPolyShapes({ '공간': [] });
    setDrawing([]); setOcrWords([]); setOcrStatus('');

    // 이미지 크기 측정 + 기존 str/spa 데이터 로드 (있으면 편집 재개)
    if (url) {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        setImgSize({ w, h });
        setVb({ x: 0, y: 0, w, h });
      };
      img.src = url;
    }

    // 기존 저장 데이터 불러오기
    Promise.all([
      fetch('/' + unit.strJson).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/' + unit.spaJson).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([strData, spaData]) => {
      // str.json: skeleton 노드+엣지
      if (strData?.structure_skeleton) {
        const { nodes, edges } = strData.structure_skeleton;
        setWallNodes(nodes ?? []);
        setWallEdges(edges ?? []);
      }
      // spa.json: 공간 폴리곤
      if (spaData?.annotations?.length) {
        const cats = Object.fromEntries(spaData.categories.map(c => [c.id, c.name]));
        const spaces = spaData.annotations
          .filter(a => cats[a.category_id]?.startsWith('공간_') && cats[a.category_id] !== 'background')
          .map(a => {
            const coords = a.segmentation[0];
            const pts = Array.from({ length: Math.floor(coords.length / 2) }, (_, i) => [coords[i*2], coords[i*2+1]]);
            return {
              id: a.id,
              pts,
              catName: cats[a.category_id],
              label: a.room_name ?? cats[a.category_id].replace(/^공간_/, ''),
              area_m2: a.area_m2 ?? null,
            };
          });
        if (spaces.length > 0) setPolyShapes({ '공간': spaces });
      }
    });
  }

  // ── OCR ────────────────────────────────────────────────────────────────────
  async function runOCR() {
    if (!imageUrl) return;
    setOcrStatus('OCR 실행 중...');
    setOcrWords([]);
    try {
      const worker = await createWorker('kor');
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      const words = (data.words ?? [])
        .filter(w => w.confidence > 40 && w.text.trim().length > 0)
        .map(w => ({
          text: w.text.trim(),
          x: w.bbox.x0, y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0,
        }));
      setOcrWords(words);
      setOcrStatus(`완료 — ${words.length}개 단어`);
    } catch (e) {
      setOcrStatus('실패: ' + e.message);
    }
  }

  // ── 벽체 노드 클릭 처리 ────────────────────────────────────────────────────
  function handleNodeClick(nodeId, e) {
    if (activeLayer !== '구조_벽체') return;
    e?.stopPropagation();

    if (activeWallNode === null) {
      // 시작점 선택
      setActiveWallNode(nodeId);
    } else if (activeWallNode === nodeId) {
      // 같은 점 → 체인 종료
      setActiveWallNode(null);
    } else {
      // 다른 점 → 엣지 생성 후 이 점으로 이동
      const already = wallEdges.some(edge =>
        (edge.from === activeWallNode && edge.to === nodeId) ||
        (edge.from === nodeId && edge.to === activeWallNode)
      );
      if (!already) {
        setWallEdges(prev => [...prev, { id: Date.now(), from: activeWallNode, to: nodeId, type: wallDrawMode }]);
      }
      setActiveWallNode(nodeId);
    }
  }

  function deleteWallNode(nodeId, e) {
    e?.stopPropagation();
    setWallNodes(prev => prev.filter(n => n.id !== nodeId));
    setWallEdges(prev => prev.filter(edge => edge.from !== nodeId && edge.to !== nodeId));
    if (activeWallNode === nodeId) setActiveWallNode(null);
  }

  function deleteWallEdge(edgeId, e) {
    e?.stopPropagation();
    setWallEdges(prev => prev.filter(edge => edge.id !== edgeId));
  }

  // ── SVG 클릭 ───────────────────────────────────────────────────────────────
  function handleSvgClick(e) {
    if (pendingPoly) return;
    const tag = e.target.tagName;

    const { x, y } = svgPt(svgRef.current, e);

    // 벽체 레이어: 노드+엣지 모드
    if (activeLayer === '구조_벽체') {
      if (tag === 'circle') return; // 노드 클릭은 handleNodeClick에서 처리
      const snap = findNearNode(wallNodes, x, y, snapR);
      if (snap) {
        handleNodeClick(snap.id);
        return;
      }
      // 새 노드 생성
      const newNode = { id: Date.now(), x: Math.round(x), y: Math.round(y) };
      setWallNodes(prev => [...prev, newNode]);
      if (activeWallNode !== null) {
        setWallEdges(prev => [...prev, { id: Date.now() + 1, from: activeWallNode, to: newNode.id, type: wallDrawMode }]);
      }
      setActiveWallNode(newNode.id);
      return;
    }

    // 폴리곤 레이어: 창호/출입문/공간
    if (tag === 'polygon' || tag === 'text') return;
    const pt = [Math.round(x), Math.round(y)];

    if (drawing.length >= 3) {
      const [fx, fy] = drawing[0];
      if (Math.hypot(pt[0] - fx, pt[1] - fy) < 14) {
        finishPolygon(drawing);
        return;
      }
    }
    setDrawing(prev => [...prev, pt]);
  }

  function handleSvgMove(e) {
    if (isPanning.current) { handlePanMove(e); return; }
    if (pendingPoly) return;
    const { x, y } = svgPt(svgRef.current, e);
    setMousePos([Math.round(x), Math.round(y)]);
  }

  function handleSvgDblClick(e) {
    if (activeLayer === '구조_벽체') {
      // 더블클릭 → 체인 종료
      setActiveWallNode(null);
      return;
    }
    if (pendingPoly || drawing.length < 3) return;
    e.preventDefault();
    finishPolygon(drawing);
  }

  // ── 폴리곤 완성 ────────────────────────────────────────────────────────────
  function finishPolygon(pts) {
    if (activeLayer === '공간') {
      const inside = ocrWords.filter(w => pip([w.x + w.w / 2, w.y + w.h / 2], pts));
      const inferred = inferRoomType(inside.map(w => w.text).join(' '));
      setPendingPoly({ pts, inferred });
    } else {
      setPolyShapes(prev => ({
        ...prev,
        [activeLayer]: [...prev[activeLayer], { id: Date.now(), pts }],
      }));
    }
    setDrawing([]);
  }

  function confirmSpace(catName, label) {
    if (!pendingPoly) return;
    setPolyShapes(prev => ({
      ...prev,
      '공간': [...prev['공간'], { id: Date.now(), pts: pendingPoly.pts, catName, label }],
    }));
    setPendingPoly(null);
  }

  function deletePolyShape(layer, id) {
    setPolyShapes(prev => ({ ...prev, [layer]: prev[layer].filter(s => s.id !== id) }));
  }

  function cancelDrawing() {
    setDrawing([]);
    setActiveWallNode(null);
    setPendingPoly(null);
  }

  // ── 줌/패닝 ─────────────────────────────────────────────────
  const handleWheel = useCallback(e => {
    e.preventDefault();
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const { x: cx, y: cy } = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    setVb(prev => ({
      x: cx - (cx - prev.x) * factor,
      y: cy - (cy - prev.y) * factor,
      w: prev.w * factor,
      h: prev.h * factor,
    }));
  }, []);

  // wheel 이벤트는 passive:false 필요
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function handlePanDown(e) {
    if (e.button === 1) { // 미들 클릭
      e.preventDefault();
      isPanning.current = true;
      panLast.current = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePanMove(e) {
    if (!isPanning.current) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const dx = (e.clientX - panLast.current.x) * (vb.w / rect.width);
    const dy = (e.clientY - panLast.current.y) * (vb.h / rect.height);
    panLast.current = { x: e.clientX, y: e.clientY };
    setVb(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
  }

  function handlePanUp(e) {
    if (e.button === 1) isPanning.current = false;
  }

  function resetZoom() {
    setVb({ x: 0, y: 0, w: imgSize.w, h: imgSize.h });
  }

  // ── 저장 ───────────────────────────────────────────────────────────────────
  async function saveAll() {
    if (!selectedUnit) return;
    setSaveStatus('저장 중...');
    try {
      const imgEntry = { id: 1, width: imgSize.w, height: imgSize.h, file_name: selectedUnit.imageFile };

      // str.json: 구조 스켈레톤 (엣지 type: wall | door | sliding | window)
      // 각 엣지에 type 필드가 포함되어 있으므로 추가 분류 불필요
      const strJson = {
        structure_skeleton: { nodes: wallNodes, edges: wallEdges },
        categories: [
          { id: 1, name: '구조_벽체' },
          { id: 2, name: '구조_출입문' },
          { id: 3, name: '구조_슬라이딩' },
          { id: 4, name: '구조_창호' },
        ],
        images: [imgEntry],
        annotations: [],
      };

      // spa.json: 공간 폴리곤
      const catSet = new Map();
      polyShapes['공간'].forEach(p => { if (!catSet.has(p.catName)) catSet.set(p.catName, catSet.size + 1); });
      const spaCats = [
        ...Array.from(catSet.entries()).map(([name, id]) => ({ id, name })),
        { id: catSet.size + 1, name: 'background' },
      ];
      const spaAnns = polyShapes['공간'].map((p, i) => {
        const flat = p.pts.flat();
        const xs = p.pts.map(pt => pt[0]), ys = p.pts.map(pt => pt[1]);
        return {
          id: i + 1,
          category_id: catSet.get(p.catName),
          image_id: 1,
          segmentation: [flat],
          area: 0, area_m2: null,
          room_name: p.label,
          bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)],
          iscrowd: 0,
        };
      });
      const spaJson = { categories: spaCats, images: [imgEntry], annotations: spaAnns };

      const spaPath = selectedUnit.spaJson.replace(/^\//, '');
      const strPath = spaPath.replace('_spa.json', '_str.json').replace('spa.json', 'str.json');

      await Promise.all([
        fetch(`${SAVE_SERVER}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: strPath, data: strJson }) }),
        fetch(`${SAVE_SERVER}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: spaPath, data: spaJson }) }),
      ]);
      setSaveStatus('저장 완료!');
    } catch (e) {
      setSaveStatus('저장 실패: ' + e.message);
    }
    setTimeout(() => setSaveStatus(''), 3000);
  }

  // ── 렌더 계산 ──────────────────────────────────────────────────────────────
  const previewPts = mousePos && drawing.length > 0 ? [...drawing, mousePos] : drawing;
  const layerCfg   = LAYER_CFG[activeLayer];

  // 줌 레벨에 따른 동적 스냅 반경 (화면 픽셀 기준 약 12px 유지)
  const snapR = SNAP_R * (vb.w / imgSize.w);

  // 스냅 후보 표시 (벽체 레이어에서 마우스 근처 노드)
  const snapTarget = activeLayer === '구조_벽체' && mousePos
    ? findNearNode(wallNodes, mousePos[0], mousePos[1], snapR)
    : null;

  // 활성 노드 좌표
  const activeNodeData = wallNodes.find(n => n.id === activeWallNode);

  const totalCount = wallNodes.length + wallEdges.length +
    Object.values(polyShapes).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#F1F3F5', overflow: 'hidden' }}>

      {/* ── 사이드바 ── */}
      <div style={{ width: 268, background: '#1E293B', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

        <div style={{ padding: '18px 16px 12px', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #334155' }}>
          도면 트레이서
        </div>

        {/* 단지 선택 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>단지</div>
          <select value={selectedComplex ?? ''} onChange={e => { setSelectedComplex(e.target.value); setSelectedUnit(null); setImageUrl(null); }}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #475569', background: '#0F172A', color: 'white', fontSize: 13 }}>
            <option value=''>선택...</option>
            {complexList.map(c => <option key={c.complex} value={c.complex}>{c.name}</option>)}
          </select>
        </div>

        {/* 타입 선택 */}
        {selectedComplex && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>타입</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unitList.map(u => (
                <button key={u.spaJson} onClick={() => selectUnit(u)}
                  style={{ padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedUnit?.spaJson === u.spaJson ? '#2563EB' : '#334155', color: 'white', fontSize: 13 }}>
                  {u.unitType}m² {u.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 레이어 선택 */}
        {imageUrl && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>작업 레이어</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {LAYER_ORDER.map(key => {
                const cfg = LAYER_CFG[key];
                const count = key === '구조_벽체'
                  ? (wallEdges.length > 0 ? `노드${wallNodes.length} 선${wallEdges.length}` : null)
                  : (polyShapes[key]?.length > 0 ? polyShapes[key].length : null);
                const isActive = activeLayer === key;
                return (
                  <button key={key} onClick={() => { setActiveLayer(key); cancelDrawing(); }}
                    style={{
                      padding: '8px 10px', borderRadius: 6, border: `2px solid ${isActive ? cfg.stroke : 'transparent'}`,
                      cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: isActive ? '#0F172A' : '#334155', color: 'white', fontSize: 13,
                    }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: cfg.stroke, flexShrink: 0 }} />
                      {cfg.label}
                    </span>
                    {count && (
                      <span style={{ fontSize: 10, background: isActive ? cfg.stroke : '#475569', borderRadius: 10, padding: '1px 7px', color: 'white' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 레이어별 작업 힌트 */}
        {imageUrl && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            {activeLayer === '공간' && (
              <div style={{ marginBottom: 10 }}>
                <button onClick={runOCR}
                  style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#0EA5E9', color: 'white', fontSize: 13, fontWeight: 600 }}>
                  OCR 실행 (한글 인식)
                </button>
                {ocrStatus && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>{ocrStatus}</div>}
              </div>
            )}

            {/* 벽체 레이어: 벽/문 모드 토글 */}
            {activeLayer === '구조_벽체' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>그리기 모드</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {(['wall', 'door', 'sliding', 'window']).map(mode => {
                    const mc = WALL_MODE_CFG[mode];
                    const isOn = wallDrawMode === mode;
                    return (
                      <button key={mode} onClick={() => setWallDrawMode(mode)}
                        style={{
                          padding: '8px 4px', borderRadius: 7,
                          border: `2px solid ${isOn ? mc.stroke : '#475569'}`,
                          background: isOn ? mc.stroke : '#334155',
                          color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        }}>
                        {mc.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 5 }}>
                  {WALL_MODE_CFG[wallDrawMode].desc}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.7 }}>
              <div style={{ color: '#CBD5E1', fontWeight: 600, marginBottom: 4 }}>{layerCfg.hint}</div>
              {activeLayer === '구조_벽체' ? (
                <>
                  • 클릭 → 점 찍기 (인접 점에 자동 스냅)<br />
                  • 클릭 → 클릭 → 직선 연결<br />
                  • 같은 점 클릭 or 더블클릭 → 체인 종료<br />
                  • 점 더블클릭 → 점+연결선 삭제<br />
                  • 선 더블클릭 → 선 삭제
                </>
              ) : (
                <>
                  • 클릭으로 꼭짓점 추가<br />
                  • 첫 점 클릭 or 더블클릭으로 완성<br />
                  • 도형 더블클릭 → 삭제
                </>
              )}
              <br />• ESC: 현재 작업 취소
            </div>

            {activeLayer !== '구조_벽체' && drawing.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => setDrawing(prev => prev.slice(0, -1))}
                  style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#475569', color: 'white', fontSize: 12 }}>
                  되돌리기 ({drawing.length}점)
                </button>
                <button onClick={cancelDrawing}
                  style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#7F1D1D', color: 'white', fontSize: 12 }}>
                  취소
                </button>
              </div>
            )}

            {activeLayer === '구조_벽체' && activeWallNode && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setActiveWallNode(null)}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#475569', color: 'white', fontSize: 12 }}>
                  체인 종료 (ESC)
                </button>
              </div>
            )}
          </div>
        )}

        {/* 형상 목록 */}
        {imageUrl && polyShapes['공간'].length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: 11, color: LAYER_CFG['공간'].stroke, fontWeight: 600, marginBottom: 4 }}>
              공간 ({polyShapes['공간'].length})
            </div>
            {polyShapes['공간'].map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 11, flex: 1, color: '#CBD5E1' }}>
                  {s.label}
                  <span style={{ color: '#64748B', marginLeft: 4 }}>({s.pts.length}점)</span>
                </span>
                <button onClick={() => deletePolyShape('공간', s.id)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* 저장 */}
        {totalCount > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
            <button onClick={saveAll}
              style={{ width: '100%', padding: '9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#16A34A', color: 'white', fontSize: 13, fontWeight: 700 }}>
              str.json + spa.json 저장
            </button>
            {saveStatus && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, textAlign: 'center' }}>{saveStatus}</div>}
          </div>
        )}
      </div>

      {/* ── SVG 캔버스 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', gap: 8 }}>
        {!imageUrl ? (
          <div style={{ color: '#94A3B8', fontSize: 15 }}>왼쪽에서 단지와 타입을 선택하세요</div>
        ) : (<>
          {/* 줌 컨트롤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {Math.round(imgSize.w / vb.w * 100)}%
            </span>
            {[
              { label: '+', fn: () => setVb(p => { const f=1/1.25; return { x: p.x+(p.w-p.w*f)/2, y: p.y+(p.h-p.h*f)/2, w:p.w*f, h:p.h*f }; }) },
              { label: '−', fn: () => setVb(p => { const f=1.25; return { x: p.x+(p.w-p.w*f)/2, y: p.y+(p.h-p.h*f)/2, w:p.w*f, h:p.h*f }; }) },
              { label: '⊡', fn: resetZoom },
            ].map(b => (
              <button key={b.label} onClick={b.fn} style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
                background: 'white', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}>{b.label}</button>
            ))}
            <span style={{ fontSize: 10, color: '#CBD5E1' }}>휠=줌 / 미들클릭=이동</span>
          </div>

          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            width={imgSize.w}
            height={imgSize.h}
            style={{
              display: 'block', width: '100%', height: 'auto',
              maxHeight: 'calc(100vh - 140px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              borderRadius: 6, background: 'white',
              cursor: isPanning.current ? 'grabbing'
                : activeLayer === '구조_벽체' ? (snapTarget ? 'pointer' : 'crosshair')
                : (drawing.length > 0 ? 'crosshair' : 'default'),
            }}
            onClick={handleSvgClick}
            onMouseMove={handleSvgMove}
            onMouseDown={handlePanDown}
            onMouseUp={handlePanUp}
            onDoubleClick={handleSvgDblClick}
            onKeyDown={e => { if (e.key === 'Escape') cancelDrawing(); }}
            tabIndex={0}
          >
            {/* 원본 도면 */}
            <image href={imageUrl} x={0} y={0} width={imgSize.w} height={imgSize.h} />

            {/* ── 벽체: 엣지 (type별 스타일) ── */}
            {wallEdges.map(edge => {
              const n1 = wallNodes.find(n => n.id === edge.from);
              const n2 = wallNodes.find(n => n.id === edge.to);
              if (!n1 || !n2) return null;
              const mc = WALL_MODE_CFG[edge.type ?? 'wall'];
              return (
                <g key={edge.id}>
                  {/* 히트 영역 */}
                  <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
                    stroke="transparent" strokeWidth={16}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={ev => deleteWallEdge(edge.id, ev)} />
                  {/* 실제 선 */}
                  <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
                    stroke={mc.stroke} strokeWidth={mc.strokeWidth} strokeLinecap="round"
                    strokeDasharray={mc.dash ?? undefined}
                    style={{ pointerEvents: 'none' }} />
                </g>
              );
            })}

            {/* ── 벽체: 노드 ── */}
            {wallNodes.map(n => {
              const isActive = n.id === activeWallNode;
              const isSnap = snapTarget?.id === n.id;
              return (
                <circle key={n.id}
                  cx={n.x} cy={n.y}
                  r={isActive ? 8 : isSnap ? 9 : 5}
                  fill={isActive ? '#37474F' : isSnap ? 'rgba(55,71,79,0.2)' : 'white'}
                  stroke={isSnap ? '#37474F' : '#37474F'}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ cursor: 'pointer' }}
                  onClick={ev => handleNodeClick(n.id, ev)}
                  onDoubleClick={ev => deleteWallNode(n.id, ev)}
                />
              );
            })}

            {/* 벽체 미리보기 선 (활성 노드 → 마우스, 현재 모드 색상) */}
            {activeLayer === '구조_벽체' && activeNodeData && mousePos && (() => {
              const mc = WALL_MODE_CFG[wallDrawMode];
              return (
                <line
                  x1={activeNodeData.x} y1={activeNodeData.y}
                  x2={snapTarget ? snapTarget.x : mousePos[0]}
                  y2={snapTarget ? snapTarget.y : mousePos[1]}
                  stroke={mc.stroke} strokeWidth={mc.strokeWidth}
                  strokeDasharray="8 4" opacity={0.65}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}

            {/* ── 공간 폴리곤 ── */}
            {polyShapes['공간'].map(s => {
              const c = SPACE_COLORS[s.catName] ?? { fill: 'rgba(200,200,200,0.4)', stroke: '#888' };
              const [cx, cy] = centroid(s.pts);
              const isActive = activeLayer === '공간';
              return (
                <g key={s.id} opacity={isActive ? 1 : 0.5}>
                  <polygon points={ptsStr(s.pts)} fill={c.fill} stroke={c.stroke} strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); deletePolyShape('공간', s.id); }} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    fontSize={13} fontWeight={700} fill="#1A1A18"
                    stroke="rgba(255,255,255,0.9)" strokeWidth={3} paintOrder="stroke">
                    {s.label}
                  </text>
                </g>
              );
            })}

            {/* OCR 하이라이트 */}
            {activeLayer === '공간' && ocrWords.map((w, i) => {
              if (!inferRoomType(w.text)) return null;
              return (
                <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h}
                  fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.6)" strokeWidth={1} rx={2} />
              );
            })}

            {/* ── 폴리곤 그리기 미리보기 ── */}
            {activeLayer !== '구조_벽체' && previewPts.length >= 2 && (
              <polyline points={ptsStr(previewPts)} fill="none"
                stroke={layerCfg.stroke} strokeWidth={2} strokeDasharray="7 3" />
            )}
            {activeLayer !== '구조_벽체' && drawing.length >= 3 && (
              <line
                x1={previewPts[previewPts.length - 1][0]} y1={previewPts[previewPts.length - 1][1]}
                x2={drawing[0][0]} y2={drawing[0][1]}
                stroke={layerCfg.stroke} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4}
              />
            )}
            {activeLayer !== '구조_벽체' && drawing.map((pt, i) => (
              <circle key={i} cx={pt[0]} cy={pt[1]}
                r={i === 0 ? 7 : 4}
                fill={i === 0 ? layerCfg.stroke : 'white'}
                stroke={layerCfg.stroke} strokeWidth={2} />
            ))}
          </svg>
        </>)}
      </div>

      {/* ── 공간 타입 선택 팝업 ── */}
      {pendingPoly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, width: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>공간 타입 선택</div>
            {pendingPoly.inferred ? (
              <div style={{ fontSize: 12, color: '#2563EB', marginBottom: 14, background: '#EFF6FF', borderRadius: 6, padding: '6px 10px' }}>
                OCR 추천: <strong>{pendingPoly.inferred.label}</strong>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>OCR 추천 없음 — 직접 선택하세요</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
              {OCR_MAP.map(entry => {
                const isRec = pendingPoly.inferred?.catName === entry.catName;
                return (
                  <button key={entry.catName} onClick={() => confirmSpace(entry.catName, entry.label)}
                    style={{
                      padding: '9px 8px', borderRadius: 8, border: '2px solid',
                      borderColor: isRec ? '#2563EB' : '#E2E8F0',
                      background: isRec ? '#EFF6FF' : 'white',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      color: isRec ? '#2563EB' : '#334155',
                    }}>
                    {entry.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPendingPoly(null)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#64748B' }}>
              취소 (다시 그리기)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
