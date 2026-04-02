import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMaterials } from '../api/materials';

function loadSavedCodes() {
  try { return new Set(JSON.parse(localStorage.getItem('buildus_saved') || '[]')); }
  catch { return new Set(); }
}
function persistSavedCodes(set) {
  localStorage.setItem('buildus_saved', JSON.stringify([...set]));
}

const GRADE_STYLE = {
  '프리미엄': { bg: '#FEF3C7', text: '#92400E' },
  '표준':     { bg: '#EFF6FF', text: '#1D4ED8' },
  '-':        { bg: '#F1F5F9', text: '#64748B' },
};

const inputSt = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
};

// ── 자재 카드 ─────────────────────────────────────────────────────────────────
function MaterialCard({ m, onRemove }) {
  const [hover, setHover] = useState(false);
  const price = m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가 ?? m.가격_판매가 ?? null;
  const grade = m.등급 ?? '-';
  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE['-'];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'white', borderRadius: 16,
        border: `1px solid ${hover ? '#CBD5E1' : '#E2E8F0'}`,
        overflow: 'hidden', transition: 'all 0.18s',
        boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* 이미지 영역 */}
      <div style={{ position: 'relative', height: 110, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 36, opacity: 0.4 }}>🖼️</span>
        <button
          onClick={() => onRemove(m.자재코드)}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26, borderRadius: '50%',
            border: 'none', background: 'rgba(0,0,0,0.08)',
            color: '#64748B', cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#64748B'; }}
          title="담기 취소"
        >✕</button>
      </div>

      {/* 내용 */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {m.품명}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>
            {m.대분류}{m.중분류 ? ` › ${m.중분류}` : ''}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: gs.bg, color: gs.text }}>
            {grade}
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>
          {[m.브랜드 || m.제조사, m.규격].filter(Boolean).join(' · ') || '\u00A0'}
        </div>

        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
          {price
            ? <span style={{ fontWeight: 800, fontSize: 15, color: '#1A1A1A' }}>{price.toLocaleString()}원</span>
            : <span style={{ fontSize: 13, color: '#CBD5E1' }}>가격 미정</span>}
          {m.물류?.배송비기준 && (
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{m.물류.배송비기준}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 계정 설정 ─────────────────────────────────────────────────────────────────
function AccountSettings({ currentUser, updateProfile, changePassword }) {
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
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    }
  }

  const SectionCard = ({ title, children }) => (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A', marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SectionCard title="이름 변경">
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onFocus={e => e.target.style.borderColor = '#3B82F6'}
          onBlur={e => e.target.style.borderColor = '#E2E8F0'}
          style={inputSt}
        />
        <button onClick={handleSaveName} style={{
          width: '100%', marginTop: 10, padding: '11px',
          borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
          background: nameSaved ? '#D1FAE5' : '#1A1A1A',
          color: nameSaved ? '#065F46' : 'white',
          transition: 'all 0.2s',
        }}>
          {nameSaved ? '✓ 저장됨' : '저장'}
        </button>
      </SectionCard>

      <SectionCard title="비밀번호 변경">
        <form onSubmit={handleChangePw} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { val: oldPw, set: setOldPw, ph: '현재 비밀번호' },
            { val: newPw, set: setNewPw, ph: '새 비밀번호 (4자 이상)' },
            { val: newPw2, set: setNewPw2, ph: '새 비밀번호 확인' },
          ].map(({ val, set, ph }) => (
            <input key={ph} type="password" value={val} onChange={e => set(e.target.value)}
              placeholder={ph}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              style={inputSt} />
          ))}
          {pwMsg.text && (
            <p style={{ margin: 0, fontSize: 12, color: pwMsg.type === 'error' ? '#EF4444' : '#10B981' }}>{pwMsg.text}</p>
          )}
          <button type="submit" style={{
            padding: '11px', borderRadius: 10, border: 'none', marginTop: 2,
            background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700,
          }}>변경</button>
        </form>
      </SectionCard>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function UserProfile() {
  const { currentUser, isLoggedIn, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();

  const [savedCodes, setSavedCodes] = useState(loadSavedCodes);
  const [tab, setTab] = useState('materials');

  const allMaterials = useMemo(() => getMaterials(), []);
  const savedMaterials = useMemo(
    () => allMaterials.filter(m => savedCodes.has(m.자재코드)),
    [allMaterials, savedCodes]
  );

  if (!isLoggedIn) { navigate('/'); return null; }

  function removeSaved(code) {
    setSavedCodes(prev => {
      const next = new Set(prev);
      next.delete(code);
      persistSavedCodes(next);
      return next;
    });
  }

  const role = currentUser.role;
  const avatarBg    = role === 'admin' ? '#FEF3C7' : '#EFF6FF';
  const avatarColor = role === 'admin' ? '#92400E' : '#1D4ED8';

  const daysSince = Math.max(0, Math.floor(
    (Date.now() - new Date(currentUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24)
  ));

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 60px' }}>

        {/* ── 프로필 헤더 카드 ──────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '0 0 24px 24px', border: '1px solid #E2E8F0', borderTop: 'none', marginBottom: 28, overflow: 'hidden' }}>

          {/* 상단 배너 */}
          <div style={{ height: 96, background: 'linear-gradient(135deg, #1A1A1A 0%, #374151 100%)' }} />

          {/* 아바타 + 정보 */}
          <div style={{ padding: '0 36px 28px', marginTop: -44 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 16 }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: avatarBg, color: avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 900,
                border: '4px solid white',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                flexShrink: 0,
              }}>{currentUser.name[0]}</div>

              <div style={{ paddingBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#1A1A1A', letterSpacing: '-0.5px' }}>{currentUser.name}</div>
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{currentUser.email}</div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: role === 'admin' ? '#FEF3C7' : '#F1F5F9',
                    color: role === 'admin' ? '#92400E' : '#475569',
                  }}>
                    {role === 'admin' ? '🔑 관리자' : '일반 사용자'}
                  </span>
                </div>
              </div>
            </div>

            {/* 통계 바 */}
            <div style={{ display: 'flex', gap: 0, paddingTop: 20, borderTop: '1px solid #F1F5F9' }}>
              {[
                { value: savedMaterials.length, label: '담은 자재', color: '#3B82F6' },
                { value: daysSince, label: '가입 일수', color: '#10B981' },
                { value: currentUser.joinedAt, label: '가입일', color: '#8B5CF6', isDate: true },
              ].map(({ value, label, color, isDate }) => (
                <div key={label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRight: '1px solid #F1F5F9' }}
                  style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: isDate ? 14 : 24, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 탭 ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'white', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0', width: 'fit-content' }}>
          {[
            { id: 'materials', label: `담은 자재 ${savedMaterials.length > 0 ? `(${savedMaterials.length})` : ''}` },
            { id: 'settings',  label: '계정 설정' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
              background: tab === id ? '#1A1A1A' : 'transparent',
              color: tab === id ? 'white' : '#64748B',
            }}>{label}</button>
          ))}
        </div>

        {/* ── 담은 자재 탭 ─────────────────────────────────────────── */}
        {tab === 'materials' && (
          savedMaterials.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: '80px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>📦</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1A1A1A', marginBottom: 8 }}>아직 담은 자재가 없어요</div>
              <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 28 }}>자재몰에서 마음에 드는 자재를 담아보세요</div>
              <button onClick={() => navigate('/marketplace')} style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              }}>자재몰 둘러보기</button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                {savedMaterials.map(m => (
                  <MaterialCard key={m.자재코드} m={m} onRemove={removeSaved} />
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => navigate('/marketplace')} style={{
                  padding: '10px 24px', borderRadius: 10, border: '1px solid #E2E8F0',
                  background: 'white', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>+ 자재몰에서 더 담기</button>
              </div>
            </div>
          )
        )}

        {/* ── 계정 설정 탭 ─────────────────────────────────────────── */}
        {tab === 'settings' && (
          <AccountSettings
            currentUser={currentUser}
            updateProfile={updateProfile}
            changePassword={changePassword}
          />
        )}
      </div>
    </div>
  );
}
