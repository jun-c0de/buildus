import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#FAFAF8' }}>

      {/* ── 히어로 섹션 ── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '80px 40px 100px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center',
      }}>
        {/* 왼쪽 텍스트 */}
        <div>
          {/* 별점 뱃지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ color: '#F59E0B', fontSize: 14 }}>★</span>
              ))}
            </div>
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>3,247명 이 견적 받았어요</span>
          </div>

          {/* 메인 타이틀 */}
          <h1 style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-2px', margin: 0, marginBottom: 20 }}>
            <span style={{ color: '#1A1A1A', display: 'block' }}>인테리어에</span>
            <span style={{ color: '#E8540A', display: 'block' }}>전문가는</span>
            <span style={{ color: '#1A1A1A', display: 'block' }}>필요 없습니다</span>
          </h1>

          <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.7, marginBottom: 36, maxWidth: 420 }}>
            필요한 건 정확한 정보와 적당한 가격입니다.<br />
            빌드어스가 둘 다 드립니다.
          </p>

          {/* CTA 버튼 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
            <button
              onClick={() => navigate('/cost')}
              style={{
                padding: '14px 28px', borderRadius: 10, border: 'none',
                background: '#1A1A1A', color: 'white',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#333'}
              onMouseLeave={e => e.currentTarget.style.background = '#1A1A1A'}
            >
              30초 만에 내 견적 확인 →
            </button>
            <button
              onClick={() => navigate('/apartments')}
              style={{
                padding: '14px 24px', borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                background: 'white', color: '#475569',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#94A3B8'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
            >
              실제 철학 사례 보기
            </button>
          </div>

          {/* 통계 */}
          <div style={{ display: 'flex', gap: 40 }}>
            {[
              { value: '25%', label: '평균 절감률' },
              { value: '30초', label: '견적 소요 시간' },
              { value: '무료', label: '견적 비용' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#E8540A', letterSpacing: '-1px' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽 카드 미리보기 */}
        <div style={{ position: 'relative' }}>
          {/* 배경 블러 원 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 360, height: 360, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,84,10,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* 메인 카드 */}
          <div style={{
            background: '#1A1A1A', borderRadius: 20, padding: 28,
            marginBottom: 16, position: 'relative', zIndex: 1,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>📋</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>자동 견적 시스템</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
              원하는 아파트와 평형을 선택하면<br />공정별·자재별 상세 견적이 바로 나와요
            </div>
          </div>

          {/* 하단 두 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              onClick={() => navigate('/aichat')}
              style={{
                background: 'white', borderRadius: 14, padding: '20px 18px',
                border: '1px solid #F1F5F9', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)'}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>🤖</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 4 }}>AI 상담</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>24시간 전문 상담</div>
            </div>
            <div
              onClick={() => navigate('/marketplace')}
              style={{
                background: 'white', borderRadius: 14, padding: '20px 18px',
                border: '1px solid #F1F5F9', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)'}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>🛒</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 4 }}>자재몰</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>업체가격 구매</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3단계 섹션 ── */}
      <section style={{
        background: 'white',
        padding: '80px 40px',
        borderTop: '1px solid #F1F5F9',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {/* 뱃지 */}
          <div style={{
            display: 'inline-block', background: '#FFF3EE',
            border: '1px solid #FDDCC8', color: '#E8540A',
            fontSize: 12, fontWeight: 600, padding: '5px 14px',
            borderRadius: 20, marginBottom: 20,
          }}>이용 방법</div>

          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px', marginBottom: 10 }}>
            이렇게 간단해요
          </h2>
          <p style={{ fontSize: 15, color: '#94A3B8', marginBottom: 56 }}>
            복잡한 절차 없이, 3단계로 끝
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                step: '01',
                icon: '🎨',
                title: '스타일 선택',
                desc: '원하는 인테리어 스타일과 공간 정보를 선택하세요',
                cta: '지금 시작',
                to: '/cost',
              },
              {
                step: '02',
                icon: '📊',
                title: '견적 확인',
                desc: '공정별·자재별 상세 견적이 자동으로 생성됩니다',
                cta: '확인',
                to: '/cost',
              },
              {
                step: '03',
                icon: '🔑',
                title: '시공 시작',
                desc: 'AI 가이드와 커뮤니티의 도움으로 직접 시공하세요',
                cta: '내 속도에 맞게',
                to: '/apartments',
              },
            ].map(card => (
              <div
                key={card.step}
                style={{
                  background: '#FAFAF8', borderRadius: 16, padding: '32px 28px',
                  border: '1px solid #F1F5F9', textAlign: 'left',
                  transition: 'all 0.15s', cursor: 'pointer',
                }}
                onClick={() => navigate(card.to)}
                onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FAFAF8'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#CBD5E1', marginBottom: 20, letterSpacing: '1px' }}>
                  {card.step}
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: '#FFF3EE', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 22, marginBottom: 20,
                }}>{card.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1A1A', marginBottom: 10 }}>{card.title}</div>
                <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>{card.desc}</div>
                <div style={{ fontSize: 13, color: '#E8540A', fontWeight: 600 }}>{card.cta} →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA 섹션 ── */}
      <section style={{
        background: '#1A1A1A', padding: '80px 40px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: 'white', letterSpacing: '-1px', marginBottom: 16 }}>
            지금 바로 시작해보세요
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 36 }}>
            30초 만에 우리 집 인테리어 견적을 확인해보세요
          </p>
          <button
            onClick={() => navigate('/cost')}
            style={{
              padding: '16px 40px', borderRadius: 12, border: 'none',
              background: '#E8540A', color: 'white',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#D44A06'}
            onMouseLeave={e => e.currentTarget.style.background = '#E8540A'}
          >
            무료로 견적 받기 →
          </button>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{ background: '#111', padding: '32px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'white' }}>빌드어스</span>
            <span style={{ fontSize: 12, color: '#475569' }}>MVP v0.1 · 용인 수지구</span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>© 2026 BuildUs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
