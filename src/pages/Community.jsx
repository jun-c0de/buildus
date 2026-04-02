import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadPosts, addPost } from '../store/communityStore';

const CATEGORIES = [
  { id: 'all',      label: '전체',    icon: '📋' },
  { id: 'review',   label: '시공후기', icon: '⭐' },
  { id: 'quote',    label: '견적공유', icon: '💰' },
  { id: 'qna',      label: 'Q&A',     icon: '💬' },
  { id: 'material', label: '자재추천', icon: '🧱' },
  { id: 'apt',      label: '아파트별', icon: '🏢' },
];

const CATEGORY_COLORS = {
  review:   { bg: '#FEF3C7', text: '#D97706' },
  quote:    { bg: '#DCFCE7', text: '#16A34A' },
  qna:      { bg: '#EFF6FF', text: '#2563EB' },
  material: { bg: '#F5F3FF', text: '#7C3AED' },
  apt:      { bg: '#FFF1F2', text: '#E11D48' },
};

function WriteModal({ onClose, defaultAuthor }) {
  const [form, setForm] = useState({ title: '', category: 'review', content: '', author: defaultAuthor || '' });
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setErr('제목을 입력하세요.');
    if (!form.author.trim()) return setErr('작성자를 입력하세요.');
    addPost({ title: form.title.trim(), category: form.category, author: form.author.trim(), content: form.content });
    onClose(true);
  }

  const input = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '28px 32px', width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A' }}>글쓰기</div>
          <button onClick={() => onClose(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={input}>
            {CATEGORIES.filter(c => c.id !== 'all').map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="제목" style={input} />
          <textarea value={form.content} onChange={e => set('content', e.target.value)} placeholder="내용을 입력하세요" rows={5}
            style={{ ...input, resize: 'vertical' }} />
          <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="작성자 이름" style={input} />
          {err && <p style={{ margin: 0, fontSize: 13, color: '#EF4444' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => onClose(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#475569' }}>취소</button>
            <button type="submit" style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>등록</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Community() {
  const { currentUser, isLoggedIn } = useAuth();
  const [posts, setPosts] = useState(() => loadPosts());
  const [activeCategory, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showWrite, setShowWrite] = useState(false);

  const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const filtered = sorted.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search || p.title.includes(search) || p.author.includes(search);
    return matchCat && matchSearch;
  });

  const hotPosts = posts.filter(p => p.hot).slice(0, 3);

  function handleWriteClose(posted) {
    setShowWrite(false);
    if (posted) setPosts(loadPosts());
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      {showWrite && <WriteModal onClose={handleWriteClose} defaultAuthor={currentUser?.name ?? ''} />}

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
              background: post.pinned ? '#FFFBEB' : 'white',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = post.pinned ? '#FFFBEB' : 'white'}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {post.pinned && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>📌</span>}
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

      <div style={{ textAlign: 'right' }}>
        <button onClick={() => setShowWrite(true)} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          background: '#1A1A1A', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>✏️ 글쓰기</button>
      </div>
    </div>
  );
}
