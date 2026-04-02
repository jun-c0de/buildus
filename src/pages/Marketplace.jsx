import { useState, useMemo } from 'react';
import { getMaterials, getCategories } from '../api/materials';

// ── localStorage ─────────────────────────────────────────────────────────────
function loadSaved() {
  try { return new Set(JSON.parse(localStorage.getItem('buildus_saved') || '[]')); }
  catch { return new Set(); }
}
function persistSaved(set) {
  localStorage.setItem('buildus_saved', JSON.stringify([...set]));
}

// ── 상수 ─────────────────────────────────────────────────────────────────────
const SPACES = ['거실', '안방', '작은방', '욕실', '주방', '베란다'];
const GRADE_STYLE = {
  '프리미엄': { background: '#FEF3C7', color: '#92400E' },
  '표준':     { background: '#EFF6FF', color: '#1D4ED8' },
  '-':        { background: '#F1F5F9', color: '#64748B' },
};

// ── 이미지 썸네일 ─────────────────────────────────────────────────────────────
function Thumb({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: '#CBD5E1', flexShrink: 0,
      }}>🖼️</div>
    );
  }
  return (
    <img
      src={src} alt={alt}
      onError={() => setErr(true)}
      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }}
    />
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const official     = useMemo(() => getMaterials(), []);
  const officialCats = useMemo(() => getCategories(), []);

  const [savedCodes, setSavedCodes] = useState(loadSaved);

  const [activeCategory, setActiveCategory] = useState('전체');
  const [spaceFilter,    setSpaceFilter]    = useState('전체');
  const [gradeFilter,    setGradeFilter]    = useState('전체');
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('default');
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 30;

  const grades = useMemo(() => {
    return ['전체', ...new Set(official.map(m => m.등급).filter(v => v && v !== '-'))];
  }, [official]);

  const filtered = useMemo(() => {
    let r = official;
    if (activeCategory !== '전체') r = r.filter(m => (m.category ?? '').startsWith(activeCategory));
    if (gradeFilter !== '전체')    r = r.filter(m => (m.등급 ?? m.grade) === gradeFilter);
    if (spaceFilter !== '전체')    r = r.filter(m => (m.추천공간 ?? []).includes(spaceFilter));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m =>
        (m.품명 ?? m.name ?? '').toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q) ||
        (m.브랜드 ?? m.brand ?? '').toLowerCase().includes(q) ||
        (m.추천공간 ?? []).some(s => s.includes(search))
      );
    }
    if (sortBy === 'price_asc')  r = [...r].sort((a, b) => (a.price_num||0)-(b.price_num||0));
    if (sortBy === 'price_desc') r = [...r].sort((a, b) => (b.price_num||0)-(a.price_num||0));
    return r;
  }, [official, activeCategory, gradeFilter, spaceFilter, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function resetPage(fn) { fn(); setPage(1); }

  // ── 담기 / 빼기 ──────────────────────────────────────────────────────────
  function toggleSave(item) {
    setSavedCodes(prev => {
      const next = new Set(prev);
      if (next.has(item.자재코드)) {
        next.delete(item.자재코드);
      } else {
        next.add(item.자재코드);
      }
      persistSaved(next);
      return next;
    });
  }

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────
  const getName  = m => m.품명 ?? m.name ?? '';
  const getBrand = m => m.브랜드 ?? m.brand ?? '';
  const getGrade = m => m.등급 ?? m.grade ?? '-';
  const getPrice = m => m.price ?? '-';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자재몰</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
            공식 자재 {official.length.toLocaleString()}개 · 담은 자재 {savedCodes.size}개
          </p>
        </div>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => resetPage(() => setSearch(e.target.value))}
          placeholder="품명·브랜드·추천공간 검색"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
          <option value="default">기본순</option>
          <option value="price_asc">가격 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>

      {/* 카테고리 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {['전체', ...officialCats].map(cat => (
          <button key={cat} onClick={() => resetPage(() => setActiveCategory(cat))} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: activeCategory === cat ? '#1A1A1A' : '#F1F5F9',
            color: activeCategory === cat ? 'white' : '#475569',
          }}>{cat}</button>
        ))}
      </div>

      {/* 추천공간 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginRight: 2 }}>공간</span>
        {['전체', ...SPACES].map(s => (
          <button key={s} onClick={() => resetPage(() => setSpaceFilter(s))} style={{
            padding: '5px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: spaceFilter === s ? '#3B82F6' : 'white',
            color: spaceFilter === s ? 'white' : '#64748B',
          }}>{s}</button>
        ))}
      </div>

      {/* 등급 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginRight: 2 }}>등급</span>
        {grades.map(g => (
          <button key={g} onClick={() => resetPage(() => setGradeFilter(g))} style={{
            padding: '5px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: gradeFilter === g ? '#1A1A1A' : 'white',
            color: gradeFilter === g ? 'white' : '#64748B',
          }}>{g}</button>
        ))}
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
        {filtered.length.toLocaleString()}개 항목{totalPages > 1 && ` · ${page}/${totalPages} 페이지`}
      </div>

      {/* 테이블 */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['', '분류', '품명', '브랜드', '등급', '추천공간', '단위', '가격', ''].map((h, i) => (
                <th key={i} style={{ padding: '12px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => {
              const saved = savedCodes.has(item.자재코드);
              const rowBg = i % 2 === 0 ? 'white' : '#FAFAFA';
              return (
                <tr key={i}
                  style={{ borderBottom: '1px solid #F1F5F9', background: rowBg, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg}
                >
                  {/* 이미지 썸네일 */}
                  <td style={{ padding: '8px 10px', width: 56 }}>
                    <Thumb src={item.imageUrl ?? null} alt={getName(item)} />
                  </td>

                  {/* 분류 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                      {item.대분류}
                    </div>
                    {item.중분류 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.중분류}{item.소분류 ? ` › ${item.소분류}` : ''}</div>}
                  </td>

                  {/* 품명 */}
                  <td style={{ padding: '8px 10px', maxWidth: 220 }}>
                    <div style={{ fontWeight: 500, color: '#1A1A1A' }}>{getName(item)}</div>
                    {item.규격 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.규격}</div>}
                    {item.설명?.한줄요약 && (
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.설명.한줄요약}</div>
                    )}
                  </td>

                  {/* 브랜드 */}
                  <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>
                    {getBrand(item) || '-'}
                    {item.제조사 && item.제조사 !== item.브랜드 && (
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.제조사}</div>
                    )}
                  </td>

                  {/* 등급 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, ...(GRADE_STYLE[getGrade(item)] ?? GRADE_STYLE['-']) }}>
                      {getGrade(item)}
                    </span>
                  </td>

                  {/* 추천공간 */}
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 140 }}>
                      {(item.추천공간 ?? []).length > 0
                        ? item.추천공간.map(s => (
                            <span key={s} onClick={() => resetPage(() => setSpaceFilter(s))} style={{
                              fontSize: 10, color: spaceFilter === s ? '#1D4ED8' : '#475569',
                              background: spaceFilter === s ? '#EFF6FF' : '#F1F5F9',
                              padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                              border: spaceFilter === s ? '1px solid #BFDBFE' : '1px solid transparent',
                            }}>{s}</span>
                          ))
                        : <span style={{ color: '#CBD5E1' }}>-</span>}
                    </div>
                  </td>

                  {/* 단위 */}
                  <td style={{ padding: '8px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {item.판매단위 || item.단위 || '-'}
                  </td>

                  {/* 가격 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {getPrice(item) !== '-'
                      ? <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{getPrice(item)}</span>
                      : <span style={{ color: '#CBD5E1' }}>-</span>}
                    {item.물류?.배송비기준 && (
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.물류.배송비기준}</div>
                    )}
                  </td>

                  {/* 담기 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => toggleSave(item)} style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: saved ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                      background: saved ? '#EFF6FF' : 'white',
                      color: saved ? '#1D4ED8' : '#475569',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                      {saved ? '✓ 담김' : '+ 담기'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
            <div>검색 결과가 없습니다</div>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page===1?'not-allowed':'pointer', color: page===1?'#CBD5E1':'#475569', fontSize: 13 }}>←</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const pg = page <= 4 ? i+1 : page-3+i;
            if (pg < 1 || pg > totalPages) return null;
            return (
              <button key={pg} onClick={() => setPage(pg)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: pg===page?700:400, background: pg===page?'#1A1A1A':'white', color: pg===page?'white':'#475569' }}>
                {pg}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#CBD5E1':'#475569', fontSize: 13 }}>→</button>
        </div>
      )}
    </div>
  );
}
