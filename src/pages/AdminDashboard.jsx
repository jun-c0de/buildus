import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMaterials, getProcesses } from '../api/materials';

const ROLE_STYLE = {
  admin: { background: '#FEF3C7', color: '#92400E', label: '관리자' },
  user:  { background: '#EFF6FF', color: '#1D4ED8', label: '일반 사용자' },
};

export default function AdminDashboard() {
  const { currentUser, isAdmin, getAllUsers, changeRole } = useAuth();
  const navigate = useNavigate();

  const materials = useMemo(() => getMaterials(), []);
  const processes = useMemo(() => getProcesses(), []);
  const users     = useMemo(() => getAllUsers(), []);

  const [userSearch, setUserSearch] = useState('');

  // 관리자가 아니면 홈으로
  if (!isAdmin) {
    navigate('/');
    return null;
  }

  // 자재 카테고리별 집계
  const matByCat = useMemo(() => {
    const acc = {};
    materials.forEach(m => { acc[m.대분류] = (acc[m.대분류] || 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const filteredUsers = users.filter(u =>
    u.name.includes(userSearch) || u.email.includes(userSearch)
  );

  function handleRoleToggle(user) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (user.id === currentUser.id) return alert('자신의 역할은 변경할 수 없습니다.');
    if (!confirm(`${user.name}님을 "${newRole === 'admin' ? '관리자' : '일반 사용자'}"로 변경할까요?`)) return;
    changeRole(user.id, newRole);
    // 새로고침 없이 반영하려면 users를 state로 관리해야 하지만, 간단히 reload
    window.location.reload();
  }

  const card = (label, value, sub, color = '#3B82F6') => (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px' }}>
      <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6 }}>ADMIN</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>관리자 대시보드</h1>
        </div>
        <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>안녕하세요, {currentUser.name}님</p>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {card('총 자재 수', materials.length.toLocaleString(), '공식 DB 기준', '#3B82F6')}
        {card('공정 수', processes.length, '등록된 공정 단계', '#10B981')}
        {card('가입 사용자', users.length, '관리자 포함', '#8B5CF6')}
        {card('관리자 수', users.filter(u => u.role === 'admin').length, '전체 사용자 중', '#F59E0B')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* 사용자 관리 */}
        <div>
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>사용자 관리</div>
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="이름·이메일 검색"
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', width: 180 }} />
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
                {filteredUsers.map((u, i) => {
                  const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.user;
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: u.role === 'admin' ? '#FEF3C7' : '#EFF6FF',
                            color: u.role === 'admin' ? '#92400E' : '#1D4ED8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 13,
                          }}>{u.name[0]}</div>
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
                        }}>
                          {u.role === 'admin' ? '일반으로' : '관리자로'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 자재 현황 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>자재 카테고리 현황</div>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matByCat.map(([cat, cnt]) => {
                const pct = Math.round((cnt / materials.length) * 100);
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{cat}</span>
                      <span style={{ color: '#64748B' }}>{cnt.toLocaleString()}개 ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#3B82F6', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 공정 목록 */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>공정 현황</div>
            <div style={{ padding: '8px 0' }}>
              {processes.map(p => (
                <div key={p.공정코드} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, minWidth: 20 }}>{p.순서}</span>
                    <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{p.공정명}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: { '하': '#D1FAE5', '중': '#FEF3C7', '상': '#FEE2E2' }[p.셀프난이도],
                    color: { '하': '#065F46', '중': '#92400E', '상': '#991B1B' }[p.셀프난이도],
                  }}>셀프{p.셀프난이도}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
