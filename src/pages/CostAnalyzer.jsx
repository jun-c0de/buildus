import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApartments } from '../api/apartments';
import {
  getProcesses,
  getProcessMaterials,
  getAreaByPyeong,
  estimateCostByProcess,
  getProcessAreaLabel,
} from '../api/materials';

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
  const [floorplanImg, setFloorplanImg] = useState(null);

  // 공정 목록 로드 후 checked/grades 초기화
  useEffect(() => {
    if (!allProcs.length) return;
    setChecked(prev => Object.fromEntries(allProcs.map(p => [p.공정코드, prev[p.공정코드] ?? true])));
    setGrades(prev  => Object.fromEntries(allProcs.map(p => [p.공정코드, prev[p.공정코드] ?? '중급'])));
  }, [allProcs]);

  // 평면도 로드
  useEffect(() => {
    if (step !== 3 || !selectedType) return;
    setFloorplanImg(null);
    const apt = apts.find(a => a.id === selectedAptId);
    if (!apt) return;
    fetch('/floorplans_index.json')
      .then(r => r.json())
      .then(index => {
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
        if (best) setFloorplanImg(`/floorplans/${apt.complexKey}/${best.imageFile}`);
      })
      .catch(() => {});
  }, [step, selectedType, selectedAptId]);

  const pyeong  = selectedType?.pyeong ?? 25;
  const apt     = apts.find(a => a.id === selectedAptId);
  const areaRef = useMemo(() => getAreaByPyeong(pyeong), [pyeong]);
  const spaces  = areaRef?.공간별면적 ?? {};

  // 공정별 비용 계산
  const processData = useMemo(() => allProcs.map(p => {
    const base  = estimateCostByProcess(p, spaces);
    const mult  = GRADE_MULT[grades[p.공정코드]] ?? 1.0;
    const cost  = Math.round(base * mult);
    return {
      ...p,
      icon:      PROCESS_ICONS[p.공정코드] ?? '⚙️',
      cost,
      materials: getProcessMaterials(p.공정코드),
      grade:     grades[p.공정코드] ?? '중급',
      checked:   checked[p.공정코드] ?? true,
      areaLabel: getProcessAreaLabel(p.공정코드, spaces),
    };
  }), [allProcs, spaces, grades, checked]);

  const total       = processData.reduce((s, p) => s + (p.checked ? p.cost : 0), 0);
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
              <div style={{ fontSize: 12, color: '#94A3B8' }}>
                면적 기준: {areaRef ? `${areaRef.평형대} 참조값` : '직접 입력'} · 원하는 공정을 선택하고 등급을 조정하세요
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {processData.map(p => (
                <div key={p.공정코드}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                    borderRadius: 10, border: `1px solid ${p.checked ? '#BFDBFE' : '#E2E8F0'}`,
                    background: p.checked ? '#EFF6FF' : '#FAFAFA',
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
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{p.areaLabel}</div>
                    </div>

                    {/* 등급 선택 */}
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

                    <div style={{ textAlign: 'right', minWidth: 72 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: p.checked ? '#3B82F6' : '#CBD5E1' }}>
                        {p.checked && p.cost > 0 ? `${(p.cost / 10000).toFixed(0)}만원` : '-'}
                      </div>
                    </div>

                    {/* 상세 토글 */}
                    {p.materials.length > 0 && (
                      <button
                        onClick={() => setDetailId(detailId === p.공정코드 ? null : p.공정코드)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#64748B', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {detailId === p.공정코드 ? '접기' : '자재'}
                      </button>
                    )}
                  </div>

                  {/* 자재 상세 */}
                  {detailId === p.공정코드 && p.materials.length > 0 && (
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
              ))}
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
                {floorplanImg ? (
                  <img src={floorplanImg} alt="평면도" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 180 }} />
                ) : (
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 13 }}>
                    평면도 로딩 중...
                  </div>
                )}
              </div>

              {/* 총 견적 */}
              <div style={{ background: '#1A1A1A', borderRadius: 16, padding: 24, color: 'white', marginBottom: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>예상 견적 (공정별 면적 기반)</div>
                <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1px', marginBottom: 2 }}>
                  {(total / 10000).toFixed(0)}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}>만원</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 16 }}>
                  시중가 약 {(marketTotal / 10000).toFixed(0)}만원 기준
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>💰 예상 절감</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#FCD34D' }}>
                    {((marketTotal - total) / 10000).toFixed(0)}만원
                  </span>
                </div>
              </div>

              {/* 공간별 면적 요약 */}
              {areaRef && (
                <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>공간별 면적 ({areaRef.평형대} 기준)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {Object.entries(spaces).map(([k, v]) => (
                      <div key={k} style={{ background: '#F8FAFC', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{v}㎡</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 공정별 요약 */}
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12 }}>공정별 비용</div>
                {processData.filter(p => p.checked && p.cost > 0).map(p => (
                  <div key={p.공정코드} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>{p.icon} {p.공정명}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{(p.cost / 10000).toFixed(0)}만</span>
                      <span style={{ fontSize: 11, color: '#CBD5E1', marginLeft: 4 }}>{p.grade}</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>합계</span>
                  <span style={{ color: '#3B82F6' }}>{(total / 10000).toFixed(0)}만원</span>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: '#94A3B8', lineHeight: 1.6, textAlign: 'center' }}>
                * 면적 기반 범위 단가 중간값 적용<br />실제 비용은 현장 상황에 따라 상이
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
