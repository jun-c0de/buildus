import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { parseLabels } from '../utils/labelParser';
import { getFloorplanData, getFloorplanIndex } from '../api/floorplan';
import FloorPlan2D from '../components/FloorPlan2D';
import FloorPlan3D from '../components/FloorPlan3D';

const LABEL_KR = { basic: '기본형', expanded: '확장형' };

export default function FloorPlan() {
  const location = useLocation();
  const [mode, setMode] = useState('2d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Floor plan selector state
  const [index, setIndex] = useState(null);        // floorplans_index.json
  const [selectedComplex, setSelectedComplex] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [currentTitle, setCurrentTitle] = useState('AI Hub 건축 도면');
  const [imageUrl, setImageUrl] = useState(null);

  // Load index on mount
  useEffect(() => {
    getFloorplanIndex().then(idx => {
      setIndex(idx);
    });
  }, []);

  // 자동견적에서 넘어온 경우: complexKey + area로 자동 선택
  useEffect(() => {
    if (!index || !location.state?.complexKey) return;
    const { complexKey, area } = location.state;
    const complex = index.find(c => c.complex === complexKey);
    if (!complex) return;
    setSelectedComplex(complexKey);
    // 면적이 가장 가까운 유닛 선택
    let best = null, bestDiff = Infinity;
    for (const unit of complex.units) {
      const num = parseInt(unit.unitType);
      if (!isNaN(num)) {
        const diff = Math.abs(num - area);
        if (diff < bestDiff) { bestDiff = diff; best = unit; }
      }
    }
    if (best) setSelectedUnit(best);
  }, [index, location.state]);

  // Load floor plan data when selection changes (or default on mount)
  useEffect(() => {
    if (selectedUnit) {
      loadUnit(selectedUnit);
    } else {
      // Default: legacy labels
      loadDefault();
    }
  }, [selectedUnit]);

  async function loadDefault() {
    setLoading(true);
    setImageUrl(null);
    try {
      const { str, spa } = await getFloorplanData();
      setData(parseLabels(str, spa));
      setCurrentTitle('APT_FP_105905000 · AI Hub 건축 도면');
    } finally {
      setLoading(false);
    }
  }

  async function loadUnit(unit) {
    setLoading(true);
    setData(null);
    // Set image URL immediately for 2D display — use actual complex folder
    const imgUrl = unit.imageFile ? `/floorplans/${selectedComplex}/${unit.imageFile}` : null;
    setImageUrl(imgUrl);
    try {
      const { str, spa } = await getFloorplanData(`/${unit.spaJson}`, `/${unit.strJson}`);
      setData(parseLabels(str, spa));
      const complexName = (index ?? []).find(c => c.complex === selectedComplex)?.name ?? selectedComplex;
      setCurrentTitle(`${complexName} · ${unit.unitType}m² ${LABEL_KR[unit.label] ?? unit.label}`);
    } catch (e) {
      console.error('도면 로딩 실패:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalArea = data
    ? data.rooms.reduce((s, r) => s + (r.area || 0), 0).toFixed(1)
    : '—';

  const complexList = index ?? [];
  const unitList = complexList.find(c => c.complex === selectedComplex)?.units ?? [];

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 24px', background: 'white', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* 단지 선택 */}
        {complexList.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedComplex ?? ''}
              onChange={e => {
                setSelectedComplex(e.target.value || null);
                setSelectedUnit(null);
              }}
              style={selectStyle}
            >
              <option value="">단지 선택</option>
              {complexList.map(c => (
                <option key={c.complex} value={c.complex}>{c.name ?? c.complex}</option>
              ))}
            </select>

            {selectedComplex && (
              <select
                value={selectedUnit?.id ?? ''}
                onChange={e => {
                  const unit = unitList.find(u => u.id === e.target.value);
                  setSelectedUnit(unit ?? null);
                }}
                style={selectStyle}
              >
                <option value="">타입 선택</option>
                {unitList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unitType} {LABEL_KR[u.label] ?? u.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>평면도 뷰어</h1>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, margin: 0 }}>{currentTitle}</p>
        </div>

        {/* 통계 */}
        {data && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: '전용면적', value: `${totalArea}m²` },
              { label: '공간', value: `${data.rooms.length}개` },
              { label: '벽체', value: `${data.walls.length}개` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 2D/3D 토글 */}
        <div style={{
          display: 'flex', background: '#F1F5F9',
          borderRadius: 10, padding: 3, gap: 2,
        }}>
          {[{ id: '2d', label: '2D 평면' }, { id: '3d', label: '3D 뷰' }].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                background: mode === m.id ? 'white' : 'transparent',
                color: mode === m.id ? '#3B82F6' : '#94A3B8',
                boxShadow: mode === m.id ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
              }}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {/* 뷰어 */}
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12, color: '#94A3B8', fontSize: 14,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '3px solid #E2E8F0', borderTopColor: '#3B82F6',
              animation: 'spin 0.8s linear infinite',
            }} />
            도면 분석 중...
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : !data ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#94A3B8', fontSize: 14,
          }}>
            도면 데이터를 불러올 수 없습니다
          </div>
        ) : mode === '2d' ? (
          <FloorPlan2D data={data} imageUrl={imageUrl} />
        ) : (
          <FloorPlan3D data={data} />
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 13, color: '#334155', background: 'white', cursor: 'pointer',
  outline: 'none',
};
