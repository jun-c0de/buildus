# BuildUs 평면도 시스템 가이드

## 프로젝트 개요

용인시 수지구 상현동 아파트 21개 단지(90개 유닛)의 평면도를 자동 분석하여
2D/3D 뷰어로 보여주는 시스템.

---

## 1. 현재까지 구현된 것

### 1-1. 크롤링 & 데이터
- 상현역 인근 21개 단지 평면도 JPG 수집
- `C:\floorplan_Crawling\` 에 단지별 폴더로 정리
- `aptname.txt` 로 폴더명 ↔ 한국어 단지명 매핑

### 1-2. SAM2 기반 평면도 파서 (v5 하이브리드)
**파일**: `C:\floorplan_Crawling\floorplan_parser\parse_floorplan_sam2.py`

사용자가 제공한 정확한 RGB 코드로 방 분류:

| 색상 코드 | RGB | 분류 |
|-----------|-----|------|
| `#F6E9BF` | (246,233,191) | 거실(가장 큰 영역) / 침실 / 드레스룸(5m²미만) |
| `#FCF3E4` | (252,243,228) | 발코니 |
| `#E6F3F7` | (230,243,247) | 화장실 |
| `#EBEBEB` | (235,235,235) | 현관(최대 1개) |

**전략**:
- 거실/침실: SAM2 마스크 + RGB 유클리드 거리 매칭
- 발코니/화장실/현관: 색상 마스크 직접 Connected Component 분석
  (SAM2가 흰색 계열 방을 배경으로 병합하는 문제 회피)
- 드레스룸: bed_living 중 5m² 미만 자동 분류

**배치 처리**:
```bash
cd C:\floorplan_Crawling\floorplan_parser

# 전체 90개 재처리
py -3 batch_sam2.py --force

# 특정 단지만
py -3 batch_sam2.py --complex Xi

# 단일 파일 테스트 (디버그 이미지 생성)
py -3 parse_floorplan_sam2.py "경로/이미지.jpg" --m2 83 --debug --overwrite
```

### 1-3. React 프론트엔드 (Vercel 배포)
**URL**: https://buildus.vercel.app

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 홈 | `/` | 메인 랜딩 |
| 아파트 목록 | `/apartments` | 21개 단지 목록 |
| 단지 상세 | `/apartments/:id` | 평형 목록, 원가분석/평면도 이동 |
| 평면도 뷰어 | `/floorplan` | 2D/3D 뷰어 |
| 원가 분석 | `/cost` | 리모델링 비용 견적 |
| **라벨 수정** | `/label` | 방 구역 수정 도구 (로컬 전용) |

**주요 파일**:
```
buildus/
├── public/
│   ├── floorplans/           ← 단지별 JPG + spa.json + str.json
│   │   ├── Xi/
│   │   │   ├── Xi_83A.jpg
│   │   │   ├── Xi_83A_spa.json    ← 방 위치/타입 데이터
│   │   │   ├── Xi_83A_str.json    ← 벽/창호 구조 데이터
│   │   │   └── Xi_83A_corrections.json  ← 수동 수정 기록
│   │   └── ...
│   └── floorplans_index.json ← 전체 단지/유닛 인덱스
├── src/
│   ├── components/
│   │   ├── FloorPlan2D.jsx   ← 2D SVG 뷰어
│   │   └── FloorPlan3D.jsx   ← 3D Three.js 뷰어
│   ├── pages/
│   │   ├── FloorPlan.jsx     ← 뷰어 페이지
│   │   └── FloorPlanLabeler.jsx ← 라벨 수정 도구
│   ├── utils/labelParser.js  ← spa/str JSON → React 데이터
│   └── data/
│       ├── roomConfig.js     ← 방 타입별 색상/아이콘
│       └── apartments.json   ← 21개 단지 정보
└── save-server.js            ← 로컬 저장 서버 (Node.js)
```

### 1-4. 3D 뷰어 개선사항
- 배경 floor: 고정 크기 → 실제 방 폴리곤 범위에 맞게 자동 계산
- 벽 중복 제거: 인접 방 공유 엣지는 한 번만 렌더링
- 외벽(두껍게 0.14) vs 내벽(얇게 0.07) 자동 구분

---

## 2. 라벨 수정 도구 사용법

### 2-1. 실행 준비

터미널 두 개를 열고:

```bash
# 터미널 1: 저장 서버
cd C:\Users\user\claude_floorplan\buildus
node save-server.js

# 터미널 2: 개발 서버
npm run dev
```

브라우저에서 `http://localhost:5173/label` 접속

---

### 2-2. 기능 설명

#### 모드 전환 (헤더의 토글 버튼)

| 모드 | 버튼 | 용도 |
|------|------|------|
| 선택/수정 | 🖱 선택/수정 | 기존 방 타입 변경 또는 삭제 |
| 영역 추가 | ✏️ 영역 추가 | 새 방 폴리곤 직접 그리기 |

---

#### [선택/수정 모드] 기존 방 타입 변경

```
1. 도면에서 잘못 인식된 방 클릭
2. 우측 패널에 타입 선택 목록 표시
3. 올바른 타입 클릭 → 노란색으로 "수정됨" 표시
4. [💾 저장] 클릭
```

#### [선택/수정 모드] 잘못된 방 삭제

```
1. 삭제할 방에서 우클릭
2. 우측 하단 "삭제 예정" 목록에 빨간색으로 추가
3. 실수면 "되돌리기" 클릭
4. [💾 저장] 클릭
```

---

#### [영역 추가 모드] 새 방 직접 그리기

```
1. [✏️ 영역 추가] 버튼 클릭 (배경 보라색으로 바뀜)
2. 도면에서 방의 꼭짓점을 클릭클릭클릭...
   - 보라색 점으로 꼭짓점 표시됨
   - 마우스 따라 점선 미리보기
3. 완성하기:
   - 방법 A: 더블클릭
   - 방법 B: 첫 번째 점 근처로 마우스 이동 후 클릭
     (첫 점 주변에 초록색 원이 표시됨)
   - 취소: ESC 키
4. 완성되면 우측 패널에 타입 선택 목록 표시
5. 타입 선택 → 점선 테두리로 방이 추가됨
6. 추가된 방 삭제: 우클릭
7. [💾 저장] 클릭
```

---

### 2-3. 저장 & 배포

수정 후 저장하면:
- `{stem}_corrections.json` 생성 (수정 기록 보존)
- `{stem}_spa.json` 즉시 패치 (실제 데이터 반영)

배포:
```bash
npm run build
npx vercel --prod
```

---

### 2-4. 모든 corrections 일괄 재적용

SAM2를 다시 돌려서 spa.json이 덮어씌워진 경우:
```bash
# 저장 서버가 실행 중인 상태에서
curl -X POST http://localhost:3001/apply-all
```

---

## 3. 현재 한계 및 개선 방향

### 파서 한계
| 문제 | 원인 | 개선 방향 |
|------|------|-----------|
| 주방 미분류 | 거실과 동일 색상(#F6E9BF) | 위치 기반 룰 (발코니 인접) 또는 객체 탐지 |
| 화장실 오인식 | #E6F3F7이 흰 배경과 유사 | YOLO로 변기/욕조 심볼 탐지 |
| 현관 위치 오류 | 회색 계열 구조 요소와 혼동 | 도면 외곽 접촉 여부 + 면적 필터 |
| 발코니 과다 탐지 | 긴 창가 영역 분절 | 인접 영역 병합 후처리 |

### 학습 데이터 활용
현재까지 수동 수정한 `_corrections.json` 파일들이 쌓이면:
- 각 방의 색상 + 크기 + 위치를 feature로 추출
- 간단한 분류기 (Random Forest 등) 학습
- 파서 정확도 대폭 개선 가능

---

## 4. 배포 현황

| 항목 | 내용 |
|------|------|
| 프론트엔드 | Vercel — https://buildus.vercel.app |
| 플랫폼 | React + Vite + Three.js |
| 파서 환경 | Python 3.14, PyTorch cu128, RTX 5060 |
| 파서 모델 | SAM2.1 Hiera Large |
