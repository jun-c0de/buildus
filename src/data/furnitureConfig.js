// 가구 카탈로그 - GLB 단위: mm → Three.js에서 scale={0.001} 적용
// thumbCam: 썸네일 미리보기 카메라 위치 [x, y, z]

const CABINETS = [
  {
    id: 'base_cabinet_A',
    name: '하부장 A',
    glbClosed: '/models/furniture/base_cabinet_A_closed.glb',
    glbOpen:   '/models/furniture/base_cabinet_A_open.glb',
    width: 0.60, height: 0.90, depth: 0.65,
    thumbCam: [0.8, 0.75, 1.0],
  },
  {
    id: 'base_cabinet_B',
    name: '하부장 B',
    glbClosed: '/models/furniture/base_cabinet_B_closed.glb',
    glbOpen:   '/models/furniture/base_cabinet_B_open.glb',
    width: 0.60, height: 0.90, depth: 0.65,
    thumbCam: [0.8, 0.75, 1.0],
  },
  {
    id: 'base_cabinet_C',
    name: '하부장 C',
    glbClosed: '/models/furniture/base_cabinet_C_closed.glb',
    glbOpen:   '/models/furniture/base_cabinet_C_open.glb',
    width: 0.60, height: 0.90, depth: 0.65,
    thumbCam: [0.8, 0.75, 1.0],
  },
  {
    id: 'base_cabinet_D',
    name: '하부장 D',
    glbClosed: '/models/furniture/base_cabinet_D_closed.glb',
    glbOpen:   '/models/furniture/base_cabinet_D_open.glb',
    width: 0.60, height: 0.90, depth: 0.65,
    thumbCam: [0.8, 0.75, 1.0],
  },
  {
    id: 'upper_cabinet',
    name: '상부장',
    glbClosed: '/models/furniture/upper_cabinet_closed.glb',
    glbOpen:   '/models/furniture/upper_cabinet_open.glb',
    width: 0.60, height: 0.82, depth: 0.40,
    thumbCam: [0.8, 0.75, 1.0],
  },
  {
    id: 'tall_cabinet',
    name: '키큰장',
    glbClosed: '/models/furniture/tall_cabinet_closed.glb',
    glbOpen:   '/models/furniture/tall_cabinet_open.glb',
    width: 0.60, height: 2.30, depth: 0.65,
    thumbCam: [1.0, 1.6, 2.2],
  },
];

// 전체 플랫 목록 (하위 호환)
export const FURNITURE_CATALOG = CABINETS;

// 카테고리 구조 (아키스케치 스타일 패널용)
export const FURNITURE_CATEGORIES = [
  {
    id: 'tables',
    label: '테이블',
    emoji: '🍽',
    color: '#FEF3C7',
    items: [],
  },
  {
    id: 'chairs',
    label: '의자',
    emoji: '🪑',
    color: '#EFF6FF',
    items: [],
  },
  {
    id: 'sofas',
    label: '소파',
    emoji: '🛋',
    color: '#F0FDF4',
    items: [],
  },
  {
    id: 'bedroom',
    label: '침실',
    emoji: '🛏',
    color: '#FDF4FF',
    items: [],
  },
  {
    id: 'storage',
    label: '수납장',
    emoji: '🗄',
    color: '#FFF7ED',
    items: CABINETS,
  },
  {
    id: 'lighting',
    label: '조명',
    emoji: '💡',
    color: '#FEFCE8',
    items: [],
  },
];

// 좌측 사이드바 카테고리 탭
export const SIDEBAR_TABS = [
  { id: 'furniture', label: '가구', emoji: '🪑' },
  { id: 'flooring',  label: '바닥재', emoji: '🪵' },
  { id: 'wallpaper', label: '도배',  emoji: '🎨' },
  { id: 'lighting',  label: '조명',  emoji: '💡' },
];

export function getFurnitureById(id) {
  return FURNITURE_CATALOG.find(f => f.id === id);
}
