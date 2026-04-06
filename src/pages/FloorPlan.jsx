import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { parseLabels } from '../utils/labelParser';
import { getFloorplanData, getFloorplanIndex } from '../api/floorplan';
import FloorPlan2D from '../components/FloorPlan2D';
import FloorPlan3D from '../components/FloorPlan3D';
import { FURNITURE_CATEGORIES, SIDEBAR_TABS } from '../data/furnitureConfig';

// ── 가구 썸네일 ───────────────────────────────────────────────────
function ThumbModel({ glb }) {
  const { scene } = useGLTF(glb);
  return <primitive object={scene.clone(true)} scale={0.001} />;
}
function FurnitureThumb({ config, size = 80 }) {
  const cam = config.thumbCam || [0.8, 0.75, 1.0];
  return (
    <div style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', background: '#F1F5F9' }}>
      <Canvas camera={{ position: cam, fov: 42 }} gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 3, 2]} intensity={0.7} />
        <Suspense fallback={null}><ThumbModel glb={config.glbClosed} /></Suspense>
      </Canvas>
    </div>
  );
}

const LABEL_KR = { basic: '기본형', expanded: '확장형' };

// ── 방 충돌 감지 ──────────────────────────────────────────────────
const SCALE_3D = 10;

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function isInsideAnyRoom(wx, wz, rooms, W, H) {
  if (!rooms?.length) return true; // 데이터 없으면 통과
  const px = (wx / SCALE_3D + 0.5) * W;
  const py = (wz / SCALE_3D + 0.5) * H;
  return rooms.some(r => pointInPoly(px, py, r.poly));
}

// ── 상단 액션 버튼 ────────────────────────────────────────────────
const ACTIONS = [
  { id: 'rotate', label: '회전',   icon: '↻' },
  { id: 'copy',   label: '복사',   icon: '⧉' },
  { id: 'delete', label: '삭제',   icon: '🗑', danger: true },
];

export default function FloorPlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('3d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 좌측 패널
  const [activeTab, setActiveTab]     = useState(null);
  const [activeSubCat, setActiveSubCat] = useState(null);

  // 가구 배치 상태
  const [placedFurniture, setPlacedFurniture]   = useState([]);
  const [placingFurniture, setPlacingFurniture] = useState(null);
  const [selectedUid, setSelectedUid]           = useState(null);

  // 도면 데이터
  const [index, setIndex]               = useState(null);
  const [selectedComplex, setSelectedComplex] = useState(null);
  const [selectedUnit, setSelectedUnit]   = useState(null);
  const [currentTitle, setCurrentTitle]   = useState('');
  const [imageUrl, setImageUrl]           = useState(null);

  useEffect(() => { getFloorplanIndex().then(setIndex); }, []);

  useEffect(() => {
    if (!index || !location.state?.complexKey) return;
    const { complexKey, area } = location.state;
    const complex = index.find(c => c.complex === complexKey);
    if (!complex) return;
    setSelectedComplex(complexKey);
    let best = null, bestDiff = Infinity;
    for (const unit of complex.units) {
      const num = parseInt(unit.unitType);
      if (!isNaN(num)) { const d = Math.abs(num - area); if (d < bestDiff) { bestDiff = d; best = unit; } }
    }
    if (best) setSelectedUnit(best);
  }, [index, location.state]);

  useEffect(() => {
    if (selectedUnit) loadUnit(selectedUnit);
    else { setData(null); setLoading(false); setImageUrl(null); setCurrentTitle(''); }
  }, [selectedUnit]);

  async function loadUnit(unit) {
    setLoading(true); setData(null);
    setImageUrl(unit.imageFile ? `/floorplans/${selectedComplex}/${unit.imageFile}` : null);
    try {
      const { str, spa } = await getFloorplanData(`/${unit.spaJson}`, `/${unit.strJson}`);
      setData(parseLabels(str, spa));
      const name = (index ?? []).find(c => c.complex === selectedComplex)?.name ?? selectedComplex;
      setCurrentTitle(`${name} · ${unit.unitType}m² ${LABEL_KR[unit.label] ?? unit.label}`);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // 배치 실패 피드백
  const [placeBlocked, setPlaceBlocked] = useState(false);

  // ESC
  useEffect(() => {
    const fn = e => {
      if (e.key !== 'Escape') return;
      setPlacingFurniture(null);
      setSelectedUid(null);
      setPlacedFurniture(p => p.map(f => ({ ...f, selected: false })));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const handlePlace = useCallback((x, z) => {
    if (!placingFurniture) return;
    if (data && !isInsideAnyRoom(x, z, data.rooms, data.imgWidth, data.imgHeight)) {
      setPlaceBlocked(true);
      setTimeout(() => setPlaceBlocked(false), 700);
      return;
    }
    setPlacedFurniture(prev => [...prev, {
      uid: Date.now().toString(), furnitureId: placingFurniture.id,
      config: placingFurniture, x, z, rotation: 0, selected: false,
    }]);
    setPlacingFurniture(null);
  }, [placingFurniture, data]);

  const handleSelectPlaced = useCallback((uid) => {
    setSelectedUid(prev => prev === uid ? null : uid);
    setPlacedFurniture(prev => prev.map(f => ({ ...f, selected: f.uid === uid ? !f.selected : false })));
  }, []);

  const handleRotate = useCallback((uid) => {
    const t = uid ?? selectedUid; if (!t) return;
    setPlacedFurniture(prev => prev.map(f => f.uid === t ? { ...f, rotation: f.rotation + Math.PI / 2 } : f));
  }, [selectedUid]);

  const handleCopy = useCallback(() => {
    if (!selectedUid) return;
    const src = placedFurniture.find(f => f.uid === selectedUid);
    if (!src) return;
    setPlacedFurniture(prev => [...prev, { ...src, uid: Date.now().toString(), x: src.x + 0.6, selected: false }]);
  }, [selectedUid, placedFurniture]);

  const handleDelete = useCallback((uid) => {
    const t = uid ?? selectedUid; if (!t) return;
    setPlacedFurniture(prev => prev.filter(f => f.uid !== t));
    setSelectedUid(null);
  }, [selectedUid]);

  const handleUpdatePosition = useCallback((uid, x, z) => {
    // 방 밖으로 드래그 불가
    if (data && !isInsideAnyRoom(x, z, data.rooms, data.imgWidth, data.imgHeight)) return;
    setPlacedFurniture(prev => prev.map(f => f.uid === uid ? { ...f, x, z } : f));
  }, [data]);

  const clearSelection = () => {
    setSelectedUid(null);
    setPlacedFurniture(p => p.map(f => ({ ...f, selected: false })));
  };

  const activeCatItems = activeTab === 'furniture' && activeSubCat
    ? FURNITURE_CATEGORIES.find(c => c.id === activeSubCat)?.items ?? [] : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: '#EDEEF0',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
    }}>

      {/* ── 상단 툴바 ─────────────────────────────────────────── */}
      <div style={{
        height: 50, flexShrink: 0, background: 'white',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', zIndex: 10,
      }}>
        {/* 뒤로 */}
        <button onClick={() => navigate(-1)} style={backBtnSt}>
          ← <span style={{ fontWeight: 700, marginLeft: 4 }}>빌드어스</span>
        </button>

        <div style={dividerSt} />

        {/* 현재 도면 이름 */}
        {currentTitle && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginRight: 4 }}>
            {currentTitle}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* 선택된 가구 액션 (선택됐을 때만 활성) */}
        {ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => {
              if (a.id === 'rotate') handleRotate();
              else if (a.id === 'copy') handleCopy();
              else if (a.id === 'delete') handleDelete();
            }}
            disabled={!selectedUid}
            title={a.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', border: '1px solid',
              borderColor: !selectedUid ? '#F1F5F9'
                : a.danger ? '#FECACA' : '#E2E8F0',
              borderRadius: 8,
              background: !selectedUid ? 'transparent'
                : a.danger ? '#FEF2F2' : 'white',
              color: !selectedUid ? '#CBD5E1'
                : a.danger ? '#EF4444' : '#374151',
              fontSize: 13, fontWeight: 600,
              cursor: selectedUid ? 'pointer' : 'not-allowed',
              transition: 'all 0.12s',
            }}
          >
            <span style={{ fontSize: 15 }}>{a.icon}</span>
            {a.label}
          </button>
        ))}

        <div style={dividerSt} />

        {/* 2D / 3D */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, gap: 2 }}>
          {[{ id: '2d', label: '2D 평면' }, { id: '3d', label: '3D 뷰' }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
              background: mode === m.id ? 'white' : 'transparent',
              color: mode === m.id ? '#1E293B' : '#94A3B8',
              boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* ── 본문 ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* 좌측 아이콘 스트립 */}
        <div style={{
          width: 56, flexShrink: 0, background: 'white',
          borderRight: '1px solid #E8ECF0',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 12, gap: 4,
        }}>
          {SIDEBAR_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => { setActiveTab(p => p === tab.id ? null : tab.id); setActiveSubCat(null); }}
                title={tab.label}
                style={{
                  width: 44, padding: '8px 0', border: 'none', cursor: 'pointer',
                  borderRadius: 10,
                  background: active ? '#EFF6FF' : 'transparent',
                  color: active ? '#3B82F6' : '#94A3B8',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 20 }}>{tab.emoji}</span>
                <span style={{ fontSize: 9, fontWeight: 700 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 좌측 슬라이딩 패널 */}
        {activeTab && (
          <div style={{
            width: 240, flexShrink: 0, background: 'white',
            borderRight: '1px solid #E8ECF0',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* 헤더 */}
            <div style={{
              padding: '14px 14px 10px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                  {activeSubCat
                    ? FURNITURE_CATEGORIES.find(c => c.id === activeSubCat)?.label
                    : SIDEBAR_TABS.find(t => t.id === activeTab)?.label}
                </div>
                {activeSubCat && (
                  <button onClick={() => setActiveSubCat(null)}
                    style={{ border: 'none', background: 'none', padding: 0, fontSize: 11, color: '#94A3B8', cursor: 'pointer', marginTop: 2 }}>
                    ← 카테고리
                  </button>
                )}
              </div>
              <button onClick={() => { setActiveTab(null); setActiveSubCat(null); }}
                style={{ border: 'none', background: 'none', color: '#CBD5E1', fontSize: 16, cursor: 'pointer', padding: 4 }}>
                ✕
              </button>
            </div>

            {/* 바디 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>

              {/* 가구 카테고리 그리드 */}
              {activeTab === 'furniture' && !activeSubCat && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {FURNITURE_CATEGORIES.map(cat => (
                    <button key={cat.id}
                      onClick={() => cat.items.length > 0 && setActiveSubCat(cat.id)}
                      onMouseEnter={e => { if (cat.items.length > 0) e.currentTarget.style.borderColor = '#93C5FD'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8ECF0'; }}
                      style={{
                        border: '1px solid #E8ECF0', borderRadius: 10,
                        cursor: cat.items.length > 0 ? 'pointer' : 'default',
                        padding: '14px 8px 10px', background: 'white',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        opacity: cat.items.length > 0 ? 1 : 0.4,
                        transition: 'border-color 0.15s',
                      }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: cat.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                      }}>{cat.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{cat.label}</div>
                      {cat.items.length > 0 && <div style={{ fontSize: 10, color: '#94A3B8' }}>{cat.items.length}개</div>}
                    </button>
                  ))}
                </div>
              )}

              {/* 가구 아이템 그리드 */}
              {activeTab === 'furniture' && activeSubCat && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {activeCatItems.map(f => {
                    const isPlacing = placingFurniture?.id === f.id;
                    return (
                      <button key={f.id}
                        onClick={() => {
                          setPlacingFurniture(isPlacing ? null : f);
                          clearSelection();
                        }}
                        style={{
                          border: '2px solid', borderColor: isPlacing ? '#3B82F6' : '#E8ECF0',
                          borderRadius: 10, cursor: 'pointer', padding: '8px 6px 10px',
                          background: isPlacing ? '#EFF6FF' : 'white',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                          transition: 'border-color 0.15s',
                        }}>
                        <FurnitureThumb config={f} size={80} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textAlign: 'center' }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.width * 100 | 0}×{f.depth * 100 | 0}cm</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 다른 탭 — 준비 중 */}
              {activeTab !== 'furniture' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', gap: 8, color: '#94A3B8' }}>
                  <span style={{ fontSize: 32 }}>🚧</span>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>준비 중입니다</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 메인 뷰포트 ──────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>

          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94A3B8' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              도면 분석 중...
            </div>
          ) : !data ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 10 }}>
              <span style={{ fontSize: 40 }}>🏠</span>
              <div style={{ fontWeight: 700, color: '#64748B', fontSize: 16 }}>평면도를 불러와 주세요</div>
              <div style={{ fontSize: 13 }}>아파트 상세 페이지에서 평면도 보기를 선택하세요</div>
            </div>
          ) : mode === '2d' ? (
            <FloorPlan2D
              data={data}
              imageUrl={imageUrl}
              compact
              placedFurniture={placedFurniture}
              placingFurniture={placingFurniture}
              selectedUid={selectedUid}
              onPlace={handlePlace}
              onSelectPlaced={handleSelectPlaced}
              onRotate={handleRotate}
              onDelete={handleDelete}
              onUpdatePosition={handleUpdatePosition}
            />
          ) : (
            <FloorPlan3D
              data={data}
              placedFurniture={placedFurniture}
              placingFurniture={placingFurniture}
              onPlace={handlePlace}
              onSelectPlaced={handleSelectPlaced}
              onUpdatePosition={handleUpdatePosition}
            />
          )}

          {/* 배치 중 힌트 */}
          {placingFurniture && (
            <div style={{
              position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
              background: placeBlocked ? 'rgba(239,68,68,0.9)' : 'rgba(15,23,42,0.82)',
              backdropFilter: 'blur(8px)',
              color: 'white', padding: '8px 22px', borderRadius: 24,
              fontSize: 13, fontWeight: 600, pointerEvents: 'none',
              border: `1px solid ${placeBlocked ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.12)'}`,
              transition: 'background 0.2s',
            }}>
              {placeBlocked
                ? '⚠ 방 안에만 배치할 수 있습니다'
                : <><strong>{placingFurniture.name}</strong> 를 놓을 위치를 클릭하세요 &nbsp;·&nbsp; ESC 취소</>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const backBtnSt = {
  display: 'flex', alignItems: 'center',
  padding: '5px 10px', border: '1px solid #E2E8F0',
  borderRadius: 8, background: 'white', cursor: 'pointer',
  fontSize: 13, color: '#475569', flexShrink: 0,
};
const dividerSt = { width: 1, height: 22, background: '#E8ECF0', flexShrink: 0, margin: '0 4px' };
