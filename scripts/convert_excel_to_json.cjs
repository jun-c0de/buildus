/**
 * 빌드어스_데이터아키텍처.xlsx → JSON 변환 스크립트
 * 실행: node scripts/convert_excel_to_json.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = 'C:/Users/user/Documents/카카오톡 받은 파일/빌드어스_데이터아키텍처.xlsx';
const OUTPUT_DIR = path.join(__dirname, '../src/data');

const wb = XLSX.readFile(EXCEL_PATH);

// ─────────────────────────────────────────────
// 1. 자재마스터
// ─────────────────────────────────────────────
function convertMaterials() {
  const ws = wb.Sheets['1_자재마스터'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 행 1(index 0)은 그룹 헤더, 행 2(index 1)이 실제 컬럼명
  const headers = rows[1];
  const data = rows.slice(2).filter(row => row[0] !== ''); // 자재코드가 있는 행만

  const materials = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });

    return {
      자재코드:       obj['자재코드'],
      브랜드코드:     obj['브랜드코드'],
      품명:           obj['품명'],
      규격:           obj['규격'],
      브랜드:         obj['브랜드'],
      제조사:         obj['제조사'],
      대분류:         obj['대분류'],
      중분류:         obj['중분류'],
      소분류:         obj['소분류'],
      단위:           obj['단위'],
      판매단위:       obj['판매단위'],
      판매단위수량:   obj['판매단위수량'],
      가격: {
        도매가:         obj['도매가']       || null,
        업체가:         obj['업체가']       || null,
        판매가:         obj['판매가']       || null,
        쿠팡가:         obj['쿠팡가']       || null,
        네이버최저가:   obj['네이버최저가'] || null,
        절약금액:       obj['절약금액']     || null,
        절약률:         obj['절약률(%)']    || null,
        시장가조사일:   obj['시장가조사일'] || null,
      },
      물류: {
        무게:           obj['무게(kg)']     || null,
        배송방법:       obj['배송방법'],
        예상배송일:     obj['예상배송일'],
        배송비기준:     obj['배송비기준'],
      },
      공급사코드:     obj['공급사코드']    || null,
      샘플: {
        가능:           obj['샘플가능'],
        크기:           obj['샘플크기']    || null,
        유무료:         obj['샘플무료유료'] || null,
        비용:           obj['샘플비용']    || null,
      },
      설명: {
        한줄요약:       obj['한줄요약']    || null,
        특징:           obj['특징']        || null,
        주의사항:       obj['주의사항']    || null,
      },
      스타일태그:     obj['스타일태그'] ? obj['스타일태그'].split(',').map(s => s.trim()).filter(Boolean) : [],
      등급:           obj['등급']          || null,
      추천공간:       obj['추천공간'] ? obj['추천공간'].split(',').map(s => s.trim()).filter(Boolean) : [],
    };
  });

  return materials;
}

// ─────────────────────────────────────────────
// 2. 공정자재매핑
// ─────────────────────────────────────────────
function convertProcessMaterials() {
  const ws = wb.Sheets['2_공정자재매핑'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[3]; // 4번째 행이 컬럼명 (row0~2는 제목/설명/빈행)
  const data = rows.slice(4).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      공정코드:         obj['공정코드'],
      공정명:           obj['공정명'],
      자재코드:         obj['자재코드']     || null,
      자재명:           obj['자재명'],
      용도:             obj['용도'],
      필수여부:         obj['필수/선택'],
      단위:             obj['단위'],
      소요량_1m2:       obj['1㎡당 소요량'],
      로스율:           obj['로스율(%)'],
      실소요량_1m2:     obj['실소요량(1㎡)'],
    };
  });
}

// ─────────────────────────────────────────────
// 3. 공정마스터
// ─────────────────────────────────────────────
function convertProcesses() {
  const ws = wb.Sheets['3_공정마스터'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[3]; // 4번째 행이 컬럼명
  const data = rows.slice(4).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      공정코드:       obj['공정코드'],
      공정명:         obj['공정명'],
      순서:           obj['순서'],
      선행공정:       obj['선행공정'] !== '—' ? obj['선행공정'] : null,
      기간: {
        시공일:       obj['시공일'],
        양생일:       obj['양생일'],
        합계일:       obj['합계일'],
      },
      단가: {
        자재비_m2:    obj['자재비(㎡당)']   !== '—' ? obj['자재비(㎡당)']   : null,
        인건비_m2:    obj['인건비(㎡당)']   !== '—' ? obj['인건비(㎡당)']   : null,
        적정합계범위: obj['적정합계범위']   !== '—' ? obj['적정합계범위']   : null,
        기능공일당:   obj['기능공일당']     !== '—' ? obj['기능공일당']     : null,
        m2당공수:     obj['㎡당공수(인·일)'],
      },
      셀프난이도:     obj['셀프난이도'],
      가이드문서:     obj['가이드문서']     || null,
    };
  });
}

// ─────────────────────────────────────────────
// 4. 호환성
// ─────────────────────────────────────────────
function convertCompatibility() {
  const ws = wb.Sheets['4_호환성'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[3]; // row0~2는 제목/설명/빈행
  const data = rows.slice(4).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      자재코드A:    obj['자재코드A'],
      자재명A:      obj['자재명A'],
      자재코드B:    obj['자재코드B'],
      자재명B:      obj['자재명B'],
      판정:         obj['판정'],
      사유:         obj['사유'],
      대체추천:     obj['대체추천'] !== '—' ? obj['대체추천'] : null,
    };
  });
}

// ─────────────────────────────────────────────
// 5. 공급사
// ─────────────────────────────────────────────
function convertSuppliers() {
  const ws = wb.Sheets['5_공급사'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[3]; // row0~2는 제목/설명/빈행
  const data = rows.slice(4).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      공급사코드:     obj['공급사코드'],
      공급사명:       obj['공급사명'],
      취급카테고리:   obj['취급카테고리'] ? obj['취급카테고리'].split(',').map(s => s.trim()) : [],
      리드타임:       obj['리드타임'],
      최소주문:       obj['최소주문'],
      반품조건:       obj['반품조건'],
      결제조건:       obj['결제조건'],
      연락처:         obj['연락처'],
    };
  });
}

// ─────────────────────────────────────────────
// 6. 면적참조
// ─────────────────────────────────────────────
function convertAreaReference() {
  const ws = wb.Sheets['6_면적참조'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[3]; // row0~2는 제목/설명/빈행
  const data = rows.slice(4).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      평형대:       obj['평형대'],
      전용면적_m2:  obj['전용면적(㎡)'],
      공간별면적: {
        욕실:   obj['욕실(㎡)'],
        주방:   obj['주방(㎡)'],
        거실:   obj['거실(㎡)'],
        안방:   obj['안방(㎡)'],
        작은방: obj['작은방(㎡)'],
        베란다: obj['베란다(㎡)'],
      },
    };
  });
}

// ─────────────────────────────────────────────
// 7. QA
// ─────────────────────────────────────────────
function convertQA() {
  const ws = wb.Sheets['8_QA'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[2]; // row0은 제목, row1은 빈행
  const data = rows.slice(3).filter(row => row[0] !== '');

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return {
      공정:         obj['공정'],
      질문:         obj['질문'],
      답변:         obj['답변'],
      관련자재코드: obj['관련자재코드'] || null,
      출처:         obj['출처']         || null,
    };
  });
}

// ─────────────────────────────────────────────
// 변환 실행 & 저장
// ─────────────────────────────────────────────
const outputs = [
  { name: 'materials',         fn: convertMaterials,        file: 'materials.json' },
  { name: 'process_materials', fn: convertProcessMaterials, file: 'process_materials.json' },
  { name: 'processes',         fn: convertProcesses,        file: 'processes.json' },
  { name: 'compatibility',     fn: convertCompatibility,    file: 'compatibility.json' },
  { name: 'suppliers',         fn: convertSuppliers,        file: 'suppliers.json' },
  { name: 'area_reference',    fn: convertAreaReference,    file: 'area_reference.json' },
  { name: 'qa',                fn: convertQA,               file: 'qa.json' },
];

for (const { name, fn, file } of outputs) {
  try {
    const data = fn();
    const outPath = path.join(OUTPUT_DIR, file);

    // materials.json은 덮어쓰지 않고 백업 후 교체
    if (file === 'materials.json') {
      const bakPath = path.join(OUTPUT_DIR, 'materials_old.json');
      if (fs.existsSync(outPath)) fs.copyFileSync(outPath, bakPath);
      console.log(`  → materials_old.json 백업 완료`);
    }

    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ ${name}: ${data.length}건 → src/data/${file}`);
  } catch (e) {
    console.error(`❌ ${name} 실패:`, e.message);
  }
}

console.log('\n완료!');
