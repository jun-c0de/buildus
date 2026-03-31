import { useState, useMemo } from 'react';
import { getMaterials, getCategories } from '../api/materials';

export default function Marketplace() {
  const all = useMemo(() => getMaterials(), []);
  const categories = useMemo(() => ['전체', ...getCategories()], []);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    let result = all;
    if (activeCategory !== '전체') {
      result = result.filter(m => m.category.startsWith(activeCategory));
    }
    if (search) {
      result = result.filter(m =>
        m.name.includes(search) ||
        m.category.includes(search) ||
        (m.brand && m.brand.includes(search))
      );
    }
    if (sortBy === 'price_asc')  result = [...result].sort((a, b) => (a.price_num || 0) - (b.price_num || 0));
    if (sortBy === 'price_desc') result = [...result].sort((a, b) => (b.price_num || 0) - (a.price_num || 0));
    return result;
  }, [all, activeCategory, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCategoryChange = (cat) => { setActiveCategory(cat); setPage(1); };
  const handleSearch = (v) => { setSearch(v); setPage(1); };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자재몰</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
          standardunit.kr 표준 단가 기준 · 총 {all.length.toLocaleString()}개 항목
        </p>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="항목명·카테고리 검색"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', background: 'white',
          }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}>
          <option value="default">기본순</option>
          <option value="price_asc">단가 낮은순</option>
          <option value="price_desc">단가 높은순</option>
        </select>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => handleCategoryChange(cat)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
            background: activeCategory === cat ? '#1A1A1A' : '#F1F5F9',
            color: activeCategory === cat ? 'white' : '#475569',
          }}>{cat}</button>
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
              {['카테고리', '항목명', '브랜드', '등급', '단위', '표준단가'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFAFA'}
              >
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#3B82F6',
                    background: '#EFF6FF', padding: '2px 7px', borderRadius: 5,
                  }}>{item.category}</span>
                </td>
                <td style={{ padding: '10px 14px', color: '#1A1A1A', fontWeight: 500, maxWidth: 280 }}>{item.name}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{item.brand || '-'}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{item.grade || '-'}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{item.unit}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{item.price}</td>
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
