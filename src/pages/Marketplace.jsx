import { useState, useMemo } from 'react';
import { getMaterials, getCategories } from '../api/materials';

// ── localStorage 커스텀 자재 ─────────────────────────────────────────────────

function loadCustom() {
  try { return JSON.parse(localStorage.getItem('buildus_custom_materials') || '[]'); }
  catch { return []; }
}
function saveCustom(data) {
  localStorage.setItem('buildus_custom_materials', JSON.stringify(data));
}

const SPACES = ['거실', '안방', '작은방', '욕실', '주방', '베란다'];
const EMPTY_FORM = {
  품명: '', 대분류: '마감재', 중분류: '', 브랜드: '', 단위: '', 가격: '',
  등급: '표준', 추천공간: [], 메모: '',
};

const GRADE_STYLE = {
  '프리미엄': { background: '#FEF3C7', color: '#92400E' },
  '표준':     { background: '#EFF6FF', color: '#1D4ED8' },
  '-':        { background: '#F1F5F9', color: '#64748B' },
};

// ── 모달 컴포넌트 ────────────────────────────────────────────────────────────

function MaterialModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleSpace(s) {
    set('추천공간', form.추천공간.includes(s)
      ? form.추천공간.filter(x => x !== s)
      : [...form.추천공간, s]);
  }

  function handleSave() {
    if (!form.품명.trim()) return alert('품명을 입력하세요.');
    if (!form.단위.trim()) return alert('단위를 입력하세요.');
    onSave({
      ...form,
      품명: form.품명.trim(),
      가격: form.가격 ? Number(form.가격) : null,
      isCustom: true,
      id: initial?.id ?? Date.now(),
    });
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{initial ? '자재 수정' : '자재 추가'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* 품명 */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>품명 *</label>
            <input value={form.품명} onChange={e => set('품명', e.target.value)} placeholder="예: LX 하우시스 실크벽지" style={inputStyle} />
          </div>

          {/* 대분류 */}
          <div>
            <label style={labelStyle}>대분류 *</label>
            <select value={form.대분류} onChange={e => set('대분류', e.target.value)} style={inputStyle}>
              {['마감재', '방수재', '타일', '도장', '바닥재', '접착제', '기타'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* 중분류 */}
          <div>
            <label style={labelStyle}>중분류</label>
            <input value={form.중분류} onChange={e => set('중분류', e.target.value)} placeholder="예: 벽지" style={inputStyle} />
          </div>

          {/* 브랜드 */}
          <div>
            <label style={labelStyle}>브랜드</label>
            <input value={form.브랜드} onChange={e => set('브랜드', e.target.value)} placeholder="예: LX Z:IN" style={inputStyle} />
          </div>

          {/* 단위 */}
          <div>
            <label style={labelStyle}>단위 *</label>
            <input value={form.단위} onChange={e => set('단위', e.target.value)} placeholder="예: 롤, ㎡, kg, L" style={inputStyle} />
          </div>

          {/* 가격 */}
          <div>
            <label style={labelStyle}>판매가 (원)</label>
            <input type="number" value={form.가격} onChange={e => set('가격', e.target.value)} placeholder="예: 35000" style={inputStyle} />
          </div>

          {/* 등급 */}
          <div>
            <label style={labelStyle}>등급</label>
            <select value={form.등급} onChange={e => set('등급', e.target.value)} style={inputStyle}>
              <option value="표준">표준</option>
              <option value="프리미엄">프리미엄</option>
            </select>
          </div>

          {/* 추천공간 */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>추천공간</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SPACES.map(s => (
                <button key={s} onClick={() => toggleSpace(s)} style={{
                  padding: '5px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13,
                  background: form.추천공간.includes(s) ? '#1A1A1A' : 'white',
                  color: form.추천공간.includes(s) ? 'white' : '#475569',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>메모 / 특징</label>
            <textarea value={form.메모} onChange={e => set('메모', e.target.value)} placeholder="자재 특징, 주의사항 등" rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#475569' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {initial ? '수정 완료' : '자재 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function Marketplace() {
  const official   = useMemo(() => getMaterials(), []);
  const officialCats = useMemo(() => getCategories(), []);

  const [customMaterials, setCustomMaterials] = useState(loadCustom);
  const [showCustomOnly,  setShowCustomOnly]  = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = 추가, item = 수정

  const [activeCategory, setActiveCategory] = useState('전체');
  const [search,     setSearch]     = useState('');
  const [sortBy,     setSortBy]     = useState('default');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 30;

  // 공식+커스텀 합산
  const all = useMemo(() => {
    const custom = customMaterials.map(m => ({
      ...m,
      isCustom: true,
      category: [m.대분류, m.중분류].filter(Boolean).join(' > '),
      name:  m.품명,
      brand: m.브랜드 || '',
      unit:  m.단위,
      grade: m.등급 || '-',
      price: m.가격 ? `${Number(m.가격).toLocaleString()}원` : '-',
      price_num: m.가격 ? Number(m.가격) : 0,
      추천공간: m.추천공간 ?? [],
      설명: { 한줄요약: m.메모 || null },
    }));
    return showCustomOnly ? custom : [...custom, ...official];
  }, [official, customMaterials, showCustomOnly]);

  const categories = showCustomOnly
    ? ['전체', ...new Set(customMaterials.map(m => m.대분류).filter(Boolean))].sort()
    : ['전체', ...officialCats];

  const grades = useMemo(() =>
    ['전체', ...new Set(all.map(m => m.등급 ?? m.grade).filter(v => v && v !== '-'))],
    [all]);

  const filtered = useMemo(() => {
    let r = all;
    if (activeCategory !== '전체') r = r.filter(m => m.category.startsWith(activeCategory));
    if (gradeFilter !== '전체')    r = r.filter(m => (m.등급 ?? m.grade) === gradeFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m =>
        (m.품명 ?? m.name)?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        (m.브랜드 ?? m.brand)?.toLowerCase().includes(q) ||
        m.추천공간?.some(s => s.includes(search))
      );
    }
    if (sortBy === 'price_asc')  r = [...r].sort((a, b) => (a.price_num||0)-(b.price_num||0));
    if (sortBy === 'price_desc') r = [...r].sort((a, b) => (b.price_num||0)-(a.price_num||0));
    return r;
  }, [all, activeCategory, gradeFilter, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function handleCategoryChange(c) { setActiveCategory(c); setPage(1); }
  function handleSearch(v)          { setSearch(v);          setPage(1); }
  function handleGrade(g)           { setGradeFilter(g);     setPage(1); }

  function handleSave(item) {
    let next;
    if (editTarget) {
      next = customMaterials.map(m => m.id === item.id ? item : m);
    } else {
      next = [item, ...customMaterials];
    }
    setCustomMaterials(next);
    saveCustom(next);
    setModalOpen(false);
    setEditTarget(null);
  }

  function handleDelete(id) {
    if (!confirm('이 자재를 삭제할까요?')) return;
    const next = customMaterials.filter(m => m.id !== id);
    setCustomMaterials(next);
    saveCustom(next);
  }

  function openAdd()   { setEditTarget(null); setModalOpen(true); }
  function openEdit(m) { setEditTarget(m);    setModalOpen(true); }
  function closeModal(){ setModalOpen(false); setEditTarget(null); }

  const getName  = m => m.품명 ?? m.name ?? '';
  const getBrand = m => m.브랜드 ?? m.brand ?? '';
  const getGrade = m => m.등급 ?? m.grade ?? '-';
  const getPrice = m => m.price ?? '-';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

      {/* 모달 */}
      {modalOpen && (
        <MaterialModal
          initial={editTarget ? {
            품명: editTarget.품명, 대분류: editTarget.대분류, 중분류: editTarget.중분류 ?? '',
            브랜드: editTarget.브랜드 ?? '', 단위: editTarget.단위, 가격: editTarget.가격 ?? '',
            등급: editTarget.등급 ?? '표준', 추천공간: editTarget.추천공간 ?? [], 메모: editTarget.설명?.한줄요약 ?? editTarget.메모 ?? '',
            id: editTarget.id,
          } : null}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자재몰</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
            공식 자재 {official.length.toLocaleString()}개 · 내 자재 {customMaterials.length}개
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowCustomOnly(v => !v); setPage(1); setActiveCategory('전체'); }} style={{
            padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: showCustomOnly ? '#1A1A1A' : 'white',
            color: showCustomOnly ? 'white' : '#475569',
          }}>
            📦 내 자재 {customMaterials.length > 0 ? `(${customMaterials.length})` : ''}
          </button>
          <button onClick={openAdd} style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', background: '#3B82F6',
            color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>+ 자재 추가</button>
        </div>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="품명·카테고리·브랜드·추천공간 검색"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
          <option value="default">기본순</option>
          <option value="price_asc">가격 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => handleCategoryChange(cat)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeCategory === cat ? '#1A1A1A' : '#F1F5F9',
            color: activeCategory === cat ? 'white' : '#475569',
          }}>{cat}</button>
        ))}
      </div>

      {/* 등급 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {grades.map(g => (
          <button key={g} onClick={() => handleGrade(g)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid #E2E8F0', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: gradeFilter === g ? '#3B82F6' : 'white',
            color: gradeFilter === g ? 'white' : '#475569',
          }}>{g}</button>
        ))}
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
        {filtered.length.toLocaleString()}개 항목{totalPages > 1 && ` · ${page}/${totalPages} 페이지`}
        {showCustomOnly && <span style={{ marginLeft: 8, color: '#3B82F6', fontWeight: 600 }}>내 자재만 표시 중</span>}
      </div>

      {/* 자재 테이블 */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['분류', '품명', '브랜드', '등급', '추천공간', '샘플', '단위', '가격', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => (
              <tr key={item.isCustom ? `c-${item.id}` : i}
                style={{ borderBottom: '1px solid #F1F5F9', background: item.isCustom ? '#FFFBEB' : (i % 2 === 0 ? 'white' : '#FAFAFA'), transition: 'background 0.1s' }}
                onMouseEnter={e => !item.isCustom && (e.currentTarget.style.background = '#EFF6FF')}
                onMouseLeave={e => !item.isCustom && (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFAFA')}
              >
                {/* 분류 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {item.isCustom && (
                    <div style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, display: 'inline-block', marginBottom: 3 }}>직접등록</div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                    {item.대분류}
                  </div>
                  {item.중분류 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.중분류}{item.소분류 ? ` › ${item.소분류}` : ''}</div>}
                </td>

                {/* 품명 */}
                <td style={{ padding: '10px 14px', color: '#1A1A1A', fontWeight: 500, maxWidth: 240 }}>
                  <div>{getName(item)}</div>
                  {item.규격 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.규격}</div>}
                  {item.설명?.한줄요약 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.설명.한줄요약}</div>}
                </td>

                {/* 브랜드 */}
                <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                  {getBrand(item) || '-'}
                </td>

                {/* 등급 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, ...(GRADE_STYLE[getGrade(item)] ?? GRADE_STYLE['-']) }}>
                    {getGrade(item)}
                  </span>
                </td>

                {/* 추천공간 */}
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 160 }}>
                    {item.추천공간?.length > 0
                      ? item.추천공간.map(s => <span key={s} style={{ fontSize: 10, color: '#475569', background: '#F1F5F9', padding: '1px 5px', borderRadius: 3 }}>{s}</span>)
                      : <span style={{ color: '#CBD5E1' }}>-</span>}
                  </div>
                </td>

                {/* 샘플 */}
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {item.샘플?.가능 === 'Y'
                    ? <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>가능</span>
                    : <span style={{ color: '#CBD5E1' }}>-</span>}
                </td>

                {/* 단위 */}
                <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                  {item.판매단위 || item.단위 || '-'}
                </td>

                {/* 가격 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {getPrice(item) !== '-'
                    ? <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{getPrice(item)}</span>
                    : <span style={{ color: '#CBD5E1' }}>-</span>}
                  {item.물류?.배송비기준 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{item.물류.배송비기준}</div>}
                </td>

                {/* 액션 (커스텀 자재만) */}
                <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                  {item.isCustom && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(item)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 11, color: '#3B82F6', cursor: 'pointer', fontWeight: 600 }}>수정</button>
                      <button onClick={() => handleDelete(item.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', fontSize: 11, color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
            {showCustomOnly ? (
              <div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>등록된 자재가 없어요</div>
                <button onClick={openAdd} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>첫 자재 추가하기</button>
              </div>
            ) : '검색 결과가 없습니다'}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page===1?'not-allowed':'pointer', color: page===1?'#CBD5E1':'#475569', fontSize: 13 }}>←</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const pg = page <= 4 ? i+1 : page-3+i;
            if (pg < 1 || pg > totalPages) return null;
            return (
              <button key={pg} onClick={() => setPage(pg)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: pg===page?700:400, background: pg===page?'#1A1A1A':'white', color: pg===page?'white':'#475569' }}>
                {pg}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#CBD5E1':'#475569', fontSize: 13 }}>→</button>
        </div>
      )}
    </div>
  );
}
