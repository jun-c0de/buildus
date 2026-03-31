import { useState } from 'react';

const CATEGORIES = [
  { id: 'all',     label: '전체',      icon: '📋' },
  { id: 'review',  label: '시공후기',   icon: '⭐' },
  { id: 'quote',   label: '견적공유',   icon: '💰' },
  { id: 'qna',     label: 'Q&A',       icon: '💬' },
  { id: 'material',label: '자재추천',   icon: '🧱' },
  { id: 'apt',     label: '아파트별',   icon: '🏢' },
];

const POSTS = [
  { id:1, category:'review',   title:'25평 전체 인테리어 완성 후기 (비용 포함)',  author:'인테리어고수',  date:'2026-03-28', views:1243, comments:34, hot:true },
  { id:2, category:'quote',    title:'상현마을 휴먼시아 84m² 견적 비교 공유합니다', author:'절약왕',       date:'2026-03-27', views:876,  comments:21, hot:true },
  { id:3, category:'qna',      title:'욕실 타일 직접 시공 가능한가요?',            author:'초보집주인',   date:'2026-03-27', views:432,  comments:15, hot:false },
  { id:4, category:'material', title:'강화마루 vs LVT 바닥재 뭐가 나을까요?',      author:'바닥전문가',   date:'2026-03-26', views:654,  comments:28, hot:false },
  { id:5, category:'apt',      title:'성복역 롯데캐슬 84평형 목공 후기',           author:'롯데주민',     date:'2026-03-26', views:321,  comments:9,  hot:false },
  { id:6, category:'review',   title:'도배+바닥 셀프 시공 비용 아끼는 법',         author:'DIY장인',      date:'2026-03-25', views:987,  comments:42, hot:true },
  { id:7, category:'quote',    title:'광교 힐스테이트 32평 총 견적 1,800만원 내역', author:'견적고수',     date:'2026-03-25', views:1102, comments:31, hot:true },
  { id:8, category:'qna',      title:'샷시 교체 시 발코니 확장까지 같이 하면?',    author:'리모델링준비', date:'2026-03-24', views:289,  comments:7,  hot:false },
  { id:9, category:'material', title:'KCC vs LG 샷시 비교 실사용 후기',           author:'샷시전문가',   date:'2026-03-24', views:445,  comments:18, hot:false },
  { id:10,category:'apt',      title:'상현 자이 방 3개 도배 비용 얼마나 들까요',   author:'자이주민',     date:'2026-03-23', views:234,  comments:11, hot:false },
  { id:11,category:'review',   title:'주방 리모델링 직접 했습니다 (싱크대 교체)',  author:'주방장',       date:'2026-03-23', views:678,  comments:22, hot:false },
  { id:12,category:'quote',    title:'더샵 포레스트 욕실 2개 견적 공유',           author:'더샵주민',     date:'2026-03-22', views:512,  comments:14, hot:false },
];

const CATEGORY_COLORS = {
  review:   { bg: '#FEF3C7', text: '#D97706' },
  quote:    { bg: '#DCFCE7', text: '#16A34A' },
  qna:      { bg: '#EFF6FF', text: '#2563EB' },
  material: { bg: '#F5F3FF', text: '#7C3AED' },
  apt:      { bg: '#FFF1F2', text: '#E11D48' },
};

export default function Community() {
  const [activeCategory, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = POSTS.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search || p.title.includes(search) || p.author.includes(search);
    return matchCat && matchSearch;
  });

  const hotPosts = POSTS.filter(p => p.hot).slice(0, 3);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>커뮤니티</h1>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>인테리어 경험과 정보를 나눠요</p>
      </div>

      {/* 인기글 */}
      <div style={{ background: '#FAFAF8', borderRadius: 14, border: '1px solid #F1F5F9', padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 12 }}>🔥 인기글</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hotPosts.map(p => {
            const col = CATEGORY_COLORS[p.category] || { bg: '#F1F5F9', text: '#475569' };
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: col.bg, color: col.text, flexShrink: 0 }}>
                  {CATEGORIES.find(c => c.id === p.category)?.label}
                </span>
                <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500, flex: 1 }}>{p.title}</span>
                <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>댓글 {p.comments}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 카테고리 + 검색 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
              background: activeCategory === cat.id ? '#1A1A1A' : '#F1F5F9',
              color: activeCategory === cat.id ? 'white' : '#475569',
            }}>{cat.icon} {cat.label}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색"
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', width: 160 }} />
      </div>

      {/* 글 목록 */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
        {/* 목록 헤더 */}
        <div style={{ display: 'flex', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
          <div style={{ flex: 1 }}>제목</div>
          <div style={{ width: 80, textAlign: 'center' }}>작성자</div>
          <div style={{ width: 60, textAlign: 'center' }}>조회</div>
          <div style={{ width: 50, textAlign: 'center' }}>댓글</div>
          <div style={{ width: 80, textAlign: 'center' }}>날짜</div>
        </div>

        {filtered.map((post, i) => {
          const col = CATEGORY_COLORS[post.category] || { bg: '#F1F5F9', text: '#475569' };
          return (
            <div key={post.id} style={{
              display: 'flex', alignItems: 'center', padding: '13px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
              cursor: 'pointer', transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: col.bg, color: col.text, flexShrink: 0 }}>
                  {CATEGORIES.find(c => c.id === post.category)?.label}
                </span>
                <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: post.hot ? 600 : 400 }}>{post.title}</span>
                {post.hot && <span style={{ fontSize: 11, color: '#E8540A', fontWeight: 700 }}>HOT</span>}
              </div>
              <div style={{ width: 80, textAlign: 'center', fontSize: 12, color: '#64748B' }}>{post.author}</div>
              <div style={{ width: 60, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>{post.views.toLocaleString()}</div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>{post.comments}</div>
              <div style={{ width: 80, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>{post.date.slice(5)}</div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>게시글이 없습니다</div>
        )}
      </div>

      {/* 글쓰기 버튼 */}
      <div style={{ textAlign: 'right' }}>
        <button style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          background: '#1A1A1A', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>✏️ 글쓰기</button>
      </div>
    </div>
  );
}
