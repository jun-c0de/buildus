import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const USER_NAV = [
  { to: '/cost',        label: '자동견적' },
  { to: '/marketplace', label: '자재몰' },
  { to: '/community',   label: '커뮤니티' },
  { to: '/aichat',      label: 'AI 상담' },
];

const ADMIN_NAV = [
  { to: '/cost',        label: '자동견적' },
  { to: '/marketplace', label: '자재몰' },
  { to: '/community',   label: '커뮤니티' },
  { to: '/aichat',      label: 'AI 상담' },
  { to: '/admin',       label: '🔑 관리' },
];

// 이름 첫 글자 아바타
function Avatar({ name, role }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: role === 'admin' ? '#FEF3C7' : '#EFF6FF',
      color: role === 'admin' ? '#92400E' : '#1D4ED8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 13, flexShrink: 0,
    }}>{name?.[0] ?? '?'}</div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { currentUser, isAdmin, isLoggedIn, logout } = useAuth();
  const isHome = pathname === '/';

  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'signup'
  const [showUserMenu, setShowUserMenu] = useState(false);

  const NAV = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif", background: isHome ? '#FAFAF8' : '#F8FAFC' }}>

      {/* 인증 모달 */}
      {authModal && <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />}

      {/* 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #F1F5F9', height: 60,
        display: 'flex', alignItems: 'center', padding: '0 40px', gap: 32,
      }}>

        {/* 로고 */}
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏠</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.5px' }}>빌드어스</span>
        </NavLink>

        {/* 네비 */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: to === '/admin' ? (isActive ? '#92400E' : '#B45309') : (isActive ? '#1A1A1A' : '#64748B'),
              background: isActive ? (to === '/admin' ? '#FEF3C7' : '#F1F5F9') : 'transparent',
              transition: 'all 0.12s',
            })}>{label}</NavLink>
          ))}
        </nav>

        {/* 사용자 영역 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {isLoggedIn ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px 6px 6px', borderRadius: 22,
                  border: '1px solid #E2E8F0', background: 'white',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
              >
                <Avatar name={currentUser.name} role={currentUser.role} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>{currentUser.name}</div>
                  {isAdmin && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', lineHeight: 1.2 }}>관리자</div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 2 }}>▾</span>
              </button>

              {/* 드롭다운 메뉴 */}
              {showUserMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowUserMenu(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: 'white', borderRadius: 12, border: '1px solid #E2E8F0',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, minWidth: 160, zIndex: 100,
                  }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{currentUser.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{currentUser.email}</div>
                    </div>
                    {isAdmin && (
                      <NavLink to="/admin" onClick={() => setShowUserMenu(false)} style={{
                        display: 'block', padding: '8px 12px', borderRadius: 8,
                        fontSize: 13, color: '#92400E', fontWeight: 600, textDecoration: 'none',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >🔑 관리자 대시보드</NavLink>
                    )}
                    <button onClick={() => { logout(); setShowUserMenu(false); }} style={{
                      display: 'block', width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: 'none', background: 'transparent', textAlign: 'left',
                      fontSize: 13, color: '#EF4444', fontWeight: 600, cursor: 'pointer',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >로그아웃</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => setAuthModal('login')} style={{
                padding: '7px 16px', borderRadius: 8, border: '1px solid #E2E8F0',
                background: 'white', color: '#475569', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>로그인</button>
              <button onClick={() => setAuthModal('signup')} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: '#E8540A', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>회원가입</button>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
