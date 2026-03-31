import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApartments } from '../api/apartments';
import { getPricingByProcess, COST_PER_PYEONG, estimateCost } from '../api/materials';

const ALL_PROCESSES = [
  { id: '철거',      label: '철거',      icon: '🔨', desc: '기존 마감재 철거' },
  { id: '목공',      label: '목공',      icon: '🪵', desc: '천장·벽체 목공사' },
  { id: '욕실',      label: '욕실',      icon: '🚿', desc: '욕실 리모델링' },
  { id: '타일',      label: '타일',      icon: '🟦', desc: '욕실·주방 타일' },
  { id: '바닥',      label: '바닥재',    icon: '🏠', desc: '마루·장판 시공' },
  { id: '도배',      label: '도배',      icon: '📋', desc: '벽지·천장 도배' },
  { id: '주방',      label: '주방',      icon: '🍳', desc: '싱크대·주방 공사' },
  { id: '샷시',      label: '창호(샷시)', icon: '🪟', desc: '발코니 샷시 교체' },
  { id: '전기/조명', label: '전기/조명', icon: '💡', desc: '전기·조명 공사' },
  { id: '필름',      label: '필름',      icon: '🎨', desc: '필름·도어 교체' },
];

const GRADE_MULT = { 일반: 0.85, 중급: 1.0, 고급: 1.35 };

export default function CostAnalyzer() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const apts      = useMemo(() => getApartments(), []);

  // 아파트 선택 state
  const initState = location.state;
  const initStep = initState?.aptId && initState?.pyeong ? 3 : initState?.aptId ? 2 : 1;
  const [step, setStep]             = useState(initStep);
  const [selectedAptId, setAptId]   = useState(initState?.aptId ?? null);
  const [selectedType, setType]     = useState(initState?.pyeong ? { area: initState.area, pyeong: initState.pyeong } : null);
  const [aptName, setAptName]       = useState(initState?.aptName ?? '');

  // 공정 설정
  const [checked,  setChecked]  = useState(Object.fromEntries(ALL_PROCESSES.map(p => [p.id, true])));
  const [grades,   setGrades]   = useState(Object.fromEntries(ALL_PROCESSES.map(p => [p.id, '중급'])));
  const [detailId, setDetailId] = useState(null);

  const [floorplanImg, setFloorplanImg] = useState(null);

  // 평면도 이미지 로드 (step 3 진입 시)
  useEffect(() => {
    if (step !== 3 || !selectedType) return;
    setFloorplanImg(null);
    const apt = apts.find(a => a.id === selectedAptId);
    if (!apt) return;
    fetch('/floorplans_index.json')
      .then(r => r.json())
      .then(index => {
        // 해당 단지(complexKey)에서 면적이 가장 가까운 유닛 선택
        const complex = index.find(c => c.complex === apt.complexKey);
        if (!complex) return;
        let best = null;
        let bestDiff = Infinity;
        for (const unit of complex.units) {
          const num = parseInt(unit.unitType);
          if (!isNaN(num)) {
            const diff = Math.abs(num - selectedType.area);
            if (diff < bestDiff) { bestDiff = diff; best = unit; }
          }
        }
        if (best) {
          setFloorplanImg(`/floorplans/${apt.complexKey}/${best.imageFile}`);
        }
      })
      .catch(() => {});
  }, [step, selectedType, selectedAptId]);

  const pyeong = selectedType?.pyeong ?? 25;
  const apt    = apts.find(a => a.id === selectedAptId);

  const processData = ALL_PROCESSES.map(p => {
    const base    = estimateCost(p.id, pyeong);
    const mult    = GRADE_MULT[grades[p.id]] ?? 1;
    const cost    = Math.round(base * mult);
    const items   = getPricingByProcess(p.id);
    return { ...p, cost, items, grade: grades[p.id], checked: checked[p.id] };
  });

  const total       = processData.reduce((s, p) => s + (p.checked ? p.cost : 0), 0);
  const marketTotal = Math.round(total * 1.7);

  function selectApt(apt) {
    setAptId(apt.id);
    setAptName(apt.name);
    setType(null);
    setStep(2);
  }
  function selectType(t) { setType(t); setStep(3); }
  function reset() { setAptId(null); setAptName(''); setType(null); setStep(1); }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자동 견적</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          standardunit.kr 표준 단가 기준 · 단계별로 선택하세요
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {['아파트 선택', '평형 선택', '견적 확인'].map((label, i) => {
          const s = i + 1;
          const active = step === s;
          const done   = step > s;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                onClick={() => done && setStep(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 8,
                  background: active ? '#1A1A1A' : done ? '#EFF6FF' : '#F8FAFC',
                  color: active ? 'white' : done ? '#3B82F6' : '#94A3B8',
                  fontSize: 13, fontWeight: 600,
                  cursor: done ? 'pointer' : 'default',
                  border: `1px solid ${active ? '#1A1A1A' : done ? '#BFDBFE' : '#E2E8F0'}`,
                }}
              >
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
            {apts.map(apt => (
              <div key={apt.id} onClick={() => selectApt(apt)} style={{
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                transition: 'all 0.12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#F8FBFF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏢</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{apt.name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{apt.buildYear}년 · {apt.totalUnits.toLocaleString()}세대 · {apt.nearStation}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {apt.types.map(t => (
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
            {apt.types.map(t => (
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
                <div style={{ marginTop: 12, fontSize: 13, color: '#3B82F6', fontWeight: 600 }}>
                  예상 {((COST_PER_PYEONG['목공'] + COST_PER_PYEONG['바닥'] + COST_PER_PYEONG['도배']) * t.pyeong / 10000).toFixed(0)}만원~
                </div>
              </div>
            ))}
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
              <div style={{ fontSize: 12, color: '#94A3B8' }}>원하는 공정을 선택하고 등급을 조정하세요</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {processData.map(p => (
                <div key={p.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                    borderRadius: 10, border: `1px solid ${p.checked ? '#BFDBFE' : '#E2E8F0'}`,
                    background: p.checked ? '#EFF6FF' : '#FAFAFA', cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}>
                    {/* 체크박스 */}
                    <div onClick={() => setChecked(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                        background: p.checked ? '#3B82F6' : 'white',
                        border: `2px solid ${p.checked ? '#3B82F6' : '#CBD5E1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 800,
                      }}>{p.checked && '✓'}</div>

                    <span style={{ fontSize: 18 }}>{p.icon}</span>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.desc}</div>
                    </div>

                    {/* 등급 선택 */}
                    <select
                      value={grades[p.id]}
                      onChange={e => setGrades(prev => ({ ...prev, [p.id]: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: 'white', cursor: 'pointer' }}
                    >
                      <option value="일반">일반</option>
                      <option value="중급">중급</option>
                      <option value="고급">고급</option>
                    </select>

                    <div style={{ textAlign: 'right', minWidth: 70 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: p.checked ? '#3B82F6' : '#CBD5E1' }}>
                        {p.checked ? `${(p.cost / 10000).toFixed(0)}만원` : '-'}
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{(COST_PER_PYEONG[p.id] / 1000).toFixed(0)}천/평</div>
                    </div>

                    {/* 상세 토글 */}
                    <button onClick={() => setDetailId(detailId === p.id ? null : p.id)}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#64748B', cursor: 'pointer' }}>
                      {detailId === p.id ? '접기' : '상세'}
                    </button>
                  </div>

                  {detailId === p.id && p.items.length > 0 && (
                    <div style={{ margin: '4px 0', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            {['항목명', '등급', '단위', '표준단가'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.slice(0, 15).map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                              <td style={{ padding: '6px 10px', color: '#1A1A1A' }}>{item.name}</td>
                              <td style={{ padding: '6px 10px', color: '#64748B' }}>{item.grade}</td>
                              <td style={{ padding: '6px 10px', color: '#64748B' }}>{item.unit}</td>
                              <td style={{ padding: '6px 10px', color: '#3B82F6', fontWeight: 600 }}>{item.price}</td>
                            </tr>
                          ))}
                          {p.items.length > 15 && (
                            <tr><td colSpan={4} style={{ padding: '6px 10px', color: '#94A3B8', textAlign: 'center' }}>외 {p.items.length - 15}개 항목</td></tr>
                          )}
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
                  <button
                    onClick={() => {
                      const apt = apts.find(a => a.id === selectedAptId);
                      navigate('/floorplan', {
                        state: { complexKey: apt?.complexKey, area: selectedType?.area }
                      });
                    }}
                    style={{ fontSize: 11, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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

              <div style={{ background: '#1A1A1A', borderRadius: 16, padding: 24, color: 'white', marginBottom: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>예상 견적 (표준단가 기준)</div>
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

              {/* 공정별 요약 */}
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12 }}>공정별 비용</div>
                {processData.filter(p => p.checked).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
                    <span style={{ color: '#475569' }}>{p.icon} {p.label}</span>
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
                * standardunit.kr 표준단가 기준<br />실제 비용은 현장 상황에 따라 상이
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
