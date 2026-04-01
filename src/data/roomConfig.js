// 오픈 플랜 그룹: 물리적 벽이 없는 연속 공간끼리 묶음
// 같은 그룹 내 방들은 내부 경계선을 그리지 않아 하나의 공간처럼 보임
export const OPEN_PLAN_GROUPS = [
  ['공간_거실', '공간_주방', '공간_현관'],
];

export const ROOM_CONFIG = {
  공간_거실:       { fill: '#FFF3E0', border: '#FFB74D', label: '거실',    icon: '🛋️' },
  공간_침실:       { fill: '#E3F2FD', border: '#64B5F6', label: '침실',    icon: '🛏️' },
  공간_주방:       { fill: '#E8F5E9', border: '#66BB6A', label: '주방',    icon: '🍳' },
  공간_화장실:     { fill: '#F3E5F5', border: '#BA68C8', label: '화장실',  icon: '🚿' },
  공간_욕실:       { fill: '#E8F4F8', border: '#64B5D6', label: '욕실',    icon: '🚿' },
  공간_현관:       { fill: '#FCE4EC', border: '#F48FB1', label: '현관',    icon: '🚪' },
  공간_발코니:     { fill: '#E0F7FA', border: '#4DD0E1', label: '발코니',  icon: '🌿' },
  공간_드레스룸:   { fill: '#FFF9C4', border: '#FFF176', label: '드레스룸',icon: '👗' },
  공간_다목적공간: { fill: '#EFEBE9', border: '#BCAAA4', label: '다목적',  icon: '📦' },
  공간_실외기실:   { fill: '#ECEFF1', border: '#B0BEC5', label: '실외기실',icon: '❄️' },
  공간_싱크대:     { fill: '#D6EAF8', border: '#5DADE2', label: '싱크대',  icon: '🚰' },
  공간_가스레인지: { fill: '#FDEBD0', border: '#E59866', label: '가스레인지', icon: '🔥' },
  공간_기타:       { fill: '#F5F5F5', border: '#BDBDBD', label: '기타',    icon: '📌' },
  공간_엘리베이터: { fill: '#E8EAF6', border: '#9FA8DA', label: '엘리베이터', icon: '🔼' },
  공간_엘리베이터홀:{ fill: '#E8EAF6', border: '#9FA8DA', label: 'EV홀',  icon: '🔼' },
  공간_계단실:     { fill: '#ECEFF1', border: '#90A4AE', label: '계단실',  icon: '🪜' },
};

// 스타일 뷰 바닥재 색상 — 2D ASKI_FLOOR와 동일한 파스텔 톤
export const ROOM_FLOOR_COLOR = {
  공간_거실:       '#F5F0E8',  // 아이보리 화이트
  공간_주방:       '#F5F0E8',
  공간_현관:       '#EDE8DC',
  공간_침실:       '#E8D5A8',  // 연한 허니-밀색
  공간_드레스룸:   '#E5D09E',
  공간_다목적공간: '#E8D5A8',
  공간_화장실:     '#EDEDED',  // 연한 회색 타일
  공간_욕실:       '#EDEDED',
  공간_발코니:     '#DCDCD8',  // 연한 중성 회색
  공간_실외기실:   '#D8D8D4',
  공간_기타:       '#E8E8E4',
};

export const STRUCT_COLORS = {
  구조_벽체:   '#37474F',
  구조_창호:   '#90CAF9',
  구조_출입문: '#FFCC80',
};

export const THEME = {
  primary:    '#2563EB',
  sidebar:    '#1E293B',
  bg:         '#F8FAFC',
  card:       '#FFFFFF',
  border:     '#E2E8F0',
  text:       '#0F172A',
  textMuted:  '#64748B',
};
