import { useState, useMemo } from 'react';
import { getMaterials, getCategories } from '../api/materials';

// ── localStorage ────────────────────────────────────────────────────────────
function loadCustom() {
  try { return JSON.parse(localStorage.getItem('buildus_custom_materials') || '[]'); }
  catch { return []; }
}
function saveCustom(data) {
  localStorage.setItem('buildus_custom_materials', JSON.stringify(data));
}

// ── 상수 ────────────────────────────────────────────────────────────────────
const SPACES = ['거실', '안방', '작은방', '욕실', '주방', '베란다'];
const GRADE_STYLE = {
  '프리미엄': { background: '#FEF3C7', color: '#92400E' },
  '표준':     { background: '#EFF6FF', color: '#1D4ED8' },
  '-':        { background: '#F1F5F9', color: '#64748B' },
};
const EMPTY_FORM = {
  품명: '', 대분류: '마감재', 중분류: '', 브랜드: '',
  단위: '', 가격: '', 등급: '표준', 추천공간: [],
  메모: '', imageUrl: '',
};

// ── 이미지 썸네일 ─────────────────────────────────────────────────────────────
function Thumb({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: '#CBD5E1', flexShrink: 0,
      }}>🖼️</div>
    );
  }
  return (
    <img
      src={src} alt={alt}
      onError={() => setErr(true)}
      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }}
    />
  );
}

// ── 모달 ─────────────────────────────────────────────────────────────────────
function MaterialModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      imageUrl: form.imageUrl?.trim() || null,
      isCustom: true,
      isFromDB: initial?.isFromDB ?? false,
      id: initial?.id ?? Date.now(),
    });
  }

  const input = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const label = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{initial ? '자재 수정' : '자재 직접 추가'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* 이미지 URL */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={label}>이미지 URL (선택)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Thumb src={form.imageUrl} alt={form.품명} />
              <input value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)}
                placeholder="https://... (나중에 이미지 업로드 기능 추가 예정)" style={{ ...input, flex: 1 }} />
            </div>
          </div>

          {/* 품명 */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={label}>품명 *</label>
            <input value={form.품명} onChange={e => set('품명', e.target.value)} placeholder="예: LX 하우시스 실크벽지" style={input} />
          </div>

          {/* 대분류 */}
          <div>
            <label style={label}>대분류 *</label>
            <select value={form.대분류} onChange={e => set('대분류', e.target.value)} style={input}>
              {['마감재', '방수재', '타일', '도장', '바닥재', '접착제', '기타'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* 중분류 */}
          <div>
            <label style={label}>중분류</label>
            <input value={form.중분류} onChange={e => set('중분류', e.target.value)} placeholder="예: 벽지" style={input} />
          </div>

          {/* 브랜드 */}
          <div>
            <label style={label}>브랜드</label>
            <input value={form.브랜드} onChange={e => set('브랜드', e.target.value)} placeholder="예: LX Z:IN" style={input} />
          </div>

          {/* 단위 */}
          <div>
            <label style={label}>단위 *</label>
            <input value={form.단위} onChange={e => set('단위', e.target.value)} placeholder="예: 롤, ㎡, kg, L" style={input} />
          </div>

          {/* 가격 */}
          <div>
            <label style={label}>판매가 (원)</label>
            <input type="number" value={form.가격} onChange={e => set('가격', e.target.value)} placeholder="예: 35000" style={input} />
          </div>

          {/* 등급 */}
          <div>
            <label style={label}>등급</label>
            <select value={form.등급} onChange={e => set('등급', e.target.value)} style={input}>
              <option value="표준">표준</option>
              <option value="프리미엄">프리미엄</option>
            </select>
          </div>

          {/* 추천공간 */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={label}>추천공간</label>
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
            <label style={label}>메모 / 특징</label>
            <textarea value={form.메모} onChange={e => set('메모', e.target.value)}
              placeholder="자재 특징, 주의사항 등" rows={2}
              style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#475569' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: 11, borderRadius: 10, border: 'none', background: '#1A1A1A', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {initial ? '수정 완료' : '추가 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const official     = useMemo(() => getMaterials(), []);
  const officialCats = useMemo(() => getCategories(), []);

  const [customMaterials, setCustomMaterials] = useState(loadCustom);
  const [showCustomOnly,  setShowCustomOnly]  = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const [activeCategory, setActiveCategory] = useState('전체');
  const [spaceFilter,    setSpaceFilter]    = useState('전체');
  const [gradeFilter,    setGradeFilter]    = useState('전체');
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('default');
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 30;

  // 담긴 자재 코드 Set (빠른 조회)
  const cartCodes = useMemo(() =>
    new Set(customMaterials.map(m => m.자재코드).filter(Boolean)),
    [customMaterials]
  );

  // 카테고리
  const categories = showCustomOnly
    ? ['전체', ...new Set(customMaterials.map(m => m.대분류).filter(Boolean))].sort()
    : ['전체', ...officialCats];

  // 등급 목록
  const grades = useMemo(() => {
    const base = showCustomOnly ? customMaterials : official;
    return ['전체', ...new Set(base.map(m => m.등급).filter(v => v && v !== '-'))];
  }, [official, customMaterials, showCustomOnly]);

  // 보여줄 데이터 (커스텀만 / 전체)
  const baseList = useMemo(() => {
    if (showCustomOnly) {
      return customMaterials.map(m => ({
        ...m,
        category: [m.대분류, m.중분류].filter(Boolean).join(' > '),
        name:  m.품명,
        brand: m.브랜드 || '',
        unit:  m.단위,
        grade: m.등급 || '-',
        price: m.가격 ? `${Number(m.가격).toLocaleString()}원` : '-',
        price_num: m.가격 ? Number(m.가격) : 0,
        추천공간: m.추천공간 ?? [],
      }));
    }
    return official;
  }, [official, customMaterials, showCustomOnly]);

  const filtered = useMemo(() => {
    let r = baseList;
    if (activeCategory !== '전체') r = r.filter(m => (m.category ?? '').startsWith(activeCategory));
    if (gradeFilter !== '전체')    r = r.filter(m => (m.등급 ?? m.grade) === gradeFilter);
    if (spaceFilter !== '전체')    r = r.filter(m => (m.추천공간 ?? []).includes(spaceFilter));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m =>
        (m.품명 ?? m.name ?? '').toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q) ||
        (m.브랜드 ?? m.brand ?? '').toLowerCase().includes(q) ||
        (m.추천공간 ?? []).some(s => s.includes(search))
      );
    }
    if (sortBy === 'price_asc')  r = [...r].sort((a, b) => (a.price_num||0)-(b.price_num||0));
    if (sortBy === 'price_desc') r = [...r].sort((a, b) => (b.price_num||0)-(a.price_num||0));
    return r;
  }, [baseList, activeCategory, gradeFilter, spaceFilter, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function resetPage(fn) { fn(); setPage(1); }

  // ── 담기 / 빼기 ──────────────────────────────────────────────────────────
  function toggleCart(item) {
    if (cartCodes.has(item.자재코드)) {
      const next = customMaterials.filter(m => m.자재코드 !== item.자재코드);
      setCustomMaterials(next); saveCustom(next);
    } else {
      const added = {
        ...item,
        isCustom: true,
        isFromDB: true,
        id: item.자재코드 || Date.now(),
        imageUrl: item.imageUrl || null,
        메모: item.설명?.한줄요약 || '',
      };
      const next = [added, ...customMaterials];
      setCustomMaterials(next); saveCustom(next);
    }
  }

  // ── 직접 추가 / 수정 / 삭제 ──────────────────────────────────────────────
  function handleSave(item) {
    const next = editTarget
      ? customMaterials.map(m => m.id === item.id ? item : m)
      : [item, ...customMaterials];
    setCustomMaterials(next); saveCustom(next);
    setModalOpen(false); setEditTarget(null);
  }
  function handleDelete(id) {
    if (!confirm('이 자재를 삭제할까요?')) return;
    const next = customMaterials.filter(m => m.id !== id);
    setCustomMaterials(next); saveCustom(next);
  }
  function openAdd()   { setEditTarget(null); setModalOpen(true); }
  function openEdit(m) { setEditTarget(m);    setModalOpen(true); }
  function closeModal(){ setModalOpen(false); setEditTarget(null); }

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────
  const getName  = m => m.품명 ?? m.name ?? '';
  const getBrand = m => m.브랜드 ?? m.brand ?? '';
  const getGrade = m => m.등급 ?? m.grade ?? '-';
  const getPrice = m => m.price ?? '-';
  const getImage = m => m.imageUrl ?? null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', paddingBottom: 100 }}>

      {/* 모달 */}
      {modalOpen && (
        <MaterialModal
          initial={editTarget ? {
            품명: editTarget.품명, 대분류: editTarget.대분류 || '마감재',
            중분류: editTarget.중분류 ?? '', 브랜드: editTarget.브랜드 ?? '',
            단위: editTarget.단위 || '', 가격: editTarget.가격 ?? '',
            등급: editTarget.등급 ?? '표준', 추천공간: editTarget.추천공간 ?? [],
            메모: editTarget.메모 ?? editTarget.설명?.한줄요약 ?? '',
            imageUrl: editTarget.imageUrl ?? '',
            id: editTarget.id, isFromDB: editTarget.isFromDB,
          } : null}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>자재몰</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
            공식 자재 {official.length.toLocaleString()}개 · 담은 자재 {customMaterials.length}개
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => resetPage(() => { setShowCustomOnly(v => !v); setActiveCategory('전체'); })} style={{
            padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: showCustomOnly ? '#1A1A1A' : 'white',
            color: showCustomOnly ? 'white' : '#475569',
          }}>
            📦 담은 자재 {customMaterials.length > 0 && `(${customMaterials.length})`}
          </button>
          <button onClick={openAdd} style={{
            padding: '9px 16px', borderRadius: 10, border: '1px dashed #CBD5E1',
            background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>+ 직접 추가</button>
        </div>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => resetPage(() => setSearch(e.target.value))}
          placeholder="품명·브랜드·추천공간 검색"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
          <option value="default">기본순</option>
          <option value="price_asc">가격 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>

      {/* 카테고리 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => resetPage(() => setActiveCategory(cat))} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: activeCategory === cat ? '#1A1A1A' : '#F1F5F9',
            color: activeCategory === cat ? 'white' : '#475569',
          }}>{cat}</button>
        ))}
      </div>

      {/* 추천공간 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginRight: 2 }}>공간</span>
        {['전체', ...SPACES].map(s => (
          <button key={s} onClick={() => resetPage(() => setSpaceFilter(s))} style={{
            padding: '5px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: spaceFilter === s ? '#3B82F6' : 'white',
            color: spaceFilter === s ? 'white' : '#64748B',
          }}>{s}</button>
        ))}
      </div>

      {/* 등급 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginRight: 2 }}>등급</span>
        {grades.map(g => (
          <button key={g} onClick={() => resetPage(() => setGradeFilter(g))} style={{
            padding: '5px 12px', borderRadius: 16, border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: gradeFilter === g ? '#1A1A1A' : 'white',
            color: gradeFilter === g ? 'white' : '#64748B',
          }}>{g}</button>
        ))}
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>
        {filtered.length.toLocaleString()}개 항목{totalPages > 1 && ` · ${page}/${totalPages} 페이지`}
        {showCustomOnly && <span style={{ marginLeft: 8, color: '#3B82F6', fontWeight: 600 }}>담은 자재만 표시 중</span>}
      </div>

      {/* 테이블 */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['', '분류', '품명', '브랜드', '등급', '추천공간', '단위', '가격', ''].map((h, i) => (
                <th key={i} style={{ padding: '12px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => {
              const inCart   = cartCodes.has(item.자재코드);
              const isCustom = item.isCustom;
              const rowBg    = isCustom ? '#FFFBEB' : (i % 2 === 0 ? 'white' : '#FAFAFA');
              return (
                <tr key={isCustom ? `c-${item.id}` : i}
                  style={{ borderBottom: '1px solid #F1F5F9', background: rowBg, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg}
                >
                  {/* 이미지 썸네일 */}
                  <td style={{ padding: '8px 10px', width: 56 }}>
                    <Thumb src={getImage(item)} alt={getName(item)} />
                  </td>

                  {/* 분류 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {isCustom && (
                      <div style={{ fontSize: 10, fontWeight: 700, background: item.isFromDB ? '#EFF6FF' : '#FEF3C7', color: item.isFromDB ? '#1D4ED8' : '#92400E', padding: '1px 5px', borderRadius: 3, display: 'inline-block', marginBottom: 3 }}>
                        {item.isFromDB ? '담음' : '직접등록'}
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                      {item.대분류}
                    </div>
                    {item.중분류 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.중분류}{item.소분류 ? ` › ${item.소분류}` : ''}</div>}
                  </td>

                  {/* 품명 */}
                  <td style={{ padding: '8px 10px', maxWidth: 220 }}>
                    <div style={{ fontWeight: 500, color: '#1A1A1A' }}>{getName(item)}</div>
                    {item.규격 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.규격}</div>}
                    {(item.설명?.한줄요약 || item.메모) && (
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.설명?.한줄요약 || item.메모}</div>
                    )}
                  </td>

                  {/* 브랜드 */}
                  <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>
                    {getBrand(item) || '-'}
                    {item.제조사 && item.제조사 !== item.브랜드 && (
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.제조사}</div>
                    )}
                  </td>

                  {/* 등급 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, ...(GRADE_STYLE[getGrade(item)] ?? GRADE_STYLE['-']) }}>
                      {getGrade(item)}
                    </span>
                  </td>

                  {/* 추천공간 */}
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 140 }}>
                      {(item.추천공간 ?? []).length > 0
                        ? item.추천공간.map(s => (
                            <span key={s} onClick={() => resetPage(() => setSpaceFilter(s))} style={{
                              fontSize: 10, color: spaceFilter === s ? '#1D4ED8' : '#475569',
                              background: spaceFilter === s ? '#EFF6FF' : '#F1F5F9',
                              padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                              border: spaceFilter === s ? '1px solid #BFDBFE' : '1px solid transparent',
                            }}>{s}</span>
                          ))
                        : <span style={{ color: '#CBD5E1' }}>-</span>}
                    </div>
                  </td>

                  {/* 단위 */}
                  <td style={{ padding: '8px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {item.판매단위 || item.단위 || '-'}
                  </td>

                  {/* 가격 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {getPrice(item) !== '-'
                      ? <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{getPrice(item)}</span>
                      : <span style={{ color: '#CBD5E1' }}>-</span>}
                    {item.물류?.배송비기준 && (
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.물류.배송비기준}</div>
                    )}
                  </td>

                  {/* 액션 */}
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {isCustom ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(item)} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0',
                          background: 'white', fontSize: 11, color: '#475569', cursor: 'pointer', fontWeight: 600,
                        }}>수정</button>
                        <button onClick={() => handleDelete(item.id)} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2',
                          background: '#FEF2F2', fontSize: 11, color: '#EF4444', cursor: 'pointer', fontWeight: 600,
                        }}>삭제</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleCart(item)} style={{
                        padding: '6px 14px', borderRadius: 8,
                        border: inCart ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                        background: inCart ? '#EFF6FF' : 'white',
                        color: inCart ? '#1D4ED8' : '#475569',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}>
                        {inCart ? '✓ 담김' : '+ 담기'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
            {showCustomOnly ? (
              <div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>담은 자재가 없어요</div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>자재 목록에서 "+ 담기" 버튼을 눌러보세요</div>
                <button onClick={() => setShowCustomOnly(false)} style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none', background: '#3B82F6',
                  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>자재 둘러보기</button>
              </div>
            ) : (
              <div>검색 결과가 없습니다</div>
            )}
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

      {/* 플로팅 직접 추가 버튼 */}
      <button onClick={openAdd} title="자재 직접 추가" style={{
        position: 'fixed', bottom: 32, right: 32,
        padding: '12px 20px', borderRadius: 50, border: 'none',
        background: '#1A1A1A', color: 'white',
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', gap: 8,
        zIndex: 200, transition: 'transform 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ fontSize: 18 }}>+</span> 직접 추가
      </button>
    </div>
  );
}
