/**
 * 빌드어스 데이터 기반 로컬 AI 엔진
 * Anthropic API 없이 processes.json / qa.json / materials.json 기반으로 응답 생성
 */

import processesData      from '../data/processes.json';
import qaData             from '../data/qa.json';
import materialsData      from '../data/materials.json';
import processMatsData    from '../data/process_materials.json';
import areaReferenceData  from '../data/area_reference.json';

// ── 공정 키워드 매핑 ─────────────────────────────────────────────────────────
const PROC_KEYWORDS = {
  'PROC-01': ['철거', '해체', '뜯기', '기존 마감'],
  'PROC-02': ['설비', '배관', '수도', '급수', '배수'],
  'PROC-03': ['전기', '전선', '콘센트', '조명', '스위치'],
  'PROC-04': ['방수', '누수', '물새', '방수액', '방수재'],
  'PROC-05': ['창호', '샷시', '새시', '창문', '발코니창'],
  'PROC-06': ['목공', '몰딩', '천장틀', '석고보드'],
  'PROC-07': ['필름', '시트지', '랩핑', '도어필름'],
  'PROC-08': ['타일', '도기질', '세라믹', '포슬레인', '줄눈', '타일본드'],
  'PROC-09': ['도장', '페인트', '퍼티', '도색', '벽칠'],
  'PROC-10': ['마루', '강마루', '장판', 'lvt', '바닥재', '바닥'],
  'PROC-11': ['도배', '벽지', '합지', '실크', '디아망', '방염'],
  'PROC-12': ['가구', '싱크대', '주방', '도기', '세면대', '욕조', '변기'],
  'PROC-13': ['준공', '마무리', '점검'],
};

// 키워드 → 공정코드 역색인
const KEYWORD_TO_PROC = {};
Object.entries(PROC_KEYWORDS).forEach(([code, kws]) => {
  kws.forEach(kw => { KEYWORD_TO_PROC[kw] = code; });
});

// ── 헬퍼 ────────────────────────────────────────────────────────────────────
function normalize(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }

// 문자열에서 평수 추출 (예: "25평" → 25)
function extractPyeong(msg) {
  const m = msg.match(/(\d+)\s*평/);
  return m ? parseInt(m[1]) : null;
}

// 단가 범위 파싱 "1~2만" → { min:10000, max:20000, mid:15000 }
function parseRange(str) {
  if (!str || str === '—') return null;
  const m = str.match(/([\d.]+)~([\d.]+)만/);
  if (m) {
    const min = parseFloat(m[1]) * 10000;
    const max = parseFloat(m[2]) * 10000;
    return { min, max, mid: (min + max) / 2 };
  }
  return null;
}

// 가장 가까운 면적 참조 조회
function getAreaRef(pyeong) {
  return areaReferenceData.reduce((best, ref) => {
    const diff     = Math.abs(parseInt(ref.평형대) - pyeong);
    const bestDiff = Math.abs(parseInt(best.평형대) - pyeong);
    return diff < bestDiff ? ref : best;
  });
}

// 공정코드 → 공정 객체
const PROC_MAP = Object.fromEntries(processesData.map(p => [p.공정코드, p]));

// ── 면적별 비용 추정 ─────────────────────────────────────────────────────────
const FALLBACK_PER_M2 = {
  'PROC-01': 10000, 'PROC-02': 150000, 'PROC-03': 8000,
  'PROC-05': 300000, 'PROC-12': 100000, 'PROC-13': 0,
};

function procCostBySpaces(code, spaces) {
  const { 욕실=0, 주방=0, 거실=0, 안방=0, 작은방=0, 베란다=0 } = spaces;
  const 생활 = 거실 + 안방 + 작은방;
  const 전체 = 욕실 + 주방 + 생활 + 베란다;

  const areaMap = {
    'PROC-01': 전체, 'PROC-02': 욕실,  'PROC-03': 전체,
    'PROC-04': 욕실, 'PROC-05': 베란다,'PROC-06': 생활,
    'PROC-07': 생활, 'PROC-08': 욕실*3.5,
    'PROC-09': 생활*2.5, 'PROC-10': 생활,
    'PROC-11': 생활*2.5, 'PROC-12': 주방, 'PROC-13': 0,
  };
  const area = areaMap[code] ?? 0;
  const proc = PROC_MAP[code];
  if (!proc) return 0;

  const 자재비 = parseRange(proc.단가?.자재비_m2)?.mid ?? 0;
  const 인건비 = parseRange(proc.단가?.인건비_m2)?.mid ?? 0;
  const perM2  = 자재비 + 인건비 || FALLBACK_PER_M2[code] || 0;
  return Math.round(perM2 * area);
}

// ── 응답 생성 함수들 ─────────────────────────────────────────────────────────

function respondCostByPyeong(pyeong) {
  const ref    = getAreaRef(pyeong);
  const spaces = ref.공간별면적;
  const costs  = processesData.map(p => ({
    proc: p,
    cost: procCostBySpaces(p.공정코드, spaces),
  }));

  const total = costs.reduce((s, x) => s + x.cost, 0);
  const items = costs
    .filter(x => x.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .map(x => `  • ${x.proc.공정명}: 약 ${(x.cost/10000).toFixed(0)}만원`)
    .join('\n');

  return `${ref.평형대} 기준 전체 리모델링 예상 견적입니다.

공정별 주요 비용 (중급 기준):
${items}
  ・・・ (총 13개 공정)

합계: 약 ${(total/10000).toFixed(0)}만원

※ 공정별 면적 기반 계산이며, 현장 상황에 따라 ±30% 차이가 날 수 있습니다. 자동견적 메뉴에서 공정별로 직접 조정해보세요!`;
}

function respondProcess(code) {
  const proc = PROC_MAP[code];
  if (!proc) return null;
  const mats = processMatsData.filter(m => m.공정코드 === code);
  const matList = mats.length > 0
    ? '\n\n필요 자재:\n' + mats.map(m => `  • ${m.자재명} (${m.필수여부}, ${m.실소요량_1m2?.toFixed(2)}${m.단위}/㎡)`).join('\n')
    : '';

  const range = proc.단가?.적정합계범위 && proc.단가.적정합계범위 !== '—'
    ? `단가 범위: ${proc.단가.적정합계범위}`
    : '';

  return `[${proc.공정명}] 공정 정보

순서: ${proc.순서}번째 공정${proc.선행공정 ? ` (${proc.선행공정} 이후)` : ''}
시공 기간: 약 ${proc.기간?.합계일}일 (시공 ${proc.기간?.시공일}일 + 양생 ${proc.기간?.양생일}일)
${range}
셀프 난이도: ${proc.셀프난이도}${matList}`;
}

function respondMaterials(keyword) {
  const q = normalize(keyword);
  const matched = materialsData
    .filter(m => {
      const text = normalize([m.품명, m.대분류, m.중분류, m.소분류, m.브랜드].join(''));
      return text.includes(q);
    })
    .slice(0, 5);

  if (!matched.length) return null;

  const lines = matched.map(m => {
    const price = m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가;
    const priceStr = price ? `${price.toLocaleString()}원` : '가격 미정';
    const spaces = m.추천공간?.join(', ') || '-';
    return `  • ${m.품명} (${m.브랜드||m.제조사||''}, ${m.단위}, ${priceStr})\n    추천공간: ${spaces}`;
  }).join('\n');

  return `"${keyword}" 관련 자재 검색 결과 (${matched.length}건):

${lines}

자재몰 메뉴에서 더 많은 자재를 검색해보세요!`;
}

function respondQA(msg) {
  const q = normalize(msg);
  let best = null, bestScore = 0;

  for (const item of qaData) {
    const question = normalize(item.질문);
    // 키워드 오버랩 점수
    const qWords = question.split('').filter((_, i) => i % 2 === 0); // 2글자 단위
    let score = 0;
    for (let i = 0; i < q.length - 1; i++) {
      if (question.includes(q.slice(i, i+2))) score++;
    }
    if (score > bestScore) { bestScore = score; best = item; }
  }

  return bestScore >= 3 ? `${best.질문}\n\n${best.답변}` : null;
}

function respondProcessOrder() {
  const sorted = [...processesData].sort((a, b) => a.순서 - b.순서);
  const lines = sorted.map(p =>
    `${p.순서}. ${p.공정명} (${p.기간?.합계일}일, 셀프${p.셀프난이도})`
  ).join('\n');
  return `인테리어 공정 순서 (총 13단계):

${lines}

각 공정은 선행 공정이 완료된 후 진행합니다. 예: 방수 완료 후 타일, 도장 후 마루·도배 순서입니다.`;
}

function respondDifficulty(level) {
  const procs = processesData.filter(p => p.셀프난이도 === level);
  const lines = procs.map(p => `  • ${p.공정명}: ${p.단가?.적정합계범위 || '견적 필요'}`).join('\n');
  const label = { '하': '쉬운', '중': '보통', '상': '어려운' }[level] || '';
  return `셀프 난이도 "${level}" (${label}) 공정:\n\n${lines}\n\n"하" 등급은 가이드 영상만 보고도 충분히 도전 가능합니다.`;
}

// ── 메인 엔진 ────────────────────────────────────────────────────────────────

const GREETINGS = ['안녕', '하이', '안녕하세요', '반가', '헬로'];

export function generateResponse(userMsg) {
  const msg  = userMsg.trim();
  const norm = normalize(msg);

  // 0. 인사
  if (GREETINGS.some(g => norm.startsWith(g))) {
    return `안녕하세요! 빌드어스 AI 상담사입니다 😊\n\n인테리어 관련해서 궁금한 게 있으시면 뭐든 물어보세요.\n\n예를 들어:\n  • "25평 전체 리모델링 비용이 얼마나 돼요?"\n  • "방수 공정 어떻게 하는 건가요?"\n  • "실크벽지랑 합지벽지 차이가 뭔가요?"\n  • "셀프로 할 수 있는 공정이 뭐가 있나요?"`;
  }

  // 1. QA 직접 매칭
  const qaResult = respondQA(norm);
  if (qaResult) return qaResult;

  // 2. 공정 순서 질문
  if (['순서', '순서가', '먼저', '다음', '단계'].some(k => norm.includes(k)) &&
      ['공정', '시공', '인테리어'].some(k => norm.includes(k))) {
    return respondProcessOrder();
  }

  // 3. 셀프 난이도 질문
  if (['셀프', '혼자', '직접'].some(k => norm.includes(k))) {
    if (['쉬운', '쉽', '초보', '간단'].some(k => norm.includes(k))) return respondDifficulty('하');
    if (['어려운', '어렵', '힘든'].some(k => norm.includes(k))) return respondDifficulty('상');
    return respondDifficulty('하') + '\n\n' + '---\n\n' + respondDifficulty('중');
  }

  // 4. 비용 / 견적 질문
  const pyeong = extractPyeong(msg);
  if (['비용', '얼마', '견적', '가격', '돈', '금액', '단가'].some(k => norm.includes(k))) {
    if (pyeong) return respondCostByPyeong(pyeong);
    // 공정별 비용
    for (const [kw, code] of Object.entries(KEYWORD_TO_PROC)) {
      if (norm.includes(kw)) {
        const proc = PROC_MAP[code];
        const range = proc?.단가?.적정합계범위;
        if (range && range !== '—') {
          const ref = getAreaRef(25); // 기본 25평 기준
          const cost = procCostBySpaces(code, ref.공간별면적);
          return `[${proc.공정명}] 비용 안내\n\n단가 범위: ${range}\n25평 기준 예상: 약 ${(cost/10000).toFixed(0)}만원\n\n구체적인 평수를 알려주시면 더 정확하게 계산해드릴게요!`;
        }
      }
    }
    return `몇 평 기준으로 알고 싶으신가요? 예: "25평 전체 비용이 얼마에요?"\n\n현재 18평·25평·32평·34평·43평 기준 데이터가 있습니다.`;
  }

  // 5. 특정 공정 상세 정보
  for (const [kw, code] of Object.entries(KEYWORD_TO_PROC)) {
    if (norm.includes(kw)) {
      const result = respondProcess(code);
      if (result) return result;
    }
  }

  // 6. 자재 검색
  if (['자재', '추천', '종류', '어떤게', '뭐가좋', '제품'].some(k => norm.includes(k))) {
    // 자재 키워드 추출
    const matKeywords = ['벽지', '실크', '합지', '타일', '마루', '장판', '방수', '페인트', '본드', '퍼티'];
    for (const kw of matKeywords) {
      if (norm.includes(kw)) {
        const result = respondMaterials(kw);
        if (result) return result;
      }
    }
  }

  // 7. 평수만 언급된 경우
  if (pyeong) return respondCostByPyeong(pyeong);

  // 8. 자재 단순 검색
  for (const kw of ['벽지', '타일', '마루', '방수', '페인트', '필름']) {
    if (norm.includes(kw)) {
      const result = respondMaterials(kw);
      if (result) return result;
    }
  }

  // 9. Fallback
  return `죄송합니다, 질문을 정확히 이해하지 못했어요 😅\n\n아래와 같이 물어봐 주시면 도움드릴 수 있어요:\n\n  • 비용 문의: "25평 전체 인테리어 비용이 얼마에요?"\n  • 공정 정보: "방수 공정은 어떻게 하나요?"\n  • 공정 순서: "인테리어 공정 순서 알려줘"\n  • 자재 추천: "실크벽지 제품 추천해줘"\n  • 셀프 시공: "혼자 할 수 있는 공정이 뭐가 있어요?"`;
}
