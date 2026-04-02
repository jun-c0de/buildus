import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ defaultTab = 'login', onClose }) {
  const { login, signup } = useAuth();
  const [tab, setTab]       = useState(defaultTab); // 'login' | 'signup'
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [pw2, setPw2]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      login(email.trim(), pw);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('이름을 입력하세요.');
    if (!email.trim()) return setError('이메일을 입력하세요.');
    if (pw.length < 4) return setError('비밀번호는 4자 이상이어야 합니다.');
    if (pw !== pw2) return setError('비밀번호가 일치하지 않습니다.');
    setLoading(true);
    try {
      signup(name, email, pw);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t) { setTab(t); setError(''); }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: 20, padding: '36px 32px', width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 10px' }}>🏠</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1A1A' }}>빌드어스</div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
          {[['login', '로그인'], ['signup', '회원가입']].map(([key, label]) => (
            <button key={key} onClick={() => switchTab(key)} style={{
              flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              background: tab === key ? 'white' : 'transparent',
              color: tab === key ? '#1A1A1A' : '#64748B',
              boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* 로그인 폼 */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="이메일" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <input
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="비밀번호" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            {error && <p style={{ margin: 0, fontSize: 13, color: '#EF4444', textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: loading ? '#E2E8F0' : '#1A1A1A', color: loading ? '#94A3B8' : 'white',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
            }}>{loading ? '로그인 중...' : '로그인'}</button>

            {/* 테스트 계정 힌트 */}
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
              <strong>테스트 계정</strong><br />
              관리자: admin@buildus.kr / admin1234<br />
              일반: kim@test.kr / 1234
            </div>
          </form>
        )}

        {/* 회원가입 폼 */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="이름" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="이메일" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <input
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="비밀번호 (4자 이상)" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <input
              type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="비밀번호 확인" required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            {error && <p style={{ margin: 0, fontSize: 13, color: '#EF4444', textAlign: 'center' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: loading ? '#E2E8F0' : '#E8540A', color: loading ? '#94A3B8' : 'white',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
            }}>{loading ? '가입 중...' : '회원가입'}</button>
          </form>
        )}

        <button onClick={onClose} style={{
          display: 'block', width: '100%', marginTop: 16, padding: '8px',
          border: 'none', background: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer',
        }}>닫기</button>
      </div>
    </div>
  );
}
