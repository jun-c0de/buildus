import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApartments } from '../api/apartments';
import {
  getProcesses,
  getProcessMaterials,
  getAreaByPyeong,
  estimateCostByProcess,
  getProcessAreaLabel,
  getProcessArea,
  getMaterials,
} from '../api/materials';
import { parseLabels } from '../utils/labelParser';
import FloorPlan2D from '../components/FloorPlan2D';

const PROCESS_ICONS = {
  'PROC-01': '🔨', 'PROC-02': '🔧', 'PROC-03': '💡', 'PROC-04': '💧',
  'PROC-05': '🪟', 'PROC-06': '🪵', 'PROC-07': '🎨', 'PROC-08': '🟦',
  'PROC-09': '🖌️', 'PROC-10': '🏠', 'PROC-11': '📋', 'PROC-12': '🍳',
  'PROC-13': '✅',
};

const DIFFICULTY_STYLE = {
  '하': { background: '#D1FAE5', color: '#065F46' },
  '중': { background: '#FEF3C7', color: '#92400E' },
  '상': { background: '#FEE2E2', color: '#991B1B' },
};

const GRADE_MULT = { 일반: 0.85, 중급: 1.0, 고급: 1.35 };

// 공정코드 → 관련 자재 필터 (코드 prefix 기반)
const PROC_MAT_FILTER = {
  'PROC-02': m => m.자재코드?.startsWith('FC'),   // 수전/설비
  'PROC-03': m => m.자재코드?.startsWith('VT'),   // 환기
  'PROC-08': m => m.자재코드?.startsWith('TL'),   // 타일
  'PROC-09': m => m.자재코드?.startsWith('WL'),   // 벽지
  'PROC-10': m => m.자재코드?.startsWith('TL'),   // 바닥 타일
  'PROC-11': m => m.자재코드?.startsWith('WL'),   // 벽지
};

// 자재 선택 모달
function MaterialPickerModal({ proc, spaces, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(0);
  const PAGE_SIZE = 20;

  const allMats = useMemo(() => getMaterials(), []);

  const filtered = useMemo(() => {
    const baseFilter = PROC_MAT_FILTER[proc.공정코드];
    let list = baseFilter ? allMats.filter(baseFilter) : allMats;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.brand?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allMats, proc.공정코드, search]);

  const pages    = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const area = getProcessArea(proc.공정코드, spaces);

  // reset page on search change
  useEffect(() => { setPage(0); }, [search]);

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }}
      />

      {/* 모달 박스 */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(740px, 95vw)', maxHeight: '85vh',
        background: 'white', borderRadius: 20, zIndex: 201,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A' }}>
                {proc.icon} {proc.공정명} · 자재 선택
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                적용 면적 {area > 0 ? `${area.toFixed(1)}㎡` : '—'} · 자재 단가 × 면적으로 비용이 계산돼요
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8', lineHeight: 1, padding: 4 }}>✕</button>
          </div>

          {/* 검색 */}
          <div style={{ marginTop: 14, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }}>🔍</span>
            <input
              autoFocus
              placeholder="자재명, 브랜드, 카테고리 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 14px 9px 36px', borderRadius: 10,
                border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
                background: '#F8FAFC',
              }}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8' }}>
              {filtered.length.toLocaleString()}개
            </span>
          </div>
        </div>

        {/* 자재 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {pageItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 14 }}>검색 결과가 없어요</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {pageItems.map(mat => {
                const estCost = area > 0 && mat.price_num > 0
                  ? Math.round(mat.price_num * area)
                  : null;
                return (
                  <div
                    key={mat.자재코드}
                    onClick={() => onSelect(mat)}
                    style={{
                      padding: '12px 14px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', cursor: 'pointer',
                      transition: 'all 0.1s', background: 'white',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#F8FBFF'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mat.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mat.brand && `${mat.brand} · `}{mat.category}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{mat.price}</span>
                      {estCost != null && (
                        <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, background: '#EFF6FF', padding: '2px 6px', borderRadius: 5 }}>
                          ≈ {(estCost / 10000).toFixed(0)}만원
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {pages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: page === 0 ? '#F8FAFC' : 'white', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, color: page === 0 ? '#CBD5E1' : '#475569' }}>
              ‹
            </button>
            <span style={{ fontSize: 12, color: '#64748B' }}>{page + 1} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: page === pages - 1 ? '#F8FAFC' : 'white', cursor: page === pages - 1 ? 'default' : 'pointer', fontSize: 12, color: page === pages - 1 ? '#CBD5E1' : '#475569' }}>
              ›
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function CostAnalyzer() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const apts      = useMemo(() => getApartments(), []);
  const allProcs  = useMemo(() => getProcesses(), []);

  const initState = location.state;
  const initStep  = initState?.aptId && initState?.pyeong ? 3 : initState?.aptId ? 2 : 1;
  const [step,          setStep]    = useState(initStep);
  const [selectedAptId, setAptId]   = useState(initState?.aptId ?? null);
  const [selectedType,  setType]    = useState(
    initState?.pyeong ? { area: initState.area, pyeong: initState.pyeong } : null
  );
  const [aptName, setAptName] = useState(initState?.aptName ?? '');

  const [checked,   setChecked]   = useState({});
  const [grades,    setGrades]    = useState({});
  const [detailId,  setDetailId]  = useState(null);
  const [floorplanImg,  setFloorplanImg]  = useState(null);
  const [floorplanData, setFloorplanData] = useState(null);

  // 셀프 견적 모드
  const [selfMode,      setSelfMode]     = useState(false);
  const [selectedMats,  setSelectedMats] = useState({});  // { procCode: materialObj }
  const [pickerProc,    setPickerProc]   = useState(null); // processData entry | null
  const [selectedRooms, setSelectedRooms] = useState({});  // { 거실: true, 욕실: false, ... }

  // 공정 목록 로드 후 checked/grades 초기화
  useEffect(() => {
    if (!allProcs.length) return;
    setChecked(prev => Object.fromEntries(allProcs.map(p => [p.공정코드, prev[p.공정코드] ?? true])));
    setGrades(prev  => Object.fromEntries(allProcs.map(p => [p.공정코드, prev[p.공정코드] ?? '중급'])));
  }, [allProcs]);

  // 평면도 로드
  useEffect(() => {
    if (step !== 3 || !selectedType) return;
    let cancelled = false;
    setFloorplanImg(null);
    setFloorplanData(null);

    async function load() {
      const apt = apts.find(a => a.id === selectedAptId);
      if (!apt) return;

      const index = await fetch('/floorplans_index.json').then(r => r.json());
      const complex = index.find(c => c.complex === apt.complexKey);
      if (!complex) return;

      let best = null, bestDiff = Infinity;
      for (const unit of complex.units) {
        const num = parseInt(unit.unitType);
        if (!isNaN(num)) {
          const diff = Math.abs(num - selectedType.area);
          if (diff < bestDiff) { bestDiff = diff; best = unit; }
        }
      }
      if (!best || cancelled) return;

      setFloorplanImg(`/floorplans/${apt.complexKey}/${best.imageFile}`);

      if (best.spaJson && best.strJson) {
        const [strJson, spaJson] = await Promise.all([
          fetch(`/${best.strJson}`).then(r => r.json()),
          fetch(`/${best.spaJson}`).then(r => r.json()),
        ]);
        if (!cancelled) setFloorplanData(parseLabels(strJson, spaJson));
      }
    }

    load().catch(() => {});
    return () => { cancelled = true; };
  }, [step, selectedType?.area, selectedAptId]);

  const pyeong  = selectedType?.pyeong ?? 25;
  const apt     = apts.find(a => a.id === selectedAptId);
  const areaRef = useMemo(() => getAreaByPyeong(pyeong), [pyeong]);
  const spaces  = areaRef?.공간별면적 ?? {};

  // selectedRooms 초기화 (spaces 바뀔 때)
  useEffect(() => {
    const keys = Object.keys(spaces);
    if (!keys.length) return;
    setSelectedRooms(prev =>
      Object.fromEntries(keys.map(k => [k, prev[k] ?? true]))
    );
  }, [JSON.stringify(spaces)]);  // eslint-disable-line

  // 셀프 모드에서 선택된 공간만의 면적
  const selfSpaces = useMemo(() =>
    Object.fromEntries(Object.entries(spaces).filter(([k]) => selectedRooms[k] !== false))
  , [spaces, selectedRooms]);

  // 공정별 비용 계산
  const processData = useMemo(() => allProcs.map(p => {
    const mult  = GRADE_MULT[grades[p.공정코드]] ?? 1.0;
    // 자동 견적 (전체 공간)
    const base  = estimateCostByProcess(p, spaces);
    const cost  = Math.round(base * mult);
    // 셀프 견적용 면적 (선택 공간)
    const selfArea = getProcessArea(p.공정코드, selfSpaces);
    const selfBase = estimateCostByProcess(p, selfSpaces);
    const selfAreaCost = Math.round(selfBase * mult); // 자재 미선택 시 자동계산 but 선택공간만
    // 자재 선택 시 비용
    const selMat = selectedMats[p.공정코드];
    const selfMatCost = selMat && selfArea > 0 && selMat.price_num > 0
      ? Math.round(selMat.price_num * selfArea)
      : null;
    return {
      ...p,
      icon:         PROCESS_ICONS[p.공정코드] ?? '⚙️',
      cost,
      selfAreaCost,
      selfMatCost,
      selfArea,
      materials:    getProcessMaterials(p.공정코드),
      grade:        grades[p.공정코드] ?? '중급',
      checked:      checked[p.공정코드] ?? true,
      areaLabel:    getProcessAreaLabel(p.공정코드, spaces),
      selfAreaLabel: getProcessAreaLabel(p.공정코드, selfSpaces),
      selectedMat:  selMat ?? null,
    };
  }), [allProcs, spaces, selfSpaces, grades, checked, selectedMats]);

  const total = processData.reduce((s, p) => {
    if (!p.checked) return s;
    if (selfMode) {
      if (p.selfMatCost != null) return s + p.selfMatCost;
      return s + p.selfAreaCost;
    }
    return s + p.cost;
  }, 0);
  const marketTotal = Math.round(total * 1.7);

  // Step 2 미리보기 견적 (방수+타일+마루+도배 기준)
  function previewCost(t) {
    const ref  = getAreaByPyeong(t.pyeong);
    const sp   = ref?.공간별면적 ?? {};
    const keys = ['PROC-04', 'PROC-08', 'PROC-10', 'PROC-11'];
    return allProcs
      .filter(p => keys.includes(p.공정코드))
      .reduce((s, p) => s + estimateCostByProcess(p, sp), 0);
  }

  function selectApt(a) { setAptId(a.id); setAptName(a.name); setType(null); setStep(2); }
  function selectType(t) { setType(t); setStep(3); }
  function reset()       { setAptId(null); setAptName(''); setType(null); setStep(1); }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

      {/* 자재 선택 모달 */}
      {pickerProc && (
        <MaterialPickerModal
          proc={pickerProc}
          spaces={selfMode ? selfSpaces : spaces}
          onSelect={mat => {
            setSelectedMats(prev => ({ ...prev, [pickerProc.공정코드]: mat }));
            setPickerProc(null);
          }}
          onClose={() => setPickerProc(null)}
        />
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자동 견적</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          공정별 면적 기반 견적 · 단계별로 선택하세요
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {['아파트 선택', '평형 선택', '견적 확인'].map((label, i) => {
          const s = i + 1;
          const active = step === s, done = step > s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div onClick={() => done && setStep(s)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8,
                background: active ? '#1A1A1A' : done ? '#EFF6FF' : '#F8FAFC',
                color: active ? 'white' : done ? '#3B82F6' : '#94A3B8',
                fontSize: 13, fontWeight: 600,
                cursor: done ? 'pointer' : 'default',
                border: `1px solid ${active ? '#1A1A1A' : done ? '#BFDBFE' : '#E2E8F0'}`,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? 'rgba(255,255,255,0.2)' : done ? '#3B82F6' : '#E2E8F0',
                  color: active ? 'white' : done ? 'white' : '#94A3B8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>{done ? '✓' : s}</span>
                {label}
              </div>
              {i < 2 && <div style={{ width: 20, height: 1, background: '#E2E8F0' }} />}
            </div>
          );
        })}
        {selectedAptId && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
            처음부터
          </button>
        )}
      </div>

      {/* STEP 1: 아파트 선택 */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>
            📍 용인시 수지구 상현동 아파트를 선택하세요
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {apts.map(a => (
              <div key={a.id} onClick={() => selectApt(a)} style={{
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                transition: 'all 0.12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#F8FBFF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏢</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{a.buildYear}년 · {a.totalUnits.toLocaleString()}세대 · {a.nearStation}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {a.types.map(t => (
                    <span key={t.pyeong} style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 7px', borderRadius: 5 }}>{t.pyeong}평</span>
                  ))}
                </div>
                <span style={{ color: '#CBD5E1', fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: 평형 선택 */}
      {step === 2 && apt && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>
            🏢 {apt.name} · 평형을 선택하세요
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {apt.types.map(t => {
              const est = previewCost(t);
              return (
                <div key={t.pyeong} onClick={() => selectType(t)} style={{
                  background: 'white', border: '1px solid #E2E8F0', borderRadius: 14,
                  padding: '24px 20px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#F8FBFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
                >
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px' }}>{t.pyeong}평</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>{t.area}m²</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>방 {t.rooms}개 · 욕실 {t.baths}개</div>
                  {est > 0 && (
                    <div style={{ marginTop: 12, fontSize: 13, color: '#3B82F6', fontWeight: 600 }}>
                      기본공정 {(est / 10000).toFixed(0)}만원~
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: 견적 */}
      {step === 3 && selectedType && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

          {/* 공정 목록 */}
          <div>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{aptName}</div>
                <span style={{ fontSize: 13, color: '#3B82F6', fontWeight: 600 }}>{pyeong}평 ({selectedType.area}m²)</span>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>
                면적 기준: {areaRef ? `${areaRef.평형대} 참조값` : '직접 입력'} · 원하는 공정을 선택하고 등급을 조정하세요
              </div>

              {/* 견적 모드 토글 */}
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, gap: 2 }}>
                <button
                  onClick={() => setSelfMode(false)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                    background: !selfMode ? 'white' : 'transparent',
                    color: !selfMode ? '#1A1A1A' : '#94A3B8',
                    boxShadow: !selfMode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  📊 자동 견적
                </button>
                <button
                  onClick={() => setSelfMode(true)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                    background: selfMode ? '#1A1A1A' : 'transparent',
                    color: selfMode ? 'white' : '#94A3B8',
                    boxShadow: selfMode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  }}
                >
                  🧱 셀프 견적
                </button>
              </div>

              {selfMode && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#64748B', background: '#FFFBEB', borderRadius: 8, padding: '8px 12px', border: '1px solid #FDE68A' }}>
                  원하는 <strong>공간을 선택</strong>하고, 각 공정의 <strong>자재선택</strong> 버튼으로 구체적인 자재를 고르면 자재 단가 × 면적으로 비용이 계산돼요
                </div>
              )}
            </div>

            {/* 셀프 견적 — 공간 선택 */}
            {selfMode && Object.keys(spaces).length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>🏠 어느 공간을 리모델링하나요?</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setSelectedRooms(Object.fromEntries(Object.keys(spaces).map(k => [k, true])))}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #E2E8F0', background: 'white', color: '#475569', cursor: 'pointer' }}>전체 선택</button>
                    <button onClick={() => setSelectedRooms(Object.fromEntries(Object.keys(spaces).map(k => [k, false])))}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #E2E8F0', background: 'white', color: '#94A3B8', cursor: 'pointer' }}>전체 해제</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {Object.entries(spaces).map(([room, area]) => {
                    const on = selectedRooms[room] !== false;
                    const icon = { 거실:'🛋️', 안방:'🛏️', 작은방:'🚪', 욕실:'🚿', 주방:'🍳', 베란다:'🌿' }[room] ?? '📦';
                    return (
                      <div key={room} onClick={() => setSelectedRooms(prev => ({ ...prev, [room]: !on }))}
                        style={{
                          padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: `2px solid ${on ? '#3B82F6' : '#E2E8F0'}`,
                          background: on ? '#EFF6FF' : '#FAFAFA',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: on ? '#1D4ED8' : '#94A3B8' }}>{room}</div>
                        <div style={{ fontSize: 11, color: on ? '#3B82F6' : '#CBD5E1', marginTop: 2 }}>{area}㎡</div>
                        <div style={{ marginTop: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                            background: on ? '#3B82F6' : '#E2E8F0',
                            color: on ? 'white' : '#94A3B8',
                          }}>{on ? '포함' : '제외'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.values(selectedRooms).filter(Boolean).length === 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#F59E0B', background: '#FFFBEB', padding: '8px 12px', borderRadius: 8, border: '1px solid #FDE68A' }}>
                    공간을 하나 이상 선택해야 견적이 계산돼요
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {processData.map(p => {
                const displayCost = selfMode
                  ? (p.selfMatCost != null ? p.selfMatCost : p.selfAreaCost)
                  : p.cost;
                const hasSelfMat = selfMode && p.selectedMat;
                return (
                  <div key={p.공정코드}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      borderRadius: 10, border: `1px solid ${p.checked ? (hasSelfMat ? '#BBF7D0' : '#BFDBFE') : '#E2E8F0'}`,
                      background: p.checked ? (hasSelfMat ? '#F0FDF4' : '#EFF6FF') : '#FAFAFA',
                      transition: 'all 0.12s',
                    }}>
                      {/* 체크박스 */}
                      <div
                        onClick={() => setChecked(prev => ({ ...prev, [p.공정코드]: !prev[p.공정코드] }))}
                        style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                          background: p.checked ? '#3B82F6' : 'white',
                          border: `2px solid ${p.checked ? '#3B82F6' : '#CBD5E1'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 11, fontWeight: 800,
                        }}
                      >{p.checked && '✓'}</div>

                      <span style={{ fontSize: 18 }}>{p.icon}</span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A' }}>{p.공정명}</span>
                          {p.셀프난이도 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                              ...(DIFFICULTY_STYLE[p.셀프난이도] ?? { background: '#F1F5F9', color: '#64748B' }),
                            }}>셀프{p.셀프난이도}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                          {hasSelfMat
                            ? <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ {p.selectedMat.name}</span>
                            : selfMode
                              ? (p.selfArea > 0 ? p.selfAreaLabel : <span style={{ color: '#F59E0B' }}>해당 공간 미포함</span>)
                              : p.areaLabel
                          }
                        </div>
                      </div>

                      {/* 등급 선택 (자동 모드에서만) */}
                      {!selfMode && (
                        <select
                          value={grades[p.공정코드] ?? '중급'}
                          onChange={e => setGrades(prev => ({ ...prev, [p.공정코드]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: 'white', cursor: 'pointer' }}
                        >
                          <option value="일반">일반</option>
                          <option value="중급">중급</option>
                          <option value="고급">고급</option>
                        </select>
                      )}

                      {/* 셀프 모드: 자재 선택 버튼 */}
                      {selfMode && (
                        <button
                          onClick={() => setPickerProc(p)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            border: hasSelfMat ? '1px solid #86EFAC' : '1px solid #BFDBFE',
                            background: hasSelfMat ? '#DCFCE7' : '#EFF6FF',
                            color: hasSelfMat ? '#16A34A' : '#3B82F6',
                            flexShrink: 0, transition: 'all 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          {hasSelfMat ? '변경' : '자재선택'}
                        </button>
                      )}

                      {/* 비용 */}
                      <div style={{ textAlign: 'right', minWidth: 72 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: p.checked ? (hasSelfMat ? '#16A34A' : '#3B82F6') : '#CBD5E1' }}>
                          {p.checked && displayCost > 0 ? `${(displayCost / 10000).toFixed(0)}만원` : '-'}
                        </div>
                        {hasSelfMat && p.selfMatCost != null && (
                          <div style={{ fontSize: 10, color: '#94A3B8', textDecoration: 'line-through' }}>
                            자동 {(p.selfAreaCost / 10000).toFixed(0)}만
                          </div>
                        )}
                      </div>

                      {/* 상세 토글 (자동 모드에서만) */}
                      {!selfMode && p.materials.length > 0 && (
                        <button
                          onClick={() => setDetailId(detailId === p.공정코드 ? null : p.공정코드)}
                          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#64748B', cursor: 'pointer', flexShrink: 0 }}
                        >
                          {detailId === p.공정코드 ? '접기' : '자재'}
                        </button>
                      )}

                      {/* 셀프 모드: 선택된 자재 초기화 */}
                      {selfMode && hasSelfMat && (
                        <button
                          onClick={() => setSelectedMats(prev => { const n = { ...prev }; delete n[p.공정코드]; return n; })}
                          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#94A3B8', cursor: 'pointer', flexShrink: 0 }}
                          title="선택 취소"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* 자재 상세 (자동 모드) */}
                    {!selfMode && detailId === p.공정코드 && p.materials.length > 0 && (
                      <div style={{ margin: '4px 0 4px 28px', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC' }}>
                              {['자재명', '용도', '필수', '단위', '1㎡당 소요량'].map(h => (
                                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {p.materials.map((mat, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                <td style={{ padding: '6px 10px', color: '#1A1A1A', fontWeight: 500 }}>{mat.자재명}</td>
                                <td style={{ padding: '6px 10px', color: '#64748B' }}>{mat.용도}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                    background: mat.필수여부 === '필수' ? '#FEE2E2' : '#F1F5F9',
                                    color: mat.필수여부 === '필수' ? '#991B1B' : '#64748B',
                                  }}>{mat.필수여부}</span>
                                </td>
                                <td style={{ padding: '6px 10px', color: '#64748B' }}>{mat.단위}</td>
                                <td style={{ padding: '6px 10px', color: '#3B82F6', fontWeight: 600 }}>
                                  {mat.실소요량_1m2?.toFixed(3)} {mat.단위}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오른쪽: 결과 카드 */}
          <div>
            <div style={{ position: 'sticky', top: 76 }}>

              {/* 평면도 미리보기 */}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>평면도</span>
                  <button onClick={() => {
                    const a = apts.find(x => x.id === selectedAptId);
                    navigate('/floorplan', { state: { complexKey: a?.complexKey, area: selectedType?.area } });
                  }} style={{ fontSize: 11, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    상세보기 →
                  </button>
                </div>
                {floorplanData ? (
                  <div style={{ height: 220 }}>
                    <FloorPlan2D data={floorplanData} imageUrl={floorplanImg} compact />
                  </div>
                ) : floorplanImg ? (
                  <img src={floorplanImg} alt="평면도" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 180 }} />
                ) : (
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 13 }}>
                    평면도 로딩 중...
                  </div>
                )}
              </div>

              {/* 총 견적 */}
              <div style={{ background: '#1A1A1A', borderRadius: 16, padding: 24, color: 'white', marginBottom: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
                  {selfMode
                    ? `셀프 견적 · ${Object.values(selectedRooms).filter(Boolean).length}개 공간 기준`
                    : '예상 견적 (공정별 면적 기반)'}
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1px', marginBottom: 2 }}>
                  {(total / 10000).toFixed(0)}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}>만원</span>
                </div>
                {!selfMode && (
                  <>
                    <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 16 }}>
                      시중가 약 {(marketTotal / 10000).toFixed(0)}만원 기준
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>💰 예상 절감</span>
                      <span style={{ fontWeight: 800, fontSize: 18, color: '#FCD34D' }}>
                        {((marketTotal - total) / 10000).toFixed(0)}만원
                      </span>
                    </div>
                  </>
                )}
                {selfMode && (
                  <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
                    선택하지 않은 공정은 자동 견적 기준으로 합산
                  </div>
                )}
              </div>

              {/* 공간별 면적 요약 */}
              {areaRef && (
                <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>
                    공간별 면적 ({areaRef.평형대} 기준)
                    {selfMode && <span style={{ marginLeft: 6, fontSize: 10, color: '#3B82F6' }}>● 포함 공간만 집계</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {Object.entries(spaces).map(([k, v]) => {
                      const included = !selfMode || selectedRooms[k] !== false;
                      return (
                        <div key={k} style={{
                          background: included ? '#EFF6FF' : '#F8FAFC',
                          borderRadius: 6, padding: '6px 8px', textAlign: 'center',
                          opacity: included ? 1 : 0.4,
                        }}>
                          <div style={{ fontSize: 10, color: included ? '#3B82F6' : '#94A3B8' }}>{k}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: included ? '#1D4ED8' : '#CBD5E1' }}>{v}㎡</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 공정별 요약 */}
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12 }}>공정별 비용</div>
                {processData.filter(p => p.checked && (selfMode ? (p.selfMatCost != null ? p.selfMatCost : p.selfAreaCost) > 0 : p.cost > 0)).map(p => {
                  const displayCost = selfMode
                    ? (p.selfMatCost != null ? p.selfMatCost : p.selfAreaCost)
                    : p.cost;
                  const hasSelfMat = selfMode && p.selectedMat;
                  return (
                    <div key={p.공정코드} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
                      <span style={{ color: '#475569' }}>{p.icon} {p.공정명}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: hasSelfMat ? '#16A34A' : '#1A1A1A' }}>
                          {(displayCost / 10000).toFixed(0)}만
                        </span>
                        <span style={{ fontSize: 11, color: '#CBD5E1', marginLeft: 4 }}>
                          {hasSelfMat ? '자재선택' : p.grade}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>합계</span>
                  <span style={{ color: '#3B82F6' }}>{(total / 10000).toFixed(0)}만원</span>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: '#94A3B8', lineHeight: 1.6, textAlign: 'center' }}>
                {selfMode
                  ? '* 선택 자재 단가 × 공정 면적 기준\n자재비만 포함, 인건비는 별도'
                  : '* 면적 기반 범위 단가 중간값 적용\n실제 비용은 현장 상황에 따라 상이'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
