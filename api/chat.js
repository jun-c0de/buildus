import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 서버 기동 시 한 번만 로드 (cold start 최적화)
const cwd = process.cwd();
const processes = JSON.parse(readFileSync(join(cwd, 'src/data/processes.json'), 'utf-8'));
const qa        = JSON.parse(readFileSync(join(cwd, 'src/data/qa.json'), 'utf-8'));
const materials = JSON.parse(readFileSync(join(cwd, 'src/data/materials.json'), 'utf-8'));

// 자재 카테고리 요약 (컨텍스트 길이 절약)
const catCounts = materials.reduce((acc, m) => {
  acc[m.대분류] = (acc[m.대분류] || 0) + 1;
  return acc;
}, {});
const matSummary = Object.entries(catCounts).map(([k, v]) => `${k} ${v}개`).join(', ');

// 질문 키워드로 관련 자재 최대 8개 검색
function findRelevantMaterials(query) {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length > 1);
  return materials
    .map(m => {
      const text = [m.품명, m.대분류, m.중분류, m.소분류, m.브랜드, ...(m.추천공간 ?? [])].join(' ').toLowerCase();
      const score = keywords.filter(kw => text.includes(kw)).length;
      return { m, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => {
      const m = x.m;
      const price = m.가격?.판매가 ?? m.가격?.쿠팡가 ?? m.가격?.네이버최저가;
      return `- ${m.품명} (${m.브랜드 ?? m.제조사 ?? ''}, ${m.단위}${price ? ', ' + price.toLocaleString() + '원' : ''}) [${m.등급 ?? ''}]`;
    })
    .join('\n');
}

function buildSystemPrompt(userQuestion, customMaterials) {
  const procList = processes
    .map(p => `${p.순서}. ${p.공정명}: 셀프난이도 ${p.셀프난이도}, 단가 ${p.단가?.적정합계범위 ?? '견적 필요'}, 시공 ${p.기간?.합계일}일`)
    .join('\n');

  const qaList = qa.map(q => `Q: ${q.질문}\nA: ${q.답변}`).join('\n\n');

  const relevantMats = findRelevantMaterials(userQuestion);
  const matSection = relevantMats
    ? `\n## 질문 관련 자재\n${relevantMats}`
    : '';

  const customSection = customMaterials?.length > 0
    ? `\n## 사용자 직접 등록 자재\n${customMaterials.map(m => `- ${m.품명} (${m.대분류}, ${m.단위}${m.가격 ? ', ' + Number(m.가격).toLocaleString() + '원' : ''})`).join('\n')}`
    : '';

  return `당신은 빌드어스(buildus) 인테리어 플랫폼의 AI 상담사입니다.
빌드어스는 용인시 수지구 상현동 아파트 인테리어 견적·자재 비교 플랫폼입니다.

## 공정 정보 (시공 순서)
${procList}

## 자재 DB (총 ${materials.length}개)
카테고리: ${matSummary}${matSection}${customSection}

## 자주 묻는 Q&A
${qaList}

## 응답 원칙
- 한국어로 친절하고 전문적으로 답변
- 비용 관련엔 구체적 단가 범위 제시
- 자재 추천 시 등급·추천공간 기준 안내
- 공정 순서나 선행 조건 있으면 반드시 언급
- 3~6문장 내외로 간결하게
- 확실하지 않은 내용은 전문가 현장 상담 권유`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages = [], customMaterials = [] } = req.body ?? {};
  if (!messages.length) {
    return res.status(400).json({ error: 'No messages' });
  }

  const userQuestion = messages.at(-1)?.text ?? '';

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: buildSystemPrompt(userQuestion, customMaterials),
      messages: messages
        .filter(m => m.id !== 0)                           // 웰컴 메시지 제외
        .map(m => ({ role: m.role, content: m.text })),
    });

    res.status(200).json({ text: response.content[0].text });
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.status(500).json({ error: '잠시 후 다시 시도해 주세요.' });
  }
}
