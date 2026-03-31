import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { parseLabels, polyToSvgPoints } from '../utils/labelParser';
import { getFloorplanData, getFloorplanIndex } from '../api/floorplan';
import { ROOM_CONFIG } from '../data/roomConfig';

const SAVE_SERVER = 'http://localhost:3001';
const LABEL_KR = { basic: '기본형', expanded: '확장형' };

const ROOM_TYPES = [
  { key: '거실',       id: 1,  catName: '공간_거실' },
  { key: '침실',       id: 2,  catName: '공간_침실' },
  { key: '화장실',     id: 3,  catName: '공간_화장실' },
  { key: '발코니',     id: 4,  catName: '공간_발코니' },
  { key: '주방',       id: 5,  catName: '공간_주방' },
  { key: '현관',       id: 6,  catName: '공간_현관' },
  { key: '드레스룸',   id: 7,  catName: '공간_드레스룸' },
  { key: '다목적공간', id: 8,  catName: '공간_다목적공간' },
  { key: '욕실',       id: 13, catName: '공간_욕실' },
  { key: '실외기실',   id: 14, catName: '공간_실외기실' },
  { key: '기타',       id: 15, catName: '공간_기타' },
];

// 구조 요소 타입 (str.json에 저장됨)
const STRUCT_TYPES = [
  { key: '문',   catName: '구조_출입문', fill: '#FFCC80', border: '#FFA726' },
  { key: '창문', catName: '구조_창호',   fill: '#DAEEFF', border: '#64B5F6' },
];

const STRUCT_KEYS = new Set(STRUCT_TYPES.map(t => t.key));

function roomCfg(name) {
  return ROOM_CONFIG[`공간_${name}`] ?? { fill: '#F5F5F5', border: '#BDBDBD' };
}

// SVG 화면 좌표 → viewBox 좌표 변환
function svgCoords(svgEl, e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const inv = svgEl.getScreenCTM().inverse();
  const p = pt.matrixTransform(inv);
  return [Math.round(p.x), Math.round(p.y)];
}

// 폴리곤 무게중심
function centroid(poly) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return [cx, cy];
}

// 두 점 사이 거리
function dist2(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
}

export default function FloorPlanLabeler() {
  const svgRef = useRef(null);

  // ── 인덱스 / 선택 ──────────────────────────────────────────────
  const [index, setIndex]               = useState(null);
  const [selectedComplex, setSelectedComplex] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [data, setData]                 = useState(null);
  const [imageUrl, setImageUrl]         = useState(null);
  const [loading, setLoading]           = useState(false);

  // ── 편집 상태 ──────────────────────────────────────────────────
  const [mode, setMode]                 = useState('select');   // 'select' | 'draw'
  const [selectedId, setSelectedId]     = useState(null);       // select 모드: 선택된 기존 방 id
  const [corrections, setCorrections]   = useState({});         // { annId: { newName, newCategoryId } }
  const [deletions, setDeletions]       = useState(new Set());  // 삭제할 annId들
  const [additions, setAdditions]       = useState([]);         // 새로 그린 방들
  const [structAdditions, setStructAdditions] = useState([]);   // 새로 그린 문/창문 (str.json에 저장)

  // ── 그리기 상태 ────────────────────────────────────────────────
  const [drawShape, setDrawShape]       = useState('polygon');  // 'polygon' | 'line'
  const [drawPoints, setDrawPoints]     = useState([]);         // 현재 그리는 꼭짓점
  const [mousePos, setMousePos]         = useState(null);       // 마우스 위치 (미리보기용)
  const [pendingPoly, setPendingPoly]   = useState(null);       // 완성 후 타입 지정 대기

  // ── 저장 ──────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus]     = useState(null);

  useEffect(() => { getFloorplanIndex().then(setIndex); }, []);

  const complexList = index ?? [];
  const unitList    = complexList.find(c => c.complex === selectedComplex)?.units ?? [];

  async function loadUnit(unit) {
    setLoading(true);
    setData(null);
    setSelectedId(null);
    setCorrections({}); setDeletions(new Set()); setAdditions([]); setStructAdditions([]);
    setDrawPoints([]); setPendingPoly(null); setMode('select');
    setSaveStatus(null);
    setImageUrl(unit.imageFile ? `/floorplans/${selectedComplex}/${unit.imageFile}` : null);
    try {
      const { str, spa } = await getFloorplanData(`/${unit.spaJson}`, `/${unit.strJson}`);
      setData(parseLabels(str, spa));
    } finally { setLoading(false); }
  }

  useEffect(() => { if (selectedUnit) loadUnit(selectedUnit); }, [selectedUnit]);

  // 현재 표시용 방 목록 (corrections + deletions 반영)
  const rooms = useMemo(() => {
    if (!data) return [];
    return data.rooms
      .filter(r => !deletions.has(r.id))
      .map(r => {
        const c = corrections[r.id];
        return c ? { ...r, displayName: c.newName } : r;
      });
  }, [data, corrections, deletions]);

  const { imgWidth: W = 1, imgHeight: H = 1 } = data ?? {};

  // ── SELECT 모드: 방 클릭 ──────────────────────────────────────
  function handleRoomClick(id) {
    if (mode !== 'select') return;
    setSelectedId(prev => prev === id ? null : id);
  }

  function handleRoomRightClick(e, id) {
    e.preventDefault();
    if (mode !== 'select') return;
    setDeletions(prev => { const s = new Set(prev); s.add(id); return s; });
    setSelectedId(null);
  }

  // 추가된 방 우클릭 삭제
  function handleAdditionRightClick(e, tempId) {
    e.preventDefault();
    setAdditions(prev => prev.filter(a => a.tempId !== tempId));
  }

  function applyCorrection(annId, newName) {
    setCorrections(prev => ({
      ...prev,
      [annId]: { newName, newCategoryId: ROOM_TYPES.find(t => t.key === newName)?.id ?? 8 },
    }));
    setSelectedId(null);
  }

  // ── DRAW 모드: SVG 마우스 이벤트 ─────────────────────────────
  const handleSvgMouseMove = useCallback((e) => {
    if (mode !== 'draw' || !svgRef.current) return;
    setMousePos(svgCoords(svgRef.current, e));
  }, [mode]);

  const handleSvgClick = useCallback((e) => {
    if (mode !== 'draw' || !svgRef.current) return;
    if (e.target.tagName === 'polygon' || e.target.tagName === 'text' || e.target.tagName === 'line') return;

    const pt = svgCoords(svgRef.current, e);

    setDrawPoints(prev => {
      // 선 모드: 두 번째 클릭에 자동 완성
      if (drawShape === 'line' && prev.length === 1) {
        finishPolygon([prev[0], pt]);
        return [];
      }
      // 폴리곤 모드: 첫 꼭짓점에 가까우면 닫기
      if (drawShape === 'polygon' && prev.length >= 3 && dist2(pt, prev[0]) < Math.max(W, H) * 0.015) {
        finishPolygon(prev);
        return [];
      }
      return [...prev, pt];
    });
  }, [mode, drawShape, W, H]);

  const handleSvgDblClick = useCallback((e) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    setDrawPoints(prev => {
      if (prev.length >= 3) { finishPolygon(prev); return []; }
      return prev;
    });
  }, [mode]);

  function finishPolygon(pts) {
    setMousePos(null);
    setPendingPoly(pts);
  }

  function confirmAddition(newName) {
    if (!pendingPoly) return;
    if (STRUCT_KEYS.has(newName)) {
      // 구조 요소(문/창문) → structAdditions에 별도 저장
      const st = STRUCT_TYPES.find(t => t.key === newName);
      setStructAdditions(prev => [...prev, {
        tempId: `struct_${Date.now()}`,
        poly: pendingPoly,
        key: newName,
        catName: st.catName,
        fill: st.fill,
        border: st.border,
      }]);
    } else {
      const id = ROOM_TYPES.find(t => t.key === newName)?.id ?? 8;
      setAdditions(prev => [...prev, {
        tempId: `new_${Date.now()}`,
        poly: pendingPoly,
        newName, newCategoryId: id,
      }]);
    }
    setPendingPoly(null);
  }

  function cancelDraw() {
    setDrawPoints([]); setMousePos(null); setPendingPoly(null);
  }

  // ── 저장 ──────────────────────────────────────────────────────
  const totalChanges = Object.keys(corrections).length + deletions.size + additions.length + structAdditions.length;

  async function saveAll() {
    if (!selectedUnit || totalChanges === 0) return;
    setSaveStatus('saving');
    try {
      const payload = {
        complex:   selectedComplex,
        stem:      selectedUnit.id,
        imageFile: selectedUnit.imageFile,
        corrections: Object.entries(corrections).map(([id, c]) => ({
          annId: parseInt(id), newName: c.newName, newCategoryId: c.newCategoryId,
        })),
        deletions: [...deletions],
        additions: additions.map(a => ({
          poly: a.poly, newName: a.newName, newCategoryId: a.newCategoryId,
        })),
        structAdditions: structAdditions.map(a => ({
          poly: a.poly, catName: a.catName,
        })),
      };
      const res = await fetch(`${SAVE_SERVER}/save-corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  }

  const selectedRoom  = selectedId != null ? rooms.find(r => r.id === selectedId) : null;

  // 그리기 중 미리보기 경로
  const previewPoints = mousePos && drawPoints.length > 0
    ? [...drawPoints, mousePos]
    : drawPoints;

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── 헤더 ── */}
      <div style={{
        padding: '8px 16px', background: '#1E293B', borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14 }}>✏️ 라벨 수정</span>

        <select value={selectedComplex ?? ''} onChange={e => { setSelectedComplex(e.target.value || null); setSelectedUnit(null); }} style={selStyle}>
          <option value="">단지 선택</option>
          {complexList.map(c => <option key={c.complex} value={c.complex}>{c.name ?? c.complex}</option>)}
        </select>

        {selectedComplex && (
          <select value={selectedUnit?.id ?? ''} onChange={e => setSelectedUnit(unitList.find(u => u.id === e.target.value) ?? null)} style={selStyle}>
            <option value="">타입 선택</option>
            {unitList.map(u => <option key={u.id} value={u.id}>{u.unitType} {LABEL_KR[u.label] ?? u.label}</option>)}
          </select>
        )}

        {/* 모드 토글 */}
        {data && (
          <div style={{ display: 'flex', background: '#334155', borderRadius: 8, padding: 2, gap: 2, marginLeft: 8 }}>
            {[
              { id: 'select', label: '🖱 선택/수정' },
              { id: 'draw',   label: '✏️ 영역 추가' },
            ].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setSelectedId(null); cancelDraw(); setDrawShape('polygon'); }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: mode === m.id ? (m.id === 'draw' ? '#7C3AED' : '#2563EB') : 'transparent',
                  color: mode === m.id ? 'white' : '#94A3B8',
                }}>{m.label}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {data && (
          <button onClick={() => {
            if (!window.confirm('모든 방 영역을 삭제하고 처음부터 시작할까요?')) return;
            const allIds = new Set(data.rooms.map(r => r.id));
            setDeletions(allIds);
            setCorrections({});
            setAdditions([]);
            setSelectedId(null);
          }}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #EF4444', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: 'transparent', color: '#EF4444' }}>
            전체 초기화
          </button>
        )}

        {totalChanges > 0 && (
          <span style={{ color: '#FCD34D', fontSize: 12, fontWeight: 600 }}>
            수정 {Object.keys(corrections).length} · 삭제 {deletions.size} · 추가 {additions.length}
          </span>
        )}

        <button onClick={saveAll} disabled={totalChanges === 0 || saveStatus === 'saving'}
          style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            background: totalChanges === 0 ? '#475569' : '#22C55E', color: 'white',
            opacity: totalChanges === 0 ? 0.5 : 1,
          }}>
          {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'ok' ? '✓ 저장됨' : saveStatus === 'error' ? '⚠️ 실패' : '💾 저장'}
        </button>
      </div>

      {/* ── 모드 안내 배너 ── */}
      {data && (
        <div style={{ background: mode === 'draw' ? '#4C1D95' : '#0F172A', color: '#94A3B8', fontSize: 12, padding: '5px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          {mode === 'select' ? (
            <span>🖱 클릭: 타입 변경   |   우클릭: 영역 삭제   |   node save-server.js 실행 필요</span>
          ) : (
            <>
              {/* 선/폴리곤 토글 */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: 2, gap: 2 }}>
                {[{ id: 'polygon', label: '▱ 영역' }, { id: 'line', label: '╱ 선' }].map(s => (
                  <button key={s.id} onClick={() => { setDrawShape(s.id); cancelDraw(); }}
                    style={{
                      padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      background: drawShape === s.id ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: drawShape === s.id ? 'white' : '#A78BFA',
                    }}>{s.label}</button>
                ))}
              </div>
              <span>
                {drawShape === 'line'
                  ? drawPoints.length === 0
                    ? '📏 시작점 클릭'
                    : '📏 끝점 클릭 → 자동 완성  |  ESC 취소'
                  : drawPoints.length === 0
                    ? '✏️ 클릭으로 꼭짓점 추가 → 더블클릭 또는 첫 점 클릭으로 완성'
                    : `✏️ 꼭짓점 ${drawPoints.length}개 | 더블클릭 또는 첫 점 클릭으로 완성 | ESC 취소`
                }
              </span>
            </>
          )}
        </div>
      )}

      {/* ── 메인 ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

        {/* 도면 영역 */}
        <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
          {loading ? (
            <CenterMsg>로딩 중...</CenterMsg>
          ) : !data ? (
            <CenterMsg>단지와 타입을 선택하세요</CenterMsg>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#F0F4F8', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', position: 'relative' }}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: '100%', height: '100%', display: 'block', cursor: mode === 'draw' ? 'crosshair' : 'default' }}
                preserveAspectRatio="xMidYMid meet"
                onClick={handleSvgClick}
                onDoubleClick={handleSvgDblClick}
                onMouseMove={handleSvgMouseMove}
                onKeyDown={e => e.key === 'Escape' && cancelDraw()}
                tabIndex={0}
              >
                {imageUrl && <image href={imageUrl} x="0" y="0" width={W} height={H} />}

                {/* 기존 방 오버레이 */}
                {rooms.map(r => {
                  const cfg       = roomCfg(r.displayName);
                  const isSelected = selectedId === r.id;
                  const isCorrected = !!corrections[r.id];
                  const pts = polyToSvgPoints(r.poly);
                  return (
                    <g key={r.id}>
                      <polygon points={pts}
                        fill={isSelected ? cfg.border : isCorrected ? '#F59E0B' : cfg.fill}
                        fillOpacity={isSelected ? 0.55 : isCorrected ? 0.50 : 0.40}
                        stroke={isSelected ? cfg.border : isCorrected ? '#F59E0B' : cfg.border}
                        strokeWidth={isSelected ? Math.max(W*0.005,3) : Math.max(W*0.003,1.5)}
                        style={{ cursor: mode === 'select' ? 'pointer' : 'default' }}
                        onClick={e => { e.stopPropagation(); handleRoomClick(r.id); }}
                        onContextMenu={e => handleRoomRightClick(e, r.id)}
                      />
                      <text x={r.cx} y={r.cy} textAnchor="middle" dominantBaseline="middle"
                        fontSize={Math.min(W,H)*0.022} fontWeight="700"
                        fill="white" stroke="rgba(0,0,0,0.55)" strokeWidth="3" paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}
                        fontFamily="'Pretendard','Malgun Gothic',sans-serif">
                        {r.displayName}
                      </text>
                    </g>
                  );
                })}

                {/* 새로 추가된 구조 요소 (문/창문) */}
                {structAdditions.map(a => {
                  const isLine = a.poly.length === 2;
                  const [cx, cy] = isLine
                    ? [(a.poly[0][0]+a.poly[1][0])/2, (a.poly[0][1]+a.poly[1][1])/2]
                    : centroid(a.poly);
                  const sw = Math.max(W*0.005, 3);
                  const onRightClick = e => { e.preventDefault(); setStructAdditions(prev => prev.filter(x => x.tempId !== a.tempId)); };
                  return (
                    <g key={a.tempId}>
                      {isLine ? (
                        <line
                          x1={a.poly[0][0]} y1={a.poly[0][1]}
                          x2={a.poly[1][0]} y2={a.poly[1][1]}
                          stroke={a.border} strokeWidth={sw * 3}
                          strokeLinecap="round" strokeDasharray="8 4"
                          style={{ cursor: 'pointer' }}
                          onContextMenu={onRightClick}
                        />
                      ) : (
                        <polygon points={a.poly.map(p => p.join(',')).join(' ')}
                          fill={a.fill} fillOpacity={0.6}
                          stroke={a.border} strokeWidth={sw}
                          strokeDasharray="4 2"
                          style={{ cursor: 'pointer' }}
                          onContextMenu={onRightClick}
                        />
                      )}
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                        fontSize={Math.min(W,H)*0.022} fontWeight="800"
                        fill="white" stroke="rgba(0,0,0,0.65)" strokeWidth="3" paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}
                        fontFamily="'Pretendard','Malgun Gothic',sans-serif">
                        {a.key}
                      </text>
                    </g>
                  );
                })}

                {/* 새로 추가된 방들 */}
                {additions.map(a => {
                  const cfg = roomCfg(a.newName);
                  const [cx, cy] = centroid(a.poly);
                  const pts = a.poly.map(p => p.join(',')).join(' ');
                  return (
                    <g key={a.tempId}>
                      <polygon points={pts}
                        fill={cfg.border} fillOpacity={0.3}
                        stroke={cfg.border} strokeWidth={Math.max(W*0.004,2)}
                        strokeDasharray="6 3"
                        style={{ cursor: 'pointer' }}
                        onContextMenu={e => handleAdditionRightClick(e, a.tempId)}
                      />
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                        fontSize={Math.min(W,H)*0.022} fontWeight="800"
                        fill="white" stroke="rgba(0,0,0,0.65)" strokeWidth="3" paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}
                        fontFamily="'Pretendard','Malgun Gothic',sans-serif">
                        {a.newName}
                      </text>
                    </g>
                  );
                })}

                {/* 그리기 미리보기 */}
                {previewPoints.length >= 2 && (
                  <polyline
                    points={previewPoints.map(p => p.join(',')).join(' ')}
                    fill="none" stroke="#7C3AED" strokeWidth={Math.max(W*0.003,2)}
                    strokeDasharray="8 4"
                  />
                )}
                {drawPoints.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={Math.max(W*0.006,4)}
                    fill={i === 0 ? '#7C3AED' : '#A78BFA'} stroke="white" strokeWidth="2"
                  />
                ))}
                {/* 첫 점 클로즈 힌트 */}
                {drawPoints.length >= 3 && mousePos && dist2(mousePos, drawPoints[0]) < Math.max(W,H)*0.03 && (
                  <circle cx={drawPoints[0][0]} cy={drawPoints[0][1]}
                    r={Math.max(W*0.012,8)} fill="none" stroke="#22C55E" strokeWidth="3" />
                )}
              </svg>
            </div>
          )}
        </div>

        {/* ── 우측 패널 ── */}
        <div style={{ width: 210, borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', background: 'white', flexShrink: 0 }}>

          {/* SELECT: 선택된 방 편집 / DRAW: 완성 후 타입 지정 */}
          {pendingPoly ? (
            <TypeSelector title="새 영역 타입 지정" onSelect={confirmAddition} onCancel={() => setPendingPoly(null)} showStruct />
          ) : selectedRoom ? (
            <TypeSelector title={`변경: ${selectedRoom.displayName}`} onSelect={name => applyCorrection(selectedRoom.id, name)} onCancel={() => setSelectedId(null)} current={selectedRoom.displayName} />
          ) : (
            <div style={{ padding: 14, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
                {mode === 'select'
                  ? <>클릭 → 타입 변경<br />우클릭 → 영역 삭제</>
                  : <>클릭으로 꼭짓점 추가<br />더블클릭으로 완성</>
                }
              </div>
            </div>
          )}

          {/* 방 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
            <SectionLabel>감지된 방 ({rooms.length})</SectionLabel>
            {rooms.map(r => {
              const isSelected  = selectedId === r.id;
              const isCorrected = !!corrections[r.id];
              const cfg = roomCfg(r.displayName);
              return (
                <RoomRow key={r.id} label={r.displayName} area={r.area_m2} dot={cfg.border}
                  isSelected={isSelected} badge={isCorrected ? '수정' : null} badgeColor="#F59E0B"
                  onClick={() => handleRoomClick(r.id)}
                  onRightClick={e => handleRoomRightClick(e, r.id)}
                />
              );
            })}

            {additions.length > 0 && <>
              <SectionLabel style={{ marginTop: 10 }}>추가됨 ({additions.length})</SectionLabel>
              {additions.map(a => {
                const cfg = roomCfg(a.newName);
                return (
                  <RoomRow key={a.tempId} label={a.newName} dot={cfg.border}
                    badge="신규" badgeColor="#7C3AED"
                    onRightClick={e => handleAdditionRightClick(e, a.tempId)}
                  />
                );
              })}
            </>}

            {structAdditions.length > 0 && <>
              <SectionLabel style={{ marginTop: 10 }}>구조 요소 ({structAdditions.length})</SectionLabel>
              {structAdditions.map(a => {
                const st = STRUCT_TYPES.find(t => t.key === a.key);
                return (
                  <RoomRow key={a.tempId} label={a.key} dot={st?.border ?? '#999'}
                    badge="신규" badgeColor="#0EA5E9"
                    onRightClick={e => { e.preventDefault(); setStructAdditions(prev => prev.filter(x => x.tempId !== a.tempId)); }}
                  />
                );
              })}
            </>}

            {deletions.size > 0 && <>
              <SectionLabel style={{ marginTop: 10, color: '#EF4444' }}>삭제 예정 ({deletions.size})</SectionLabel>
              {[...deletions].map(id => {
                const r = data.rooms.find(x => x.id === id);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, marginBottom: 3, background: '#FEF2F2' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#EF4444', textDecoration: 'line-through' }}>{r?.displayName ?? '?'}</span>
                    <button onClick={() => setDeletions(prev => { const s = new Set(prev); s.delete(id); return s; })}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 11, padding: 0 }}>되돌리기</button>
                  </div>
                );
              })}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────────────

function TypeSelector({ title, onSelect, onCancel, current, showStruct = false }) {
  return (
    <div style={{ padding: 14, borderBottom: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ROOM_TYPES.map(t => (
          <button key={t.key} onClick={() => onSelect(t.key)}
            style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
              cursor: 'pointer', fontSize: 12, textAlign: 'left',
              background: current === t.key ? '#EFF6FF' : 'white',
              color: current === t.key ? '#2563EB' : '#334155',
              fontWeight: current === t.key ? 700 : 400,
            }}>{t.key}</button>
        ))}
        {showStruct && <>
          <div style={{ margin: '4px 0 2px', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>── 구조 요소 ──</div>
          {STRUCT_TYPES.map(t => (
            <button key={t.key} onClick={() => onSelect(t.key)}
              style={{
                padding: '6px 10px', borderRadius: 6, border: `1px solid ${t.border}`,
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
                background: t.fill, color: '#334155', fontWeight: 600,
              }}>{t.key}</button>
          ))}
        </>}
      </div>
      <button onClick={onCancel} style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', fontSize: 11, color: '#64748B' }}>취소</button>
    </div>
  );
}

function RoomRow({ label, area, dot, isSelected, badge, badgeColor, onClick, onRightClick }) {
  return (
    <div onClick={onClick} onContextMenu={onRightClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 6, cursor: onClick ? 'pointer' : 'default', marginBottom: 3, background: isSelected ? '#EFF6FF' : 'transparent', border: `1.5px solid ${isSelected ? dot : 'transparent'}` }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: dot, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: '#334155', fontWeight: isSelected ? 700 : 400 }}>{label}</span>
      {area != null && <span style={{ fontSize: 10, color: '#94A3B8' }}>{area}m²</span>}
      {badge && <span style={{ fontSize: 10, color: badgeColor, fontWeight: 700 }}>{badge}</span>}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 5, letterSpacing: '0.06em', ...style }}>{children}</div>;
}

function CenterMsg({ children }) {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>{children}</div>;
}

const selStyle = {
  padding: '5px 10px', border: '1px solid #475569', borderRadius: 7,
  fontSize: 13, color: '#F1F5F9', background: '#334155', cursor: 'pointer',
};
