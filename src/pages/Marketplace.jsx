import { useState, useMemo } from 'react';
import { getMaterials, getCategories } from '../api/materials';

const GRADE_STYLE = {
  '프리미엄': { background: '#FEF3C7', color: '#92400E' },
  '표준':     { background: '#EFF6FF', color: '#1D4ED8' },
  '-':        { background: '#F1F5F9', color: '#64748B' },
};

export default function Marketplace() {
  const all        = useMemo(() => getMaterials(), []);
  const categories = useMemo(() => ['전체', ...getCategories()], []);

  const [activeCategory, setActiveCategory] = useState('전체');
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('default');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 30;

  const grades = useMemo(() => ['전체', ...new Set(all.map(m => m.등급).filter(Boolean))], [all]);

  const filtered = useMemo(() => {
    let result = all;
    if (activeCategory !== '전체') {
      result = result.filter(m => m.category.startsWith(activeCategory));
    }
    if (gradeFilter !== '전체') {
      result = result.filter(m => m.등급 === gradeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.품명?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.브랜드?.toLowerCase().includes(q) ||
        m.추천공간?.some(s => s.includes(search))
      );
    }
    if (sortBy === 'price_asc')  result = [...result].sort((a, b) => (a.price_num || 0) - (b.price_num || 0));
    if (sortBy === 'price_desc') result = [...result].sort((a, b) => (b.price_num || 0) - (a.price_num || 0));
    return result;
  }, [all, activeCategory, gradeFilter, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleCategoryChange(cat) { setActiveCategory(cat); setPage(1); }
  function handleSearch(v)           { setSearch(v);           setPage(1); }
  function handleGrade(g)            { setGradeFilter(g);      setPage(1); }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자재몰</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          총 {all.length.toLocaleString()}개 자재 · 브랜드·등급·추천공간 기준 필터
        </p>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="품명·카테고리·브랜드·추천공간 검색"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', background: 'white',
          }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}>
          <option value="default">기본순</option>
          <option value="price_asc">가격 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => handleCategoryChange(cat)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
            background: activeCategory === cat ? '#1A1A1A' : '#F1F5F9',
            color: activeCategory === cat ? 'white' : '#475569',
          }}>{cat}</button>
        ))}
      </div>

      {/* 등급 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {grades.map(g => (
          <button key={g} onClick={() => handleGrade(g)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid #E2E8F0', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
            background: gradeFilter === g ? '#3B82F6' : 'white',
            color: gradeFilter === g ? 'white' : '#475569',
          }}>{g}</button>
        ))}
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
        {filtered.length.toLocaleString()}개 항목
        {totalPages > 1 && ` · ${page}/${totalPages} 페이지`}
      </div>

      {/* 자재 테이블 */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['분류', '품명', '브랜드', '등급', '추천공간', '샘플', '단위', '가격'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => (
              <tr key={i}
                style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFAFA'}
              >
                {/* 분류 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 2 }}>
                    {item.대분류}
                  </div>
                  {item.중분류 && (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.중분류}{item.소분류 ? ` › ${item.소분류}` : ''}</div>
                  )}
                </td>

                {/* 품명 */}
                <td style={{ padding: '10px 14px', color: '#1A1A1A', fontWeight: 500, maxWidth: 260 }}>
                  <div style={{ fontSize: 13 }}>{item.품명}</div>
                  {item.규격 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.규격}</div>}
                </td>

                {/* 브랜드 */}
                <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                  <div>{item.브랜드 || '-'}</div>
                  {item.제조사 && item.제조사 !== item.브랜드 && (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.제조사}</div>
                  )}
                </td>

                {/* 등급 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    ...(GRADE_STYLE[item.등급] ?? GRADE_STYLE['-']),
                  }}>{item.등급 || '-'}</span>
                </td>

                {/* 추천공간 */}
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 160 }}>
                    {item.추천공간?.length > 0
                      ? item.추천공간.map(s => (
                          <span key={s} style={{ fontSize: 10, color: '#475569', background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>{s}</span>
                        ))
                      : <span style={{ color: '#CBD5E1' }}>-</span>
                    }
                  </div>
                </td>

                {/* 샘플 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {item.샘플?.가능 === 'Y'
                    ? <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>가능</span>
                    : <span style={{ color: '#CBD5E1', fontSize: 12 }}>-</span>
                  }
                </td>

                {/* 단위 */}
                <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                  {item.판매단위 || item.단위}
                </td>

                {/* 가격 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {item.price !== '-'
                    ? <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{item.price}</span>
                    : <span style={{ color: '#CBD5E1' }}>-</span>
                  }
                  {item.물류?.배송비기준 && (
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{item.물류.배송비기준}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>검색 결과가 없습니다</div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#CBD5E1' : '#475569', fontSize: 13 }}>
            ←
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const pg = page <= 4 ? i + 1 : page - 3 + i;
            if (pg < 1 || pg > totalPages) return null;
            return (
              <button key={pg} onClick={() => setPage(pg)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: pg === page ? 700 : 400, background: pg === page ? '#1A1A1A' : 'white', color: pg === page ? 'white' : '#475569' }}>
                {pg}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#CBD5E1' : '#475569', fontSize: 13 }}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
