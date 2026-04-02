import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMaterials, getProcesses, getCategories,
  getAdminMaterials, saveAdminMaterial, deleteAdminMaterial,
  getAdminProcessOverrides, saveAdminProcess, deleteAdminProcess,
} from '../api/materials';
import { loadPosts, deletePost, updatePost } from '../store/communityStore';
import processesData from '../data/processes.json';

// ── 공통 스타일 ──────────────────────────────────────────────────────────────
const card = (children, style = {}) => (
  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', ...style }}>
    {children}
  </div>
);

const inputSt = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const ROLE_STYLE = {
  admin: { background: '#FEF3C7', color: '#92400E', label: '관리자' },
  user:  { background: '#EFF6FF', color: '#1D4ED8', label: '일반 사용자' },
};

const CAT_COLORS = {
  review:   { bg: '#FEF3C7', text: '#D97706' },
  quote:    { bg: '#DCFCE7', text: '#16A34A' },
  qna:      { bg: '#EFF6FF', text: '#2563EB' },
  material: { bg: '#F5F3FF', text: '#7C3AED' },
  apt:      { bg: '#FFF1F2', text: '#E11D48' },
};
const CAT_LABEL = { review:'시공후기', quote:'견적공유', qna:'Q&A', material:'자재추천', apt:'아파트별' };

const SPACES = ['거실', '안방', '작은방', '욕실', '주방', '베란다'];
const DIFFICULTY_STYLE = { '하':{ bg:'#D1FAE5', text:'#065F46' }, '중':{ bg:'#FEF3C7', text:'#92400E' }, '상':{ bg:'#FEE2E2', text:'#991B1B' } };

// ── 개요 탭 ──────────────────────────────────────────────────────────────────
function OverviewTab() {
  const materials = useMemo(() => getMaterials(), []);
  const processes = useMemo(() => getProcesses(), []);
  const posts = useMemo(() => loadPosts(), []);
  const adminMats = useMemo(() => getAdminMaterials(), []);

  const matByCat = useMemo(() => {
    const acc = {};
    materials.forEach(m => { acc[m.대분류] = (acc[m.대분류] || 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const StatCard = ({ label, value, sub, color = '#3B82F6' }) => (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px' }}>
      <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="총 자재 수" value={materials.length.toLocaleString()} sub={`관리자 추가 ${adminMats.length}개 포함`} color="#3B82F6" />
        <StatCard label="공정 수" value={processes.length} sub="등록된 공정 단계" color="#10B981" />
        <StatCard label="커뮤니티 게시글" value={posts.length} sub={`인기글 ${posts.filter(p=>p.hot).length}개`} color="#8B5CF6" />
        <StatCard label="공정 난이도 분포" value={processes.filter(p=>p.셀프난이도==='하').length + '/' + processes.filter(p=>p.셀프난이도==='중').length + '/' + processes.filter(p=>p.셀프난이도==='상').length} sub="하/중/상" color="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {card(
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15 }}>자재 카테고리 현황</div>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matByCat.map(([cat, cnt]) => {
                const pct = Math.round((cnt / materials.length) * 100);
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{cat}</span>
                      <span style={{ color: '#64748B' }}>{cnt.toLocaleString()}개 ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#3B82F6', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {card(
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15 }}>공정 현황</div>
            <div style={{ padding: '8px 0' }}>
              {processes.map(p => {
                const ds = DIFFICULTY_STYLE[p.셀프난이도] ?? DIFFICULTY_STYLE['하'];
                return (
                  <div key={p.공정코드} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, minWidth: 20 }}>{p.순서}</span>
                      <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{p.공정명}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ds.bg, color: ds.text }}>셀프{p.셀프난이도}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 사용자 탭 ────────────────────────────────────────────────────────────────
function UsersTab({ currentUser, getAllUsers, changeRole }) {
  const [userSearch, setUserSearch] = useState('');
  const users = useMemo(() => getAllUsers(), []);

  const filtered = users.filter(u => u.name.includes(userSearch) || u.email.includes(userSearch));

  function handleRoleToggle(user) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (user.id === currentUser.id) return alert('자신의 역할은 변경할 수 없습니다.');
    if (!confirm(`${user.name}님을 "${newRole === 'admin' ? '관리자' : '일반 사용자'}"로 변경할까요?`)) return;
    changeRole(user.id, newRole);
    window.location.reload();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
      {card(
        <>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>사용자 관리</div>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="이름·이메일 검색"
              style={{ ...inputSt, width: 180 }} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['이름', '이메일', '역할', '가입일', '역할 변경'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: u.role === 'admin' ? '#FEF3C7' : '#EFF6FF', color: u.role === 'admin' ? '#92400E' : '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{u.name[0]}</div>
                        {u.name}{isSelf && <span style={{ fontSize: 10, color: '#94A3B8' }}>(나)</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: rs.background, color: rs.color }}>{rs.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{u.joinedAt}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => handleRoleToggle(u)} disabled={isSelf} style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: isSelf ? 'not-allowed' : 'pointer',
                        border: '1px solid #E2E8F0', background: isSelf ? '#F8FAFC' : 'white',
                        color: isSelf ? '#CBD5E1' : (u.role === 'admin' ? '#EF4444' : '#3B82F6'),
                      }}>{u.role === 'admin' ? '일반으로' : '관리자로'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {card(
        <div style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>요약</div>
          {[
            { label: '전체 사용자', value: users.length, color: '#3B82F6' },
            { label: '관리자', value: users.filter(u => u.role === 'admin').length, color: '#F59E0B' },
            { label: '일반 사용자', value: users.filter(u => u.role === 'user').length, color: '#10B981' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>{item.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 커뮤니티 탭 ──────────────────────────────────────────────────────────────
function CommunityTab() {
  const [posts, setPosts] = useState(() => loadPosts());
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const filtered = posts.filter(p => {
    const mc = catFilter === 'all' || p.category === catFilter;
    const ms = !search || p.title.includes(search) || p.author.includes(search);
    return mc && ms;
  });

  function handleDelete(id) {
    if (!confirm('게시글을 삭제할까요?')) return;
    setPosts(deletePost(id));
  }
  function handleHot(id, val) { setPosts(updatePost(id, { hot: val })); }
  function handlePin(id, val) { setPosts(updatePost(id, { pinned: val })); }

  const catStats = useMemo(() => {
    const acc = {};
    posts.forEach(p => { acc[p.category] = (acc[p.category] || 0) + 1; });
    return acc;
  }, [posts]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {Object.entries(CAT_LABEL).map(([id, label]) => {
          const col = CAT_COLORS[id] || { bg: '#F1F5F9', text: '#475569' };
          return (
            <div key={id} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px', cursor: 'pointer', borderTopColor: col.text }}
              onClick={() => setCatFilter(catFilter === id ? 'all' : id)}>
              <div style={{ fontSize: 11, fontWeight: 600, color: col.text, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A' }}>{catStats[id] || 0}</div>
            </div>
          );
        })}
      </div>

      {card(<>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>게시글 관리 <span style={{ fontSize: 13, fontWeight: 400, color: '#94A3B8' }}>({filtered.length}개)</span></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목·작성자 검색"
            style={{ ...inputSt, width: 200 }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['카테고리', '제목', '작성자', '날짜', '조회', '댓글', 'HOT', '📌', '삭제'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const col = CAT_COLORS[p.category] || { bg: '#F1F5F9', text: '#475569' };
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', background: p.pinned ? '#FFFBEB' : (i%2===0?'white':'#FAFAFA') }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: col.bg, color: col.text }}>{CAT_LABEL[p.category] || p.category}</span>
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                    <div style={{ fontWeight: 500, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{p.author}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{p.date.slice(5)}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', textAlign: 'right' }}>{p.views.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: '#3B82F6', fontWeight: 600, textAlign: 'center' }}>{p.comments}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => handleHot(p.id, !p.hot)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: p.hot ? 1 : 0.25 }}>🔥</button>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => handlePin(p.id, !p.pinned)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: p.pinned ? 1 : 0.25 }}>📌</button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', fontSize: 11, color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>게시글이 없습니다</div>}
      </>)}
    </div>
  );
}

// ── 자재 탭 ──────────────────────────────────────────────────────────────────
const EMPTY_MAT = { 품명:'', 대분류:'마감재', 중분류:'', 브랜드:'', 규격:'', 단위:'', 가격_판매가:'', 등급:'표준', 추천공간:[] };

function MaterialFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_MAT);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const categories = useMemo(() => getCategories(), []);

  function toggleSpace(s) {
    set('추천공간', form.추천공간.includes(s) ? form.추천공간.filter(x => x !== s) : [...form.추천공간, s]);
  }
  function handleSave() {
    if (!form.품명.trim()) return alert('품명을 입력하세요.');
    onSave({ ...form, 품명: form.품명.trim(), 가격_판매가: form.가격_판매가 ? Number(form.가격_판매가) : null,
      자재코드: initial?.자재코드 || `ADMIN-${Date.now()}` });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{initial ? '자재 수정' : '자재 추가'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>품명 *</div>
            <input value={form.품명} onChange={e => set('품명', e.target.value)} style={inputSt} placeholder="예: LX 하우시스 실크벽지" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>대분류 *</div>
            <select value={form.대분류} onChange={e => set('대분류', e.target.value)} style={inputSt}>
              {categories.map(c => <option key={c}>{c}</option>)}
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>중분류</div>
            <input value={form.중분류} onChange={e => set('중분류', e.target.value)} style={inputSt} placeholder="예: 벽지" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>브랜드</div>
            <input value={form.브랜드} onChange={e => set('브랜드', e.target.value)} style={inputSt} placeholder="예: LX Z:IN" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>단위</div>
            <input value={form.단위} onChange={e => set('단위', e.target.value)} style={inputSt} placeholder="예: 롤, ㎡, kg" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>규격</div>
            <input value={form.규격} onChange={e => set('규격', e.target.value)} style={inputSt} placeholder="예: 1000×2400mm" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>판매가 (원)</div>
            <input type="number" value={form.가격_판매가} onChange={e => set('가격_판매가', e.target.value)} style={inputSt} placeholder="예: 35000" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>등급</div>
            <select value={form.등급} onChange={e => set('등급', e.target.value)} style={inputSt}>
              <option>표준</option><option>프리미엄</option>
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>추천공간</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SPACES.map(s => (
                <button key={s} type="button" onClick={() => toggleSpace(s)} style={{
                  padding: '4px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12,
                  background: form.추천공간.includes(s) ? '#1A1A1A' : 'white',
                  color: form.추천공간.includes(s) ? 'white' : '#475569',
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {initial ? '수정 완료' : '추가 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialsTab() {
  const [adminList, setAdminList] = useState(() => getAdminMaterials());
  const [modal, setModal]   = useState(null); // null | 'add' | material object
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'custom' | 'modified'
  const [page, setPage]     = useState(1);
  const PAGE_SIZE = 25;

  // getMaterials()는 adminList 변경 후 재계산
  const allMaterials = useMemo(() => getMaterials(), [adminList]);

  const adminMap     = useMemo(() => new Map(adminList.map(m => [m.자재코드, m])), [adminList]);
  const officialCnt  = allMaterials.filter(m => !m.isAdminAdded).length;
  const adminOnlyCnt = allMaterials.filter(m => m.isAdminAdded).length;
  const modifiedCnt  = allMaterials.filter(m => m.isOverridden).length;

  const filtered = useMemo(() => {
    let r = allMaterials;
    if (viewFilter === 'custom')   r = r.filter(m => m.isAdminAdded);
    if (viewFilter === 'modified') r = r.filter(m => m.isOverridden);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m =>
        (m.품명 ?? '').toLowerCase().includes(q) ||
        (m.브랜드 ?? '').toLowerCase().includes(q) ||
        (m.대분류 ?? '').includes(search) ||
        (m.중분류 ?? '').includes(search)
      );
    }
    return r;
  }, [allMaterials, viewFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage(fn) { fn(); setPage(1); }

  // 편집 모달에 넘길 초기값 — 공식/관리자 자재 양쪽 형식 처리
  function openEdit(m) {
    setModal({
      자재코드:  m.자재코드,
      품명:      m.품명 ?? m.name ?? '',
      대분류:    m.대분류 || '마감재',
      중분류:    m.중분류 || '',
      브랜드:    m.브랜드 || m.brand || m.제조사 || '',
      규격:      m.규격 || '',
      단위:      m.단위 || m.unit || '',
      // 가격: 관리자 오버라이드 우선, 없으면 공식 가격
      가격_판매가: adminMap.has(m.자재코드)
        ? (adminMap.get(m.자재코드).가격_판매가 ?? '')
        : (m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가 ?? ''),
      등급:      m.등급 || m.grade || '-',
      추천공간:  m.추천공간 || [],
    });
  }

  function handleSave(mat) {
    setAdminList(saveAdminMaterial(mat));
    setModal(null);
  }
  function handleDelete(code) {
    if (!confirm('이 자재를 삭제할까요?')) return;
    setAdminList(deleteAdminMaterial(code));
  }
  function handleResetOverride(code) {
    if (!confirm('수정 내용을 원래대로 되돌릴까요?')) return;
    setAdminList(deleteAdminMaterial(code));
  }

  const GRADE_STYLE = { '프리미엄': { bg: '#FEF3C7', text: '#92400E' }, '표준': { bg: '#EFF6FF', text: '#1D4ED8' }, '-': { bg: '#F1F5F9', text: '#64748B' } };

  return (
    <div>
      {modal && (
        <MaterialFormModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: '공식 자재',   value: officialCnt.toLocaleString(), sub: 'DB 기준',       color: '#3B82F6' },
          { label: '관리자 추가', value: adminOnlyCnt,                  sub: '자재몰에 표시', color: '#10B981' },
          { label: '단가 수정됨', value: modifiedCnt,                   sub: '공식 자재 중',  color: '#F59E0B' },
          { label: '전체',        value: allMaterials.length.toLocaleString(), sub: '자재몰 기준', color: '#8B5CF6' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {card(<>
        {/* 헤더 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','전체'],['custom','추가됨'],['modified','수정됨']].map(([id, label]) => (
              <button key={id} onClick={() => resetPage(() => setViewFilter(id))} style={{
                padding: '5px 14px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: viewFilter === id ? '#1A1A1A' : '#F1F5F9',
                color: viewFilter === id ? 'white' : '#475569',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={search} onChange={e => resetPage(() => setSearch(e.target.value))}
              placeholder="품명·브랜드·분류 검색"
              style={{ ...inputSt, width: 200 }} />
            <button onClick={() => setModal('add')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1A1A1A', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ 자재 추가</button>
          </div>
        </div>

        {/* 테이블 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['품명', '분류', '브랜드', '규격/단위', '판매가', '등급', '추천공간', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((m, i) => {
              const gs = GRADE_STYLE[m.등급 ?? m.grade ?? '-'] ?? GRADE_STYLE['-'];
              const rowBg = m.isAdminAdded ? '#F0FDF4' : m.isOverridden ? '#FFFBEB' : (i%2===0?'white':'#FAFAFA');
              return (
                <tr key={m.자재코드} style={{ borderBottom: '1px solid #F1F5F9', background: rowBg }}>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1A1A1A', maxWidth: 200 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.품명 ?? m.name}</div>
                    {m.isAdminAdded  && <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>추가됨</span>}
                    {m.isOverridden  && <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>수정됨</span>}
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>{m.대분류}</span>
                    {m.중분류 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{m.중분류}</div>}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{m.브랜드 || m.brand || '-'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{[m.규격, m.단위 ?? m.unit].filter(Boolean).join(' · ') || '-'}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {m.price && m.price !== '-' ? m.price : <span style={{ color: '#CBD5E1', fontWeight: 400 }}>미정</span>}
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: gs.bg, color: gs.text }}>{m.등급 ?? m.grade ?? '-'}</span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 120 }}>
                      {(m.추천공간 ?? []).slice(0, 3).map(s => <span key={s} style={{ fontSize: 10, background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: 3 }}>{s}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(m)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>편집</button>
                      {m.isOverridden  && <button onClick={() => handleResetOverride(m.자재코드)} title="원래대로" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEF3C7', background: '#FFFBEB', fontSize: 11, color: '#92400E', cursor: 'pointer' }}>↩</button>}
                      {m.isAdminAdded  && <button onClick={() => handleDelete(m.자재코드)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', fontSize: 11, color: '#EF4444', cursor: 'pointer' }}>삭제</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>검색 결과가 없습니다</div>
        )}

        {/* 페이지네이션 + 범례 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#94A3B8' }}>
            <span>흰 배경: 공식</span>
            <span style={{ color: '#92400E' }}>노란 배경: 수정됨 (↩ 원복)</span>
            <span style={{ color: '#065F46' }}>초록 배경: 새로 추가됨</span>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', cursor: page===1?'not-allowed':'pointer', color: page===1?'#CBD5E1':'#475569', fontSize: 12 }}>←</button>
              <span style={{ fontSize: 12, color: '#64748B', padding: '0 6px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#CBD5E1':'#475569', fontSize: 12 }}>→</button>
            </div>
          )}
        </div>
      </>)}
    </div>
  );
}

// ── 공정 탭 ──────────────────────────────────────────────────────────────────
const officialCodes = new Set(processesData.map(p => p.공정코드));
const EMPTY_PROC = { 공정명:'', 순서:14, 기간:{ 시공일:1, 양생일:0, 합계일:1 }, 단가:{ 자재비_m2:'', 인건비_m2:'', 적정합계범위:'' }, 셀프난이도:'중' };

function ProcessFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? {
    공정명: initial.공정명,
    순서: initial.순서,
    시공일: initial.기간?.시공일 ?? 1,
    양생일: initial.기간?.양생일 ?? 0,
    셀프난이도: initial.셀프난이도 || '중',
    자재비_m2: initial.단가?.자재비_m2 || '',
    인건비_m2: initial.단가?.인건비_m2 || '',
    적정합계범위: initial.단가?.적정합계범위 || '',
  } : {
    공정명:'', 순서:14, 시공일:1, 양생일:0, 셀프난이도:'중', 자재비_m2:'', 인건비_m2:'', 적정합계범위:'',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.공정명.trim()) return alert('공정명을 입력하세요.');
    onSave({
      ...(initial || {}),
      공정코드: initial?.공정코드 || `PROC-${String(form.순서).padStart(2,'0')}-${Date.now().toString(36)}`,
      공정명: form.공정명.trim(),
      순서: Number(form.순서),
      셀프난이도: form.셀프난이도,
      기간: { 시공일: Number(form.시공일), 양생일: Number(form.양생일), 합계일: Number(form.시공일) + Number(form.양생일) },
      단가: { 자재비_m2: form.자재비_m2 || null, 인건비_m2: form.인건비_m2 || null, 적정합계범위: form.적정합계범위 || null },
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{initial ? '공정 편집' : '공정 추가'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>공정명 *</div>
            <input value={form.공정명} onChange={e => set('공정명', e.target.value)} style={inputSt} placeholder="예: 필름 시공" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>순서</div>
            <input type="number" value={form.순서} onChange={e => set('순서', e.target.value)} style={inputSt} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>셀프 난이도</div>
            <select value={form.셀프난이도} onChange={e => set('셀프난이도', e.target.value)} style={inputSt}>
              <option>하</option><option>중</option><option>상</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>시공일수</div>
            <input type="number" value={form.시공일} onChange={e => set('시공일', e.target.value)} style={inputSt} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>양생일수</div>
            <input type="number" value={form.양생일} onChange={e => set('양생일', e.target.value)} style={inputSt} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>자재비/㎡</div>
            <input value={form.자재비_m2} onChange={e => set('자재비_m2', e.target.value)} style={inputSt} placeholder="예: 1~2만" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>인건비/㎡</div>
            <input value={form.인건비_m2} onChange={e => set('인건비_m2', e.target.value)} style={inputSt} placeholder="예: 3~5만" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>적정 합계 범위</div>
            <input value={form.적정합계범위} onChange={e => set('적정합계범위', e.target.value)} style={inputSt} placeholder="예: 150~250만" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {initial ? '수정 완료' : '추가 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessesTab() {
  const [processes, setProcesses] = useState(() => getProcesses());
  const [modal, setModal] = useState(null); // null | 'add' | process object
  const overrideCodes = useMemo(() => new Set(getAdminProcessOverrides().map(p => p.공정코드)), [processes]);

  function handleSave(proc) {
    saveAdminProcess(proc);
    setProcesses(getProcesses());
    setModal(null);
  }
  function handleDelete(code) {
    if (!confirm('이 공정을 삭제할까요? (공식 공정은 삭제되지 않습니다)')) return;
    deleteAdminProcess(code);
    setProcesses(getProcesses());
  }
  function handleResetOverride(code) {
    if (!confirm('이 공정의 수정사항을 원래대로 되돌릴까요?')) return;
    deleteAdminProcess(code);
    setProcesses(getProcesses());
  }

  return (
    <div>
      {modal && <ProcessFormModal initial={modal === 'add' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}

      {card(<>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>공정 관리 <span style={{ fontSize: 13, fontWeight: 400, color: '#94A3B8' }}>({processes.length}개)</span></div>
          <button onClick={() => setModal('add')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1A1A1A', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ 공정 추가</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['순서', '공정명', '코드', '시공일', '양생일', '자재비/㎡', '인건비/㎡', '합계범위', '난이도', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processes.map((p, i) => {
              const ds = DIFFICULTY_STYLE[p.셀프난이도] ?? DIFFICULTY_STYLE['하'];
              const isOfficial = officialCodes.has(p.공정코드);
              const isOverridden = overrideCodes.has(p.공정코드) && isOfficial;
              const isAdminOnly = !isOfficial;
              return (
                <tr key={p.공정코드} style={{ borderBottom: '1px solid #F1F5F9', background: isAdminOnly ? '#F0FDF4' : (isOverridden ? '#FFFBEB' : (i%2===0?'white':'#FAFAFA')) }}>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', fontWeight: 600, textAlign: 'center' }}>{p.순서}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1A1A1A' }}>
                    {p.공정명}
                    {isAdminOnly && <span style={{ fontSize: 10, marginLeft: 5, background: '#D1FAE5', color: '#065F46', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>추가</span>}
                    {isOverridden && <span style={{ fontSize: 10, marginLeft: 5, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>수정됨</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: 11 }}>{p.공정코드}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{p.기간?.시공일 ?? '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{p.기간?.양생일 ?? '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{p.단가?.자재비_m2 || <span style={{ color: '#CBD5E1' }}>-</span>}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{p.단가?.인건비_m2 || <span style={{ color: '#CBD5E1' }}>-</span>}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{p.단가?.적정합계범위 || <span style={{ color: '#CBD5E1' }}>-</span>}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ds.bg, color: ds.text }}>셀프{p.셀프난이도}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setModal(p)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>편집</button>
                      {isOverridden && <button onClick={() => handleResetOverride(p.공정코드)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEF3C7', background: '#FFFBEB', fontSize: 11, color: '#92400E', cursor: 'pointer' }}>↩</button>}
                      {isAdminOnly && <button onClick={() => handleDelete(p.공정코드)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', fontSize: 11, color: '#EF4444', cursor: 'pointer' }}>삭제</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 16, fontSize: 11, color: '#94A3B8' }}>
          <span>흰 배경: 공식 공정</span>
          <span style={{ color: '#92400E' }}>노란 배경: 수정된 공정 (↩로 원래대로)</span>
          <span style={{ color: '#065F46' }}>초록 배경: 추가된 공정</span>
        </div>
      </>)}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
// ── 계정 설정 탭 ─────────────────────────────────────────────────────────────
function AccountTab({ currentUser, updateProfile, changePassword }) {
  const [editName, setEditName]   = useState(currentUser?.name ?? '');
  const [nameSaved, setNameSaved] = useState(false);
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg]   = useState({ type: '', text: '' });

  function handleSaveName() {
    if (!editName.trim()) return;
    updateProfile(editName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }
  function handleChangePw(e) {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (newPw.length < 4) return setPwMsg({ type: 'error', text: '새 비밀번호는 4자 이상이어야 합니다.' });
    if (newPw !== newPw2)  return setPwMsg({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
    try {
      changePassword(oldPw, newPw);
      setOldPw(''); setNewPw(''); setNewPw2('');
      setPwMsg({ type: 'success', text: '비밀번호가 변경되었습니다.' });
    } catch (err) { setPwMsg({ type: 'error', text: err.message }); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          {
            title: '이름 변경',
            content: (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#3B82F6'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  style={{ ...inputSt, marginBottom: 10 }} />
                <button onClick={handleSaveName} style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: nameSaved ? '#D1FAE5' : '#1A1A1A',
                  color: nameSaved ? '#065F46' : 'white', transition: 'all 0.2s',
                }}>{nameSaved ? '✓ 저장됨' : '저장'}</button>
              </>
            ),
          },
          {
            title: '비밀번호 변경',
            content: (
              <form onSubmit={handleChangePw} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['현재 비밀번호', oldPw, setOldPw], ['새 비밀번호 (4자 이상)', newPw, setNewPw], ['새 비밀번호 확인', newPw2, setNewPw2]].map(([ph, val, set]) => (
                  <input key={ph} type="password" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    onFocus={e => e.target.style.borderColor = '#3B82F6'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                    style={inputSt} />
                ))}
                {pwMsg.text && <p style={{ margin: 0, fontSize: 12, color: pwMsg.type === 'error' ? '#EF4444' : '#10B981' }}>{pwMsg.text}</p>}
                <button type="submit" style={{ padding: '10px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginTop: 2 }}>변경</button>
              </form>
            ),
          },
        ].map(({ title, content }) => (
          <div key={title} style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '22px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 14 }}>{title}</div>
            {content}
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview',   label: '📊 개요' },
  { id: 'users',      label: '👥 사용자' },
  { id: 'community',  label: '📝 커뮤니티' },
  { id: 'materials',  label: '🧱 자재' },
  { id: 'processes',  label: '⚙️ 공정' },
  { id: 'account',    label: '👤 계정 설정' },
];

export default function AdminDashboard() {
  const { currentUser, isAdmin, getAllUsers, changeRole, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6 }}>ADMIN</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>관리자 대시보드</h1>
        </div>
        <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>안녕하세요, {currentUser.name}님</p>
      </div>

      {/* 탭 바 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#F1F5F9', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? '#1A1A1A' : '#64748B',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab />}
      {tab === 'users'     && <UsersTab currentUser={currentUser} getAllUsers={getAllUsers} changeRole={changeRole} />}
      {tab === 'community' && <CommunityTab />}
      {tab === 'materials' && <MaterialsTab />}
      {tab === 'processes' && <ProcessesTab />}
      {tab === 'account'   && <AccountTab currentUser={currentUser} updateProfile={updateProfile} changePassword={changePassword} />}
    </div>
  );
}
