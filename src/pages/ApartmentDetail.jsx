import { useParams, useNavigate } from 'react-router-dom';
import { getApartmentById } from '../api/apartments';

export default function ApartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apt = getApartmentById(id);

  if (!apt) return (
    <div style={{ padding: 32, color: '#94A3B8' }}>단지를 찾을 수 없습니다.</div>
  );

  const age = 2026 - apt.buildYear;

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748B', fontSize: 14, marginBottom: 20, padding: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >← 목록으로</button>

      {/* 단지 헤더 */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#EFF6FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>🏢</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{apt.name}</h1>
            <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{apt.address}</p>
          </div>
          {age >= 15 && (
            <span style={{
              background: '#FEF3C7', color: '#D97706', fontSize: 12,
              fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1px solid #FDE68A',
            }}>리모델링 추천</span>
          )}
        </div>

        {/* 기본 정보 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24 }}>
          {[
            { label: '준공연도', value: `${apt.buildYear}년` },
            { label: '건물 연령', value: `${age}년` },
            { label: '총 세대수', value: `${apt.totalUnits.toLocaleString()}세대` },
            { label: '최고 층수', value: `${apt.floors}층` },
          ].map(item => (
            <div key={item.label} style={{
              background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 평형 목록 */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>평형 구성</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apt.types.map(t => (
            <div key={t.pyeong} style={{
              display: 'flex', alignItems: 'center',
              padding: '16px 20px', borderRadius: 10, border: '1px solid #E2E8F0',
              background: '#FAFAFA',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>{t.pyeong}평</span>
                <span style={{ color: '#94A3B8', fontSize: 13, marginLeft: 8 }}>{t.area}m²</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569' }}>
                <span>방 {t.rooms}개</span>
                <span>욕실 {t.baths}개</span>
              </div>
              <button
                onClick={() => navigate('/cost', {
                  state: { aptId: apt.id, aptName: apt.name, area: t.area, pyeong: t.pyeong }
                })}
                style={{
                  marginLeft: 20, padding: '7px 16px', borderRadius: 8,
                  background: '#3B82F6', color: 'white', border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >원가 분석 →</button>
            </div>
          ))}
        </div>
      </div>

      {/* 평면도 보기 버튼 */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>평면도 보기</h2>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>2D/3D 도면으로 공간 구성 확인</p>
          </div>
          <button
            onClick={() => navigate('/floorplan', {
              state: { complexKey: apt.complexKey, area: apt.types[0]?.area }
            })}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: '#8B5CF6', color: 'white', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >📐 평면도 열기</button>
        </div>
      </div>
    </div>
  );
}
