import { NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/cost',        label: '자동견적' },
  { to: '/community',   label: '커뮤니티' },
  { to: '/marketplace', label: '자재몰' },
  { to: '/aichat',      label: 'AI 상담' },
  { to: '/label',       label: '✏️ 라벨링' },
];

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif", background: isHome ? '#FAFAF8' : '#F8FAFC' }}>

      {/* 상단 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #F1F5F9',
        height: 60,
        display: 'flex', alignItems: 'center',
        padding: '0 40px',
        gap: 32,
      }}>
        {/* 로고 */}
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#1A1A1A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🏠</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.5px' }}>빌드어스</span>
        </NavLink>

        {/* 네비 */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                padding: '6px 14px', borderRadius: 6,
                textDecoration: 'none',
                fontSize: 14, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#1A1A1A' : '#64748B',
                background: isActive ? '#F1F5F9' : 'transparent',
                transition: 'all 0.12s',
              })}
            >{label}</NavLink>
          ))}
        </nav>

        {/* 로그인/회원가입 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: 'transparent', color: '#475569',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>로그인</button>
          <button style={{
            padding: '7px 18px', borderRadius: 8, border: 'none',
            background: '#E8540A', color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>회원가입</button>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
