import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApartments } from '../api/apartments';
import { loadPosts } from '../store/communityStore';

// ── 공통 데이터 ───────────────────────────────────────────────────────
const PAIN_POINTS = [
  { icon: '😰', title: '인테리어가 처음이에요', desc: '공정 순서도 모르고, 뭐부터 시작해야 할지 막막해요' },
  { icon: '🤔', title: '견적이 맞는 건지 모르겠어요', desc: '업체마다 가격이 달라서 기준이 없어요. 바가지 맞는 건 아닌지 불안해요' },
  { icon: '💸', title: '비용을 최대한 아끼고 싶어요', desc: '가능하면 셀프로 하고 싶은데, 어떤 공정이 혼자 가능한지 모르겠어요' },
];

const FEATURES = [
  { icon: '📊', color: '#3B82F6', bg: '#EFF6FF', title: '자동 견적', desc: '평수와 원하는 공간을 고르면 공정별·자재별 비용이 바로 나와요', sub: '13개 공정 · 1,304개 자재 기반', to: '/cost', cta: '견적 계산해보기' },
  { icon: '🤖', color: '#8B5CF6', bg: '#F5F3FF', title: 'AI 상담', desc: '"도배는 얼마에요?", "욕실 타일 셀프 가능한가요?" 뭐든 물어보세요', sub: '데이터 기반 · 24시간 응답', to: '/aichat', cta: '지금 물어보기' },
  { icon: '🧱', color: '#10B981', bg: '#ECFDF5', title: '자재몰', desc: '1,304개 자재의 단가를 공간·등급별로 비교하고 내 목록에 담아두세요', sub: '마감재 · 타일 · 바닥재 · 방수재 외', to: '/marketplace', cta: '자재 둘러보기' },
  { icon: '💬', color: '#F59E0B', bg: '#FFFBEB', title: '커뮤니티', desc: '실제 시공 후기와 견적을 보고, 비슷한 상황의 사람들에게 질문하세요', sub: '시공후기 · 견적공유 · Q&A', to: '/community', cta: '후기 보러가기' },
];

const MOCK_COSTS = [
  { name: '도배', cost: '약 120만원', icon: '🖌️' },
  { name: '강마루', cost: '약 180만원', icon: '🪵' },
  { name: '욕실 타일', cost: '약 95만원', icon: '🚿' },
  { name: '도장 (페인트)', cost: '약 65만원', icon: '🎨' },
  { name: '철거', cost: '약 35만원', icon: '🔨' },
];

const QUICK_CATS = [
  { icon: '📊', label: '자동 견적', desc: '면적 기반 공정 견적', to: '/cost', color: '#3B82F6', bg: '#EFF6FF' },
  { icon: '🧱', label: '자재 쇼핑', desc: '1,304개 자재 비교', to: '/marketplace', color: '#10B981', bg: '#ECFDF5' },
  { icon: '💬', label: '시공 후기', desc: '실제 견적·후기 공유', to: '/community', color: '#F59E0B', bg: '#FFFBEB' },
  { icon: '🤖', label: 'AI 상담', desc: '24시간 데이터 기반', to: '/aichat', color: '#8B5CF6', bg: '#F5F3FF' },
  { icon: '🗺️', label: '평면도', desc: '스타일 뷰 제공', to: '/floorplan', color: '#EC4899', bg: '#FDF2F8' },
  { icon: '🔨', label: '셀프 견적', desc: '자재 직접 선택', to: '/cost', color: '#EF4444', bg: '#FEF2F2' },
];

const MAT_CATS = [
  { icon: '🟦', label: '타일', sub: '욕실·주방·거실', count: 463, color: '#3B82F6', bg: '#EFF6FF', to: '/marketplace' },
  { icon: '📋', label: '벽지', sub: '합지·실크·천연소재', count: 650, color: '#8B5CF6', bg: '#F5F3FF', to: '/marketplace' },
  { icon: '🪟', label: '수전·환기', sub: '욕실·주방 수전', count: 191, color: '#06B6D4', bg: '#ECFEFF', to: '/marketplace' },
  { icon: '🖌️', label: '전체 자재', sub: '전체 카테고리 탐색', count: 1304, color: '#E8540A', bg: '#FFF3EE', to: '/marketplace' },
];

const CAT_KR = { review: '시공후기', quote: '견적공유', qna: 'Q&A', material: '자재', apt: '아파트' };
const CAT_COLOR = { review: '#10B981', quote: '#3B82F6', qna: '#F59E0B', material: '#8B5CF6', apt: '#EC4899' };

// ── 뷰 전환 토글 버튼 ────────────────────────────────────────────────
function ViewToggle({ view, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#1A1A1A', color: 'white',
        borderRadius: 50, padding: '10px 18px 10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
        cursor: 'pointer', transition: 'all 0.15s',
        fontSize: 13, fontWeight: 700,
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#333'}
      onMouseLeave={e => e.currentTarget.style.background = '#1A1A1A'}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: view === 'editorial' ? '#E8540A' : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
      }}>
        {view === 'editorial' ? '🏡' : '📐'}
      </div>
      <span>{view === 'editorial' ? '플랫폼 뷰' : '에디토리얼 뷰'}</span>
      <span style={{ opacity: 0.5, fontSize: 11 }}>전환 →</span>
    </div>
  );
}

// ── 에디토리얼 뷰 (현재 버전) ────────────────────────────────────────
function HomeEditorial({ navigate }) {
  return (
    <div style={{ background: '#FAFAF8' }}>

      {/* 히어로 */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 40px 96px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFF3EE', border: '1px solid #FDDCC8', color: '#E8540A', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, marginBottom: 24 }}>
            ✦ 인테리어 비용, 이제 직접 확인하세요
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.18, letterSpacing: '-2px', margin: '0 0 20px' }}>
            <span style={{ color: '#1A1A1A', display: 'block' }}>인테리어</span>
            <span style={{ color: '#E8540A', display: 'block' }}>비용이 궁금할 때</span>
            <span style={{ color: '#1A1A1A', display: 'block' }}>빌드어스</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.75, marginBottom: 36, maxWidth: 400 }}>
            평수와 공간만 선택하면 공정별·자재별 견적이 바로 나와요.<br />
            업체 없이도 정확한 기준을 가질 수 있어요.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 44, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/cost')}
              style={{ padding: '14px 28px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#333'}
              onMouseLeave={e => e.currentTarget.style.background = '#1A1A1A'}
            >무료로 견적 확인하기 →</button>
            <button onClick={() => navigate('/community')}
              style={{ padding: '14px 24px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#94A3B8'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
            >시공 사례 보기</button>
          </div>
          <div style={{ display: 'flex', gap: 36 }}>
            {[{ value: '25%', label: '평균 비용 절감' }, { value: '30초', label: '견적 소요 시간' }, { value: '무료', label: '견적 비용' }].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#E8540A', letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,84,10,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ background: '#1A1A1A', borderRadius: 20, padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.5px' }}>견적 예시</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>25평 아파트 리모델링</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {MOCK_COSTS.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{item.cost}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', paddingTop: 2 }}>외 8개 공정 포함 시</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>예상 합계</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#E8540A', letterSpacing: '-0.5px' }}>약 1,450만원</span>
            </div>
            <button onClick={() => navigate('/cost')} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >내 집 견적 직접 계산하기 →</button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {['✓ 공정별로 조정 가능', '✓ 셀프 난이도 안내'].map(t => (
              <div key={t} style={{ flex: 1, background: 'white', borderRadius: 10, padding: '10px 14px', border: '1px solid #F1F5F9', fontSize: 12, fontWeight: 600, color: '#475569', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* 이런 분들이에요 */}
      <section style={{ background: 'white', borderTop: '1px solid #F1F5F9', padding: '72px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16 }}>이런 분들께 딱 맞아요</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px', margin: 0 }}>혹시 이런 고민 하고 계세요?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PAIN_POINTS.map(({ icon, title, desc }) => (
              <div key={title} style={{ background: '#FAFAF8', borderRadius: 16, padding: '28px 24px', border: '1px solid #F1F5F9', transition: 'all 0.18s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#F1F5F9'; }}
              >
                <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1A1A1A', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <span style={{ fontSize: 15, color: '#64748B' }}>빌드어스가 </span>
            <span style={{ fontSize: 15, color: '#E8540A', fontWeight: 700 }}>기준</span>
            <span style={{ fontSize: 15, color: '#64748B' }}>을 드릴게요.</span>
          </div>
        </div>
      </section>

      {/* 4가지 기능 */}
      <section style={{ padding: '72px 40px', background: '#FAFAF8' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: '#FFF3EE', border: '1px solid #FDDCC8', color: '#E8540A', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16 }}>기능 소개</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px', margin: '0 0 10px' }}>필요한 건 다 있어요</h2>
            <p style={{ fontSize: 15, color: '#94A3B8', margin: 0 }}>견적부터 자재 구경, AI 상담, 시공 후기까지</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {FEATURES.map(({ icon, color, bg, title, desc, sub, to, cta }) => (
              <div key={title}
                style={{ background: 'white', borderRadius: 18, padding: '28px 28px 24px', border: '1px solid #E2E8F0', transition: 'all 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A', marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 10 }}>{desc}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 14 }}>{sub}</div>
                    <span onClick={() => navigate(to)} style={{ fontSize: 13, fontWeight: 700, color, cursor: 'pointer' }}>{cta} →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3단계 */}
      <section style={{ background: 'white', borderTop: '1px solid #F1F5F9', padding: '72px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16 }}>이용 방법</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px', margin: '0 0 10px' }}>3단계로 끝나요</h2>
          <p style={{ fontSize: 15, color: '#94A3B8', marginBottom: 52 }}>복잡한 절차 없이 바로 시작할 수 있어요</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { step: '01', icon: '📐', title: '평수 · 공간 선택', desc: '몇 평인지, 어떤 공간을 바꾸고 싶은지 선택하세요. 아는 것만 선택해도 돼요.', detail: '거실 / 욕실 / 주방 / 침실 선택 가능' },
              { step: '02', icon: '💰', title: '공정별 견적 확인', desc: '도배·마루·타일 등 공정마다 예상 비용이 자동으로 계산돼요.', detail: '필요 없는 공정은 빼고 조정 가능' },
              { step: '03', icon: '🔑', title: '자재 보고 시공 시작', desc: '자재몰에서 단가를 확인하고, AI에 궁금한 걸 물어보며 진행하세요.', detail: '셀프 가능 공정 안내 포함' },
            ].map(({ step, icon, title, desc, detail }) => (
              <div key={step}
                style={{ background: '#FAFAF8', borderRadius: 16, padding: '32px 24px', border: '1px solid #F1F5F9', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FAFAF8'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', letterSpacing: '2px', marginBottom: 18 }}>STEP {step}</div>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 18 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A', marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 14 }}>{desc}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', background: '#F1F5F9', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#1A1A1A', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 16, letterSpacing: '1px' }}>FREE · NO SIGNUP REQUIRED</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: 'white', letterSpacing: '-1px', margin: '0 0 14px' }}>지금 바로 내 집 견적 확인해보세요</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.6 }}>30초면 충분해요. 회원가입 없이도 바로 사용할 수 있어요.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/cost')}
              style={{ padding: '15px 36px', borderRadius: 12, border: 'none', background: '#E8540A', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#D44A06'}
              onMouseLeave={e => e.currentTarget.style.background = '#E8540A'}
            >무료로 견적 받기 →</button>
            <button onClick={() => navigate('/aichat')}
              style={{ padding: '15px 28px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            >AI에게 먼저 물어보기</button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{ background: '#111', padding: '28px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏠</div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'white' }}>빌드어스</span>
            <span style={{ fontSize: 11, color: '#475569' }}>MVP v0.1 · 용인 수지구</span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>© 2026 BuildUs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

// ── 플랫폼 뷰 (오늘의집 스타일) ─────────────────────────────────────
function HomePlatform({ navigate }) {
  const apts = getApartments();
  const posts = loadPosts().filter(p => p.hot || p.views > 500).slice(0, 3);

  return (
    <div style={{ background: '#FFFFFF', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>

      {/* ── 히어로 ── */}
      <section style={{ background: 'linear-gradient(160deg, #FFF8F5 0%, #FFFDF0 40%, #F5F8FF 100%)', padding: '60px 40px 64px', borderBottom: '1px solid #F0EDE8' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>

          {/* 왼쪽 */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #E8E0D8', borderRadius: 50, padding: '6px 16px 6px 10px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E8540A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🏠</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>인테리어 견적 플랫폼 · 빌드어스</span>
            </div>

            <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.22, letterSpacing: '-1.5px', color: '#1A1A1A', margin: '0 0 18px' }}>
              우리 집 인테리어<br />
              <span style={{ color: '#E8540A' }}>비용</span>을 미리 알아봐요
            </h1>
            <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.75, margin: '0 0 32px', maxWidth: 400 }}>
              아파트 선택부터 자재 선정까지,<br />전문가 없이도 정확한 기준을 가질 수 있어요.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 36, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/cost')}
                style={{ padding: '13px 28px', borderRadius: 50, border: 'none', background: '#E8540A', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,84,10,0.35)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#D44A06'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#E8540A'; e.currentTarget.style.transform = 'none'; }}
              >무료로 견적 받기 →</button>
              <button onClick={() => navigate('/aichat')}
                style={{ padding: '13px 24px', borderRadius: 50, border: '1.5px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >AI에게 물어보기</button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['✓ 회원가입 불필요', '✓ 1,304개 자재 기반', '✓ 30초 견적'].map(t => (
                <span key={t} style={{ fontSize: 12, color: '#64748B', background: 'white', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* 오른쪽 — 퀵 카테고리 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {QUICK_CATS.map(({ icon, label, desc, to, color, bg }) => (
              <div key={label} onClick={() => navigate(to)}
                style={{ background: 'white', borderRadius: 16, padding: '18px 14px', border: '1px solid #F0ECE8', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = color + '60'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#F0ECE8'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 10px' }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 이런 고민 하세요? ── */}
      <section style={{ padding: '56px 40px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E8540A', marginBottom: 6, letterSpacing: '0.5px' }}>이런 분들께 맞아요</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.5px' }}>혹시 이런 고민 하고 계세요?</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {PAIN_POINTS.map(({ icon, title, desc }) => (
              <div key={title} style={{ background: 'white', borderRadius: 20, padding: '28px 24px', border: '1px solid #F0F0F0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'all 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1A1A', marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 단지별 견적 미리보기 ── */}
      <section style={{ padding: '56px 40px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', marginBottom: 6, letterSpacing: '0.5px' }}>자동 견적</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.5px' }}>단지 선택부터 시작해요</h2>
            </div>
            <span onClick={() => navigate('/cost')} style={{ fontSize: 13, color: '#3B82F6', fontWeight: 600, cursor: 'pointer' }}>전체 단지 보기 →</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {apts.slice(0, 8).map(apt => (
              <div key={apt.id} onClick={() => navigate('/cost', { state: { aptId: apt.id, aptName: apt.name } })}
                style={{ background: 'white', borderRadius: 18, border: '1px solid #F0F0F0', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)'; }}
              >
                {/* 썸네일 영역 */}
                <div style={{ height: 90, background: `linear-gradient(135deg, ${['#EFF6FF','#ECFDF5','#FFF3EE','#F5F3FF','#FFFBEB','#FDF2F8','#ECFEFF','#FEF2F2'][apt.id % 8]} 0%, #F8FAFC 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 36 }}>🏢</span>
                </div>
                <div style={{ padding: '14px 14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>{apt.buildYear}년 · {apt.nearStation}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {apt.types.map(t => (
                      <span key={t.pyeong} style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 7px', borderRadius: 6 }}>{t.pyeong}평</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 자재 카테고리 ── */}
      <section style={{ padding: '56px 40px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 6, letterSpacing: '0.5px' }}>자재몰</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.5px' }}>1,304개 자재 직접 골라보기</h2>
            </div>
            <span onClick={() => navigate('/marketplace')} style={{ fontSize: 13, color: '#10B981', fontWeight: 600, cursor: 'pointer' }}>자재몰 가기 →</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {MAT_CATS.map(({ icon, label, sub, count, color, bg, to }) => (
              <div key={label} onClick={() => navigate(to)}
                style={{ background: 'white', borderRadius: 18, padding: '28px 20px', border: '1px solid #F0F0F0', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = color + '40'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#F0F0F0'; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1A1A', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>{sub}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color, background: bg, padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>{count.toLocaleString()}개</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 커뮤니티 인기글 ── */}
      <section style={{ padding: '56px 40px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 6, letterSpacing: '0.5px' }}>커뮤니티</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.5px' }}>실제 시공 후기 · 견적 공유</h2>
            </div>
            <span onClick={() => navigate('/community')} style={{ fontSize: 13, color: '#F59E0B', fontWeight: 600, cursor: 'pointer' }}>전체 보기 →</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {posts.map(post => (
              <div key={post.id} onClick={() => navigate('/community')}
                style={{ background: 'white', borderRadius: 18, border: '1px solid #F0F0F0', padding: '20px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: CAT_COLOR[post.category] ?? '#64748B', background: (CAT_COLOR[post.category] ?? '#64748B') + '15', padding: '3px 8px', borderRadius: 20 }}>
                    {CAT_KR[post.category] ?? post.category}
                  </span>
                  {post.hot && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '3px 8px', borderRadius: 20 }}>🔥 HOT</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.5, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {post.title}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{post.author}</span>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8' }}>
                    <span>👁 {post.views.toLocaleString()}</span>
                    <span>💬 {post.comments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA 배너 ── */}
      <section style={{ background: 'linear-gradient(135deg, #E8540A 0%, #FF7A3D 100%)', padding: '64px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: 'white', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
            지금 바로 내 집 견적을 확인해봐요
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', margin: '0 0 32px', lineHeight: 1.6 }}>
            30초면 충분해요. 회원가입 없이 무료로 사용할 수 있어요.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/cost')}
              style={{ padding: '14px 32px', borderRadius: 50, border: 'none', background: 'white', color: '#E8540A', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
            >무료로 견적 받기 →</button>
            <button onClick={() => navigate('/aichat')}
              style={{ padding: '14px 28px', borderRadius: 50, border: '2px solid rgba(255,255,255,0.5)', background: 'transparent', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'white'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
            >AI 상담 받기</button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{ background: '#111', padding: '28px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏠</div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'white' }}>빌드어스</span>
            <span style={{ fontSize: 11, color: '#475569' }}>MVP v0.1 · 용인 수지구</span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>© 2026 BuildUs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('buildus_home_view') ?? 'editorial'; } catch { return 'editorial'; }
  });

  function toggle() {
    const next = view === 'editorial' ? 'platform' : 'editorial';
    setView(next);
    try { localStorage.setItem('buildus_home_view', next); } catch {}
  }

  return (
    <>
      {view === 'editorial'
        ? <HomeEditorial navigate={navigate} />
        : <HomePlatform navigate={navigate} />
      }
      <ViewToggle view={view} onToggle={toggle} />
    </>
  );
}
