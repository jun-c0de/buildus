import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMaterials } from '../api/materials';

// localStorage 저장된 코드 읽기
function loadSavedCodes() {
  try { return new Set(JSON.parse(localStorage.getItem('buildus_saved') || '[]')); }
  catch { return new Set(); }
}
function persistSavedCodes(set) {
  localStorage.setItem('buildus_saved', JSON.stringify([...set]));
}

const GRADE_STYLE = {
  '프리미엄': { background: '#FEF3C7', color: '#92400E' },
  '표준':     { background: '#EFF6FF', color: '#1D4ED8' },
  '-':        { background: '#F1F5F9', color: '#64748B' },
};

export default function UserProfile() {
  const { currentUser, isLoggedIn, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();

  const [savedCodes, setSavedCodes] = useState(loadSavedCodes);
  const allMaterials = useMemo(() => getMaterials(), []);
  const savedMaterials = useMemo(
    () => allMaterials.filter(m => savedCodes.has(m.자재코드)),
    [allMaterials, savedCodes]
  );

  // 프로필 편집
  const [editName, setEditName]   = useState(currentUser?.name ?? '');
  const [nameSaved, setNameSaved] = useState(false);

  // 비밀번호 변경
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg]   = useState({ type: '', text: '' });

  if (!isLoggedIn) {
    navigate('/');
    return null;
  }

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

  function removeSaved(code) {
    setSavedCodes(prev => {
      const next = new Set(prev);
      next.delete(code);
      persistSavedCodes(next);
      return next;
    });
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const role = currentUser.role;
  const avatarBg    = role === 'admin' ? '#FEF3C7' : '#EFF6FF';
  const avatarColor = role === 'admin' ? '#92400E' : '#1D4ED8';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px' }}>

      {/* 페이지 헤더 */}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: '0 0 28px' }}>내 프로필</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── 왼쪽: 프로필 카드 ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 아바타 + 기본 정보 */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 24px', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px',
              background: avatarBg, color: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 900,
            }}>{currentUser.name[0]}</div>

            <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1A1A' }}>{currentUser.name}</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{currentUser.email}</div>

            <div style={{ marginTop: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: role === 'admin' ? '#FEF3C7' : '#F1F5F9',
                color: role === 'admin' ? '#92400E' : '#475569',
              }}>
                {role === 'admin' ? '🔑 관리자' : '일반 사용자'}
              </span>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8' }}>
              가입일: {currentUser.joinedAt}
            </div>
          </div>

          {/* 이름 변경 */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 14 }}>이름 변경</div>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              style={inputStyle}
            />
            <button onClick={handleSaveName} style={{
              width: '100%', marginTop: 10, padding: '10px',
              borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: nameSaved ? '#D1FAE5' : '#1A1A1A',
              color: nameSaved ? '#065F46' : 'white',
              transition: 'all 0.2s',
            }}>
              {nameSaved ? '✓ 저장됨' : '저장'}
            </button>
          </div>

          {/* 비밀번호 변경 */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 14 }}>비밀번호 변경</div>
            <form onSubmit={handleChangePw} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                placeholder="현재 비밀번호"
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                style={inputStyle}
              />
              <input
                type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (4자 이상)"
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                style={inputStyle}
              />
              <input
                type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)}
                placeholder="새 비밀번호 확인"
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                style={inputStyle}
              />
              {pwMsg.text && (
                <p style={{ margin: 0, fontSize: 12, color: pwMsg.type === 'error' ? '#EF4444' : '#10B981' }}>{pwMsg.text}</p>
              )}
              <button type="submit" style={{
                padding: '10px', borderRadius: 10, border: 'none',
                background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>변경</button>
            </form>
          </div>
        </div>

        {/* ── 오른쪽: 담은 자재 ──────────────────────────────────── */}
        <div>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>담은 자재</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>자재몰에서 담기 버튼으로 추가됩니다</div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8',
                padding: '4px 12px', borderRadius: 20,
              }}>{savedMaterials.length}개</span>
            </div>

            {savedMaterials.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>아직 담은 자재가 없어요</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>자재몰에서 마음에 드는 자재를 담아보세요</div>
                <button onClick={() => navigate('/marketplace')} style={{
                  padding: '9px 20px', borderRadius: 10, border: 'none',
                  background: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>자재몰 가기</button>
              </div>
            ) : (
              <div>
                {savedMaterials.map((m, i) => {
                  const price = m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가;
                  const grade = m.등급 ?? '-';
                  return (
                    <div key={m.자재코드} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px',
                      borderBottom: i < savedMaterials.length - 1 ? '1px solid #F1F5F9' : 'none',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* 썸네일 플레이스홀더 */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 10, background: '#F1F5F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0,
                      }}>🖼️</div>

                      {/* 자재 정보 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A1A', marginBottom: 3 }}>{m.품명}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '1px 6px', borderRadius: 4 }}>
                            {m.대분류}{m.중분류 ? ` › ${m.중분류}` : ''}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, ...(GRADE_STYLE[grade] ?? GRADE_STYLE['-']) }}>
                            {grade}
                          </span>
                          {(m.추천공간 ?? []).slice(0, 3).map(s => (
                            <span key={s} style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>{s}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
                          {m.브랜드 || m.제조사 || ''}{m.규격 ? ` · ${m.규격}` : ''}{m.단위 ? ` · ${m.단위}` : ''}
                        </div>
                      </div>

                      {/* 가격 */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {price
                          ? <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>{price.toLocaleString()}원</div>
                          : <div style={{ fontSize: 13, color: '#CBD5E1' }}>가격 미정</div>}
                        {m.물류?.배송비기준 && (
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{m.물류.배송비기준}</div>
                        )}
                      </div>

                      {/* 삭제 */}
                      <button onClick={() => removeSaved(m.자재코드)} style={{
                        width: 28, height: 28, borderRadius: '50%', border: 'none',
                        background: '#F1F5F9', color: '#94A3B8', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0, transition: 'all 0.12s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#94A3B8'; }}
                        title="담기 취소"
                      >✕</button>
                    </div>
                  );
                })}

                {/* 하단 자재몰 링크 */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
                  <button onClick={() => navigate('/marketplace')} style={{
                    padding: '8px 20px', borderRadius: 10, border: '1px solid #E2E8F0',
                    background: 'white', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}>+ 자재몰에서 더 담기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
