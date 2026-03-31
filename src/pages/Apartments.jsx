import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApartments } from '../api/apartments';

export default function Apartments() {
  const navigate = useNavigate();
  const all = getApartments();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filtered = all
    .filter(a => a.name.includes(search) || a.address.includes(search))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'year') return b.buildYear - a.buildYear;
      if (sortBy === 'units') return b.totalUnits - a.totalUnits;
      return 0;
    });

  return (
    <div style={{ padding: 32 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>아파트 단지</h1>
        <p style={{ color: '#64748B', marginTop: 4, fontSize: 14 }}>용인시 수지구 상현동 · {all.length}개 단지</p>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="단지명 또는 주소 검색"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            fontSize: 14, outline: 'none', background: 'white',
          }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer',
          }}
        >
          <option value="name">이름순</option>
          <option value="year">최신순</option>
          <option value="units">세대수순</option>
        </select>
      </div>

      {/* 단지 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(apt => (
          <div
            key={apt.id}
            onClick={() => navigate(`/apartments/${apt.id}`)}
            style={{
              background: 'white', borderRadius: 12, border: '1px solid #E2E8F0',
              padding: '20px 24px', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 20,
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            {/* 아이콘 */}
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>🏢</div>

            {/* 정보 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 4 }}>{apt.name}</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{apt.address}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[
                  `${apt.buildYear}년 준공`,
                  `${apt.floors}층`,
                  `${apt.totalUnits.toLocaleString()}세대`,
                  apt.nearStation,
                ].map(tag => (
                  <span key={tag} style={{
                    fontSize: 12, color: '#475569', background: '#F8FAFC',
                    padding: '2px 8px', borderRadius: 4, border: '1px solid #E2E8F0',
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* 평형 */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>평형</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {apt.types.map(t => (
                  <span key={t.pyeong} style={{
                    fontSize: 12, fontWeight: 600, color: '#3B82F6',
                    background: '#EFF6FF', padding: '3px 8px', borderRadius: 6,
                  }}>{t.pyeong}평</span>
                ))}
              </div>
            </div>

            <span style={{ color: '#CBD5E1', fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
          검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}
