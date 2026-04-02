import { createContext, useContext, useState } from 'react';

// ── 임시 사용자 데이터 (seed) ─────────────────────────────────────────────────
const SEED_USERS = [
  {
    id: 1,
    name: '관리자',
    email: 'admin@buildus.kr',
    password: 'admin1234',
    role: 'admin',
    joinedAt: '2025-01-01',
    avatar: null,
  },
  {
    id: 2,
    name: '김철수',
    email: 'kim@test.kr',
    password: '1234',
    role: 'user',
    joinedAt: '2025-03-10',
    avatar: null,
  },
  {
    id: 3,
    name: '이영희',
    email: 'lee@test.kr',
    password: '1234',
    role: 'user',
    joinedAt: '2025-03-22',
    avatar: null,
  },
];

// ── localStorage 유저 DB ──────────────────────────────────────────────────────
function initUsers() {
  try {
    const stored = localStorage.getItem('buildus_users');
    if (!stored) {
      localStorage.setItem('buildus_users', JSON.stringify(SEED_USERS));
      return SEED_USERS;
    }
    return JSON.parse(stored);
  } catch { return SEED_USERS; }
}

function persistUsers(users) {
  localStorage.setItem('buildus_users', JSON.stringify(users));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('buildus_session') || 'null'); }
  catch { return null; }
}

// ── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getSession);

  function login(email, password) {
    const users = initUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    const { password: _, ...safe } = found;
    setCurrentUser(safe);
    localStorage.setItem('buildus_session', JSON.stringify(safe));
    return safe;
  }

  function signup(name, email, password) {
    const users = initUsers();
    if (users.find(u => u.email === email)) throw new Error('이미 사용 중인 이메일입니다.');
    const newUser = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'user',
      joinedAt: new Date().toISOString().split('T')[0],
      avatar: null,
    };
    persistUsers([...users, newUser]);
    const { password: _, ...safe } = newUser;
    setCurrentUser(safe);
    localStorage.setItem('buildus_session', JSON.stringify(safe));
    return safe;
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem('buildus_session');
  }

  // 관리자 전용: 사용자 역할 변경
  function changeRole(userId, newRole) {
    if (currentUser?.role !== 'admin') return;
    const users = initUsers();
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    persistUsers(updated);
  }

  // 관리자 전용: 전체 사용자 조회
  function getAllUsers() {
    if (currentUser?.role !== 'admin') return [];
    return initUsers().map(({ password: _, ...u }) => u);
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAdmin: currentUser?.role === 'admin',
      isLoggedIn: !!currentUser,
      login, signup, logout, changeRole, getAllUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
