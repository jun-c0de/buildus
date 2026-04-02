import materialsData      from '../data/materials.json';
import processesData      from '../data/processes.json';
import processMaterialsData from '../data/process_materials.json';
import areaReferenceData  from '../data/area_reference.json';

// ── 관리자 자재 (localStorage) ────────────────────────────────────────────────
const AM_KEY = 'buildus_admin_materials';
function loadAdminMaterials() {
  try { return JSON.parse(localStorage.getItem(AM_KEY) || '[]'); } catch { return []; }
}
export function getAdminMaterials() { return loadAdminMaterials(); }
export function saveAdminMaterial(mat) {
  const list = loadAdminMaterials();
  const idx = list.findIndex(m => m.자재코드 === mat.자재코드);
  const next = idx >= 0 ? list.map((m, i) => i === idx ? mat : m) : [mat, ...list];
  localStorage.setItem(AM_KEY, JSON.stringify(next));
  return next;
}
export function deleteAdminMaterial(code) {
  const next = loadAdminMaterials().filter(m => m.자재코드 !== code);
  localStorage.setItem(AM_KEY, JSON.stringify(next));
  return next;
}

// ── 관리자 공정 오버라이드 (localStorage) ─────────────────────────────────────
const AP_KEY = 'buildus_admin_processes';
function loadAdminProcesses() {
  try { return JSON.parse(localStorage.getItem(AP_KEY) || '[]'); } catch { return []; }
}
export function getAdminProcessOverrides() { return loadAdminProcesses(); }
export function saveAdminProcess(proc) {
  const list = loadAdminProcesses();
  const idx = list.findIndex(p => p.공정코드 === proc.공정코드);
  const next = idx >= 0 ? list.map((p, i) => i === idx ? proc : p) : [...list, proc];
  localStorage.setItem(AP_KEY, JSON.stringify(next));
  return next;
}
export function deleteAdminProcess(code) {
  const next = loadAdminProcesses().filter(p => p.공정코드 !== code);
  localStorage.setItem(AP_KEY, JSON.stringify(next));
  return next;
}

// ── 자재몰용 ─────────────────────────────────────────────────────────────────

function formatPrice(가격) {
  if (!가격) return '-';
  const p = 가격.판매가 ?? 가격.쿠팡가 ?? 가격.네이버최저가 ?? 가격.업체가 ?? 가격.도매가;
  return p ? `${p.toLocaleString()}원` : '-';
}

export function getMaterials() {
  const adminList  = loadAdminMaterials();
  const adminMap   = new Map(adminList.map(m => [m.자재코드, m]));
  const officialCodes = new Set(materialsData.map(m => m.자재코드));

  // 공식 자재 + 관리자 오버라이드 병합
  const officialFormatted = materialsData.map(m => {
    const ov = adminMap.get(m.자재코드);
    const merged = ov ? { ...m, ...ov, isOverridden: true } : m;
    const priceNum = ov?.가격_판매가 != null
      ? Number(ov.가격_판매가)
      : (m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가 ?? 0);
    return {
      ...merged,
      category:  [merged.대분류, merged.중분류, merged.소분류].filter(Boolean).join(' > '),
      name:      merged.품명,
      brand:     merged.브랜드 || merged.제조사 || '',
      unit:      merged.단위,
      grade:     merged.등급 || '-',
      price:     priceNum ? `${priceNum.toLocaleString()}원` : formatPrice(m.가격),
      price_num: priceNum,
    };
  });

  // 관리자가 새로 추가한 자재 (공식 코드와 겹치지 않는 것)
  const adminOnly = adminList
    .filter(m => !officialCodes.has(m.자재코드))
    .map(m => ({
      ...m,
      category:  [m.대분류, m.중분류].filter(Boolean).join(' > '),
      name:      m.품명,
      brand:     m.브랜드 || '',
      unit:      m.단위 || '',
      grade:     m.등급 || '-',
      price:     m.가격_판매가 ? `${Number(m.가격_판매가).toLocaleString()}원` : '-',
      price_num: m.가격_판매가 ? Number(m.가격_판매가) : 0,
      isAdminAdded: true,
    }));

  return [...adminOnly, ...officialFormatted];
}

export function getCategories() {
  return [...new Set(materialsData.map(m => m.대분류).filter(Boolean))].sort();
}

// 자재코드로 단일 자재 조회
export function getMaterialByCode(code) {
  return materialsData.find(m => m.자재코드 === code) ?? null;
}

// ── 공정/견적용 ────────────────────────────────────────────────────────────────

export function getProcesses() {
  const overrides = loadAdminProcesses();
  const overrideMap = new Map(overrides.map(p => [p.공정코드, p]));
  const base = [...processesData].sort((a, b) => a.순서 - b.순서)
    .map(p => overrideMap.has(p.공정코드) ? { ...p, ...overrideMap.get(p.공정코드) } : p);
  const baseCodes = new Set(processesData.map(p => p.공정코드));
  const adminOnly = overrides.filter(p => !baseCodes.has(p.공정코드));
  return [...base, ...adminOnly];
}

export function getProcessMaterials(processCode) {
  return processMaterialsData.filter(pm => pm.공정코드 === processCode);
}

export function getAreaByPyeong(pyeong) {
  if (!pyeong || areaReferenceData.length === 0) return null;
  return areaReferenceData.reduce((best, ref) => {
    const diff    = Math.abs(parseInt(ref.평형대)  - pyeong);
    const bestDiff = Math.abs(parseInt(best.평형대) - pyeong);
    return diff < bestDiff ? ref : best;
  });
}

// ── 비용 계산 ──────────────────────────────────────────────────────────────────

// "1~2만" → 15000 (중간값 × 10,000)
function parseRangeKrw(str) {
  if (!str || str === '—') return 0;
  const range = str.match(/([\d.]+)~([\d.]+)만/);
  if (range) return ((parseFloat(range[1]) + parseFloat(range[2])) / 2) * 10000;
  const single = str.match(/([\d.]+)만/);
  if (single) return parseFloat(single[1]) * 10000;
  return 0;
}

// 공정코드 → 적용 면적(m²) + 표시 레이블
function getApplicableArea(processCode, spaces = {}) {
  const { 욕실 = 0, 주방 = 0, 거실 = 0, 안방 = 0, 작은방 = 0, 베란다 = 0 } = spaces;
  const 생활 = 거실 + 안방 + 작은방;
  const 전체 = 욕실 + 주방 + 생활 + 베란다;

  const M = {
    'PROC-01': { area: 전체,        label: '전용면적 전체' },
    'PROC-02': { area: 욕실,        label: '욕실' },
    'PROC-03': { area: 전체,        label: '전용면적 전체' },
    'PROC-04': { area: 욕실,        label: '욕실 바닥' },
    'PROC-05': { area: 베란다,      label: '베란다' },
    'PROC-06': { area: 생활,        label: '거실·안방·작은방' },
    'PROC-07': { area: 생활,        label: '거실·안방·작은방' },
    'PROC-08': { area: 욕실 * 3.5,  label: `욕실 바닥+벽 (${(욕실 * 3.5).toFixed(1)}㎡)` },
    'PROC-09': { area: 생활 * 2.5,  label: `생활공간 벽면 (${(생활 * 2.5).toFixed(1)}㎡)` },
    'PROC-10': { area: 생활,        label: '거실·안방·작은방 바닥' },
    'PROC-11': { area: 생활 * 2.5,  label: `생활공간 벽+천장 (${(생활 * 2.5).toFixed(1)}㎡)` },
    'PROC-12': { area: 주방,        label: '주방' },
    'PROC-13': { area: 0,           label: '일식' },
  };
  return M[processCode] ?? { area: 0, label: '' };
}

export function getProcessAreaLabel(processCode, spaces) {
  return getApplicableArea(processCode, spaces).label;
}

// 공정별 단가 없을 때 폴백 (m²당 원)
const FALLBACK_PER_M2 = {
  'PROC-01': 10000,   // 철거 1만/㎡
  'PROC-02': 150000,  // 설비/배관 15만/㎡ (욕실)
  'PROC-03':  8000,   // 전기 0.8만/㎡
  'PROC-05': 300000,  // 창호 30만/㎡ (베란다)
  'PROC-12': 100000,  // 가구/도기 10만/㎡ (주방)
  'PROC-13':       0,
};

export function estimateCostByProcess(process, spaces) {
  const { area } = getApplicableArea(process.공정코드, spaces);

  const 자재비  = parseRangeKrw(process.단가?.자재비_m2);
  const 인건비  = parseRangeKrw(process.단가?.인건비_m2);
  const perM2   = 자재비 + 인건비;

  if (perM2 > 0 && area > 0) return Math.round(perM2 * area);

  const fallback = FALLBACK_PER_M2[process.공정코드] ?? 0;
  if (fallback > 0 && area > 0) return Math.round(fallback * area);

  return 0;
}
