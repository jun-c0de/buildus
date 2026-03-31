import data from '../data/standardunit_pricing.json';

const _materials = data.filter(d => d.tab === '자재비' && d.price_num);

export function getMaterials() { return _materials; }

export function getMaterialsByCategory(category) {
  if (!category || category === '전체') return _materials;
  return _materials.filter(m => m.category.split(' > ')[0] === category);
}

export function getCategories() {
  return [...new Set(_materials.map(m => m.category.split(' > ')[0]))].sort();
}

export function getPricingByProcess(processKey) {
  return _materials.filter(m => m.category.split(' > ')[0] === processKey);
}

// ── 공정별 평당 단가 (standardunit 실데이터 기반 + 업계 표준) ──────────────
// 바닥(평단위), 철거(평단위) → standardunit 실측
// 나머지 → 업계 표준 (standardunit 단품 단가 × 적정 수량 / 평)
export const COST_PER_PYEONG = {
  '철거':      50000,   // standardunit 철거 평단위 평균 ~5만원/평
  '목공':     200000,   // 업계 표준 15~25만원/평
  '욕실':     130000,   // 욕실 1실 ~300만원 / 23평 환산
  '타일':      80000,   // 욕실+주방 타일 합산
  '바닥':     110000,   // standardunit 바닥재 중급 평균 ~11만원/평
  '도배':      60000,   // 부자재+인건비 합산 ~6만원/평
  '주방':     100000,   // 싱크대 세트 ~250만원 / 25평
  '샷시':     100000,   // 발코니 창호 ~250만원 / 25평
  '전기/조명': 80000,   // 업계 표준 8~12만원/평
  '필름':      30000,   // 업계 표준 3~5만원/평
};

export function estimateCost(processKey, pyeong) {
  return Math.round((COST_PER_PYEONG[processKey] || 0) * pyeong);
}
