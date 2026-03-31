"""
sam2_segment.py — SAM2 자동 마스크 생성 + OCR 라벨링 -> spa.json

변경사항:
  - 화장실/현관 등 작은 방: 면적 필터 완화 + 최근접 폴리곤 fallback
  - 싱크대/가스레인지: 주방 폴리곤 내 작은 마스크 자동 감지
  - 포인트 밀도 증가(64)로 작은 구역 검출 향상

실행:
  GOOGLE_VISION_KEY=AIza... py scripts/sam2_segment.py [단지명] [--dry-run]
"""

import os, sys, json, re, base64, http.client
import numpy as np
from pathlib import Path
from PIL import Image

SCRIPT_DIR  = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
BASE        = PROJECT_DIR / 'public' / 'floorplans'
CHECKPOINT  = Path('C:/Users/user/claude_floorplan/sam2_checkpoints/sam2.1_hiera_large.pt')
MODEL_CFG   = 'configs/sam2.1/sam2.1_hiera_l.yaml'
API_KEY     = os.environ.get('GOOGLE_VISION_KEY', '')

ROOM_RULES = [
    (['주방및식당','주방 및 식당','주방','식당','부엌'], '공간_주방'),
    (['거실'],                                           '공간_거실'),
    (['침실','안방'],                                    '공간_침실'),
    (['화장실'],                                         '공간_화장실'),
    (['욕실'],                                           '공간_욕실'),
    (['현관','전실'],                                    '공간_현관'),   # 전실 = 현관 홀
    (['발코니','베란다'],                                '공간_발코니'),
    (['드레스룸'],                                       '공간_드레스룸'),
    (['다목적공간','다목적'],                            '공간_다목적공간'),
    (['실외기실','실외기'],                              '공간_실외기실'),
    (['싱크대','싱크'],                                  '공간_싱크대'),
    (['가스레인지','레인지','인덕션','가스'],            '공간_가스레인지'),
]
SKIP_CATS = {'background', '구조_벽체', '구조_창호', '구조_출입문'}

# 작은 방 카테고리 (fallback 매칭 허용)
SMALL_ROOM_CATS = {'공간_화장실', '공간_욕실', '공간_현관', '공간_실외기실', '공간_드레스룸'}

# 룸타입별 기본 최대 면적 비율 (참조 도면 없을 때 사용)
ROOM_MAX_AREA_PCT = {
    '공간_거실':       0.28,
    '공간_침실':       0.18,
    '공간_주방':       0.20,
    '공간_발코니':     0.10,
    '공간_화장실':     0.05,
    '공간_욕실':       0.06,
    '공간_현관':       0.06,
    '공간_드레스룸':   0.08,
    '공간_실외기실':   0.04,
    '공간_다목적공간': 0.14,
}

def load_reference_constraints(ref_spa_path: Path):
    """참조 도면(수동 annotation)에서 룸별 면적 비율 제약 자동 추출"""
    spa = json.loads(ref_spa_path.read_text(encoding='utf-8'))
    img = spa['images'][0]
    img_area = img['width'] * img['height']
    cats = {c['id']: c['name'] for c in spa['categories']}
    room_areas = {}
    for ann in spa['annotations']:
        cat = cats.get(ann['category_id'], '')
        if cat in SKIP_CATS or cat == 'background': continue
        pct = ann['area'] / img_area
        room_areas.setdefault(cat, []).append(pct)
    # 실측 최대값의 5배까지 허용 (더 큰 타입 대응), 주방은 최소 16%
    constraints = {}
    for cat, areas in room_areas.items():
        mx = min(max(areas) * 5.0, 0.50)
        if cat == '공간_주방':   mx = max(mx, 0.16)   # 주방은 거실과 합쳐질 수 있음
        if cat == '공간_거실':   mx = max(mx, 0.20)
        if cat == '공간_화장실': mx = min(mx, 0.05)   # 화장실은 작게 유지
        if cat == '공간_현관':   mx = min(mx, 0.05)
        constraints[cat] = mx
    print(f'  [참조] {ref_spa_path.name} → {len(constraints)}개 제약 로드')
    for cat, mx in sorted(constraints.items()):
        print(f'    {cat}: max={mx*100:.1f}%')
    return constraints

def text_to_cat(text):
    t = text.replace(' ', '')
    for kws, cat in ROOM_RULES:
        if any(k.replace(' ', '') in t for k in kws):
            return cat
    return None

# ── Google Vision OCR ──────────────────────────────────────────────
def ocr_image(img_path: Path):
    with open(img_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    body = json.dumps({
        'requests': [{'image': {'content': b64},
                      'features': [{'type': 'DOCUMENT_TEXT_DETECTION'}]}]
    }).encode()
    conn = http.client.HTTPSConnection('vision.googleapis.com')
    conn.request('POST', f'/v1/images:annotate?key={API_KEY}',
                 body, {'Content-Type': 'application/json'})
    data = json.loads(conn.getresponse().read())
    annotations = data.get('responses', [{}])[0].get('textAnnotations', [])
    if len(annotations) < 2:
        return []

    words  = annotations[1:]
    result = []
    used   = set()

    def avg_y(verts):
        return sum(v.get('y', 0) for v in verts) / len(verts)

    for i, w in enumerate(words):
        if i in used: continue
        desc = w['description']
        if not re.search(r'[가-힣]', desc): continue

        verts  = w['boundingPoly']['vertices']
        vy     = avg_y(verts)
        vx1    = max(v.get('x', 0) for v in verts)
        merged = desc
        all_v  = list(verts)
        prev_x = vx1

        for j in range(i+1, min(i+4, len(words))):
            if j in used: continue
            w2 = words[j]; v2 = w2['boundingPoly']['vertices']
            vx0 = min(v.get('x', 0) for v in v2)
            if not re.search(r'[가-힣및]', w2['description']): break
            if abs(avg_y(v2) - vy) > 15: break
            if vx0 < prev_x - 5: break
            if vx0 - prev_x > 50: break
            merged += w2['description']
            all_v  += v2
            prev_x  = max(v.get('x', 0) for v in v2)
            used.add(j)
        used.add(i)

        cat = text_to_cat(merged)
        if not cat: continue
        xs = [v.get('x', 0) for v in all_v]
        ys = [v.get('y', 0) for v in all_v]
        result.append({
            'text': merged, 'cat': cat,
            'cx': round((min(xs)+max(xs))/2),
            'cy': round((min(ys)+max(ys))/2),
        })
    return result

# ── SAM2 자동 마스크 생성 ──────────────────────────────────────────
def generate_masks(img_path: Path):
    import torch
    from sam2.build_sam import build_sam2
    from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'  [SAM2] device={device}')
    sam2_model = build_sam2(MODEL_CFG, str(CHECKPOINT), device=device)
    mask_gen   = SAM2AutomaticMaskGenerator(
        model                  = sam2_model,
        points_per_side        = 64,   # 작은 공간도 감지 (기존 32)
        pred_iou_thresh        = 0.75,
        stability_score_thresh = 0.85,
        min_mask_region_area   = 500,  # 더 작은 마스크도 포함 (기존 2000)
    )
    img   = np.array(Image.open(img_path).convert('RGB'))
    masks = mask_gen.generate(img)
    print(f'  [SAM2] {len(masks)}개 마스크 생성')
    return masks, img.shape[1], img.shape[0]

# ── 마스크 -> 폴리곤 (컨투어) ─────────────────────────────────────
def mask_to_polygon(mask_2d):
    import cv2
    m = mask_2d.astype(np.uint8) * 255
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours: return None
    c       = max(contours, key=cv2.contourArea)
    epsilon = 0.005 * cv2.arcLength(c, True)
    approx  = cv2.approxPolyDP(c, epsilon, True)
    pts     = approx.reshape(-1, 2).tolist()
    if len(pts) < 3: return None
    return [coord for pt in pts for coord in pt]

# ── 기하 유틸 ─────────────────────────────────────────────────────
def point_in_polygon(px, py, flat):
    pts = [(flat[i], flat[i+1]) for i in range(0, len(flat)-1, 2)]
    if len(pts) < 3: return False
    inside = False; j = len(pts)-1
    for i, (xi, yi) in enumerate(pts):
        xj, yj = pts[j]
        if ((yi > py) != (yj > py)) and (px < (xj-xi)*(py-yi)/(yj-yi)+xi):
            inside = not inside
        j = i
    return inside

def bbox_center_dist(px, py, bbox):
    bx, by, bw, bh = bbox
    return ((px-(bx+bw/2))**2 + (py-(by+bh/2))**2) ** 0.5

def poly_overlap_ratio(flat_a, flat_b, W, H):
    """두 폴리곤의 겹치는 비율 (approximate via bounding box)"""
    ax = flat_a[0::2]; ay = flat_a[1::2]
    bx = flat_b[0::2]; by = flat_b[1::2]
    ix1 = max(min(ax), min(bx)); ix2 = min(max(ax), max(bx))
    iy1 = max(min(ay), min(by)); iy2 = min(max(ay), max(by))
    if ix2 <= ix1 or iy2 <= iy1: return 0
    inter = (ix2-ix1)*(iy2-iy1)
    area_a = (max(ax)-min(ax))*(max(ay)-min(ay))
    return inter / area_a if area_a > 0 else 0

# ── spa.json 업데이트 ──────────────────────────────────────────────
def update_spa(spa_path: Path, masks, W, H, ocr_rooms, dry_run, ref_constraints=None):
    spa         = json.loads(spa_path.read_text(encoding='utf-8'))
    cat_by_name = {c['name']: c['id'] for c in spa['categories']}
    cat_by_id   = {c['id']: c['name'] for c in spa['categories']}
    max_cat_id  = max(c['id'] for c in spa['categories'])
    log         = []
    changes     = 0

    def ensure_cat(name):
        nonlocal max_cat_id
        if name not in cat_by_name:
            max_cat_id += 1
            spa['categories'].append({'id': max_cat_id, 'name': name})
            cat_by_name[name] = max_cat_id
            cat_by_id[max_cat_id] = name
        return cat_by_name[name]

    # 구조 어노테이션 유지
    struct_anns = [a for a in spa['annotations']
                   if cat_by_id.get(a['category_id'], '') in SKIP_CATS
                   or cat_by_id.get(a['category_id'], '').startswith('구조_')
                   or cat_by_id.get(a['category_id'], '') == 'background']

    img_area   = W * H
    # 방 마스크: 0.3% ~ 60% (화장실/현관 같은 작은 방 포함)
    # 오름차순 정렬: 작은 마스크 우선 매칭 → OCR 텍스트를 가장 작고 구체적인 마스크에 매칭
    room_polys = []
    for m in sorted(masks, key=lambda x: x['area']):
        area = int(m['area'])
        if not (img_area * 0.003 <= area <= img_area * 0.60):
            continue
        poly = mask_to_polygon(m['segmentation'])
        if poly and len(poly) >= 6:
            room_polys.append({
                'poly': poly, 'area': area,
                'bbox': m['bbox'], 'seg': m['segmentation']
            })
    print(f'  [필터] 방 크기 마스크: {len(room_polys)}개')

    # ── 1단계: OCR 텍스트 -> 폴리곤 매칭 ────────────────────────
    new_anns  = list(struct_anns)
    used_poly = set()

    # 작은 방(화장실/현관)부터 매칭 → 거실/주방이 겹친 큰 마스크에 묻히는 것 방지
    ocr_rooms_sorted = sorted(
        ocr_rooms,
        key=lambda r: (ref_constraints or ROOM_MAX_AREA_PCT).get(r['cat'], ROOM_MAX_AREA_PCT.get(r['cat'], 0.50))
    )

    for room in ocr_rooms_sorted:
        cx, cy, cat, text = room['cx'], room['cy'], room['cat'], room['text']

        # point-in-polygon 매칭 (룸타입별 최대 면적 제한 적용)
        # 참조 도면 제약 우선, 없으면 기본값
        max_pct = (ref_constraints or ROOM_MAX_AREA_PCT).get(cat,
                   ROOM_MAX_AREA_PCT.get(cat, 0.50))
        matched = None
        for pi, rp in enumerate(room_polys):
            if pi in used_poly: continue
            if rp['area'] / img_area > max_pct: continue  # 너무 큰 마스크 스킵
            if point_in_polygon(cx, cy, rp['poly']):
                matched = (pi, rp); break

        # 작은 방 fallback: 가장 가까운 미사용 폴리곤 (120px 이내)
        if not matched and cat in SMALL_ROOM_CATS:
            candidates = [
                (pi, rp, bbox_center_dist(cx, cy, rp['bbox']))
                for pi, rp in enumerate(room_polys)
                if pi not in used_poly
            ]
            candidates.sort(key=lambda x: x[2])
            if candidates and candidates[0][2] < 120:
                matched = (candidates[0][0], candidates[0][1])
                log.append(f'  [fallback] "{text}" 거리={candidates[0][2]:.0f}px')

        # 거실 fallback: 미사용 마스크 중 가장 큰 것 (거실은 아파트 최대 방)
        if not matched and cat == '공간_거실':
            unused = [(pi, rp) for pi, rp in enumerate(room_polys)
                      if pi not in used_poly and rp['area'] / img_area <= max_pct]
            if unused:
                pi_f, rp_f = max(unused, key=lambda x: x[1]['area'])
                matched = (pi_f, rp_f)
                log.append(f'  [거실fallback] "{text}" 최대미사용마스크 area={rp_f["area"]}px')

        if not matched:
            log.append(f'  미매칭: "{text}" ({cat})')
            continue

        pi, rp = matched
        used_poly.add(pi)
        flat = rp['poly']
        xs = flat[0::2]; ys = flat[1::2]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        log.append(f'  추가: {cat} "{text}" area={rp["area"]}px')
        if not dry_run:
            new_anns.append({
                'id': 0,
                'category_id': ensure_cat(cat),
                'image_id': spa['images'][0]['id'],
                'segmentation': [flat],
                'area': rp['area'],
                'bbox': [x0, y0, x1-x0, y1-y0],
                'iscrowd': 0,
                'room_name': text,
                'area_m2': round(rp['area']/10000, 1),
            })
        changes += 1

    # ── 2단계: 화장실 감지 (하늘색 지시자 → 전체 방 경계) ──────────
    img_rgb = np.array(Image.open(
        next(p for p in [spa_path.parent / (spa_path.stem.replace('_spa','') + ext)
                         for ext in ['.jpg','.jpeg']] if p.exists())
    ).convert('RGB'))
    import cv2 as _cv2
    hsv_img = _cv2.cvtColor(img_rgb, _cv2.COLOR_RGB2HSV)

    # 1차: 하늘색 지시자 마스크 수집 (세면대/욕조 등 내부 요소)
    sky_indicators = []
    for pi, rp in enumerate(room_polys):
        if pi in used_poly: continue
        mask_2d = rp['seg']
        if mask_2d.shape != (H, W): continue
        region_h = hsv_img[:,:,0][mask_2d]
        region_s = hsv_img[:,:,1][mask_2d]
        region_v = hsv_img[:,:,2][mask_2d]
        if len(region_h) == 0: continue
        sky_ratio = float(np.mean(
            (region_h >= 85) & (region_h <= 130) &
            (region_s >= 8)  & (region_s <= 120) &
            (region_v >= 190)
        ))
        if sky_ratio >= 0.10:
            sky_indicators.append((pi, rp, sky_ratio))

    # 2차: 각 지시자에 대해 전체 방 경계 탐색 (지시자를 포함하는 더 큰 마스크)
    for pi_ind, rp_ind, sky_ratio in sky_indicators:
        if pi_ind in used_poly: continue
        bx, by, bw, bh = rp_ind['bbox']
        ind_cx, ind_cy = bx + bw//2, by + bh//2

        bath_max = (ref_constraints or ROOM_MAX_AREA_PCT).get('공간_화장실', 0.05)
        bath_max = min(bath_max, 0.05)   # 화장실은 절대 5% 초과 안 함
        room_candidates = []
        for pj, rp2 in enumerate(room_polys):
            if pj in used_poly or pj == pi_ind: continue
            if rp2['area'] <= rp_ind['area'] * 1.1: continue  # 반드시 더 커야 함
            if rp2['area'] > img_area * bath_max: continue    # 화장실 최대 크기
            if point_in_polygon(ind_cx, ind_cy, rp2['poly']):
                room_candidates.append((pj, rp2))

        if room_candidates:
            room_candidates.sort(key=lambda x: x[1]['area'])
            use_pi, use_rp = room_candidates[0]
            used_poly.add(pi_ind)   # 지시자도 사용됨 표시
        else:
            use_pi, use_rp = pi_ind, rp_ind

        used_poly.add(use_pi)
        flat = use_rp['poly']
        xs = flat[0::2]; ys = flat[1::2]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        log.append(f'  추가(색상감지): 공간_화장실 sky_ratio={sky_ratio:.2f} area={use_rp["area"]}px')
        if not dry_run:
            new_anns.append({
                'id': 0,
                'category_id': ensure_cat('공간_화장실'),
                'image_id': spa['images'][0]['id'],
                'segmentation': [flat],
                'area': use_rp['area'],
                'bbox': [x0, y0, x1-x0, y1-y0],
                'iscrowd': 0,
                'room_name': '화장실',
                'area_m2': round(use_rp['area']/10000, 1),
            })
        changes += 1

    # ── 2.5단계: 발코니 확장 (인접 소형 미라벨 공간 → 발코니) ─────
    # 현관 감지 전에 실행해 발코니 주변 회색 소공간 오탐 방지
    # 조건: 발코니 bbox 20px 이내 + 면적 < 이미지의 3% (대형 방 흡수 방지)
    balcony_cat_id = cat_by_name.get('공간_발코니')
    max_annex_area = img_area * 0.03  # 최대 3%
    if not dry_run:
        balcony_bbox_list = [a['bbox'] for a in new_anns
                             if a.get('category_id') == balcony_cat_id and a.get('bbox')]
    else:
        balcony_bbox_list = []

    for pi, rp in enumerate(room_polys):       # 단일 패스 (체인 확장 방지)
        if pi in used_poly: continue
        if rp['area'] > max_annex_area: continue  # 대형 방 제외
        bx, by, bw, bh = rp['bbox']
        mcx, mcy = bx + bw//2, by + bh//2
        margin = 20
        for bb in balcony_bbox_list:
            if (bb[0]-margin <= mcx <= bb[0]+bb[2]+margin and
                    bb[1]-margin <= mcy <= bb[1]+bb[3]+margin):
                used_poly.add(pi)
                flat = rp['poly']
                xs2 = flat[0::2]; ys2 = flat[1::2]
                x0,y0,x1,y1 = min(xs2),min(ys2),max(xs2),max(ys2)
                log.append(f'  추가(발코니인접): 공간_발코니 area={rp["area"]}px')
                if not dry_run:
                    new_anns.append({
                        'id': 0,
                        'category_id': ensure_cat('공간_발코니'),
                        'image_id': spa['images'][0]['id'],
                        'segmentation': [flat],
                        'area': rp['area'],
                        'bbox': [x0, y0, x1-x0, y1-y0],
                        'iscrowd': 0,
                        'area_m2': round(rp['area']/10000, 1),
                    })
                changes += 1
                break

    # ── 3단계: 현관 감지 (흰색/회색 번갈아 타일 패턴)  ──────────────
    # 현관은 무채색(S<50) + 중간밝기(V:100-235) + 높은 V 분산(번갈아 패턴)
    # OCR로 이미 전실/현관이 잡혔으면 tile detection 스킵
    _has_entrance = any(cat_by_id.get(a.get('category_id')) == '공간_현관' for a in new_anns)
    for pi, rp in (enumerate(room_polys) if not _has_entrance else []):
        if pi in used_poly: continue
        # 현관 크기: 이미지의 0.3%~7%
        if not (img_area * 0.003 <= rp['area'] <= img_area * 0.07):
            continue
        mask_2d = rp['seg']
        if mask_2d.shape != (H, W):
            continue
        region_s = hsv_img[:,:,1][mask_2d]
        region_v = hsv_img[:,:,2][mask_2d]
        if len(region_s) < 50: continue
        # 무채색 비율: S<50, V 100~235 (밝은 회색~흰색)
        tile_ratio = float(np.mean((region_s < 50) & (region_v >= 100) & (region_v <= 235)))
        v_std      = float(np.std(region_v))
        if tile_ratio >= 0.45 and v_std >= 15:
            used_poly.add(pi)
            flat = rp['poly']
            xs = flat[0::2]; ys = flat[1::2]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            log.append(f'  추가(타일감지): 공간_현관 tile={tile_ratio:.2f} v_std={v_std:.1f} area={rp["area"]}px')
            if not dry_run:
                new_anns.append({
                    'id': 0,
                    'category_id': ensure_cat('공간_현관'),
                    'image_id': spa['images'][0]['id'],
                    'segmentation': [flat],
                    'area': rp['area'],
                    'bbox': [x0, y0, x1-x0, y1-y0],
                    'iscrowd': 0,
                    'room_name': '현관',
                    'area_m2': round(rp['area']/10000, 1),
                })
            changes += 1
            break  # 현관은 보통 1개

    # ── 4단계: 드레스룸 감지 (침실 bbox 인접 소형 미사용 마스크) ──────
    # 드레스룸은 OCR 텍스트 없이 도면에 표시되는 경우가 많음
    # 조건: 침실 bbox에서 40px 이내 + 면적 0.2%~6% + 무채색(S<60) 또는 미라벨
    if not any(cat_by_id.get(a.get('category_id')) == '공간_드레스룸' for a in new_anns):
        dress_max_pct = (ref_constraints or {}).get('공간_드레스룸', ROOM_MAX_AREA_PCT.get('공간_드레스룸', 0.08))
        bedroom_bboxes = [a['bbox'] for a in new_anns
                          if cat_by_id.get(a.get('category_id')) == '공간_침실']
        dress_candidates = []
        for pi, rp in enumerate(room_polys):
            if pi in used_poly: continue
            if not (img_area * 0.002 <= rp['area'] <= img_area * dress_max_pct): continue
            bx, by, bw, bh = rp['bbox']
            mcx, mcy = bx + bw//2, by + bh//2
            margin = 40
            for bb in bedroom_bboxes:
                if (bb[0]-margin <= mcx <= bb[0]+bb[2]+margin and
                        bb[1]-margin <= mcy <= bb[1]+bb[3]+margin):
                    # 화장실 하늘색이 아닌 것만 (화장실과 구분)
                    mask_2d = rp['seg']
                    is_sky = False
                    if mask_2d.shape == (H, W):
                        region_s = hsv_img[:,:,1][mask_2d]
                        region_h = hsv_img[:,:,0][mask_2d]
                        if len(region_h) > 0:
                            sky_r = float(np.mean((region_h >= 85) & (region_h <= 130) & (region_s >= 8) & (region_s <= 120)))
                            is_sky = sky_r >= 0.10
                    if not is_sky:
                        dress_candidates.append((pi, rp))
                    break

        if dress_candidates:
            dress_candidates.sort(key=lambda x: x[1]['area'])
            pi, rp = dress_candidates[0]
            used_poly.add(pi)
            flat = rp['poly']
            xs = flat[0::2]; ys = flat[1::2]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            log.append(f'  추가(침실인접): 공간_드레스룸 area={rp["area"]}px')
            if not dry_run:
                new_anns.append({
                    'id': 0,
                    'category_id': ensure_cat('공간_드레스룸'),
                    'image_id': spa['images'][0]['id'],
                    'segmentation': [flat],
                    'area': rp['area'],
                    'bbox': [x0, y0, x1-x0, y1-y0],
                    'iscrowd': 0,
                    'room_name': '드레스룸',
                    'area_m2': round(rp['area']/10000, 1),
                })
            changes += 1

    # ── 5단계: 주방 내 싱크대/가스레인지 자동 감지 ───────────────
    kitchen_poly = next(
        (a for a in new_anns
         if cat_by_id.get(a.get('category_id'), cat_by_name.get('공간_주방')) == cat_by_name.get('공간_주방')),
        None
    )
    # new_anns에서 방금 추가된 주방 찾기
    if not kitchen_poly:
        kitchen_poly = next(
            (a for a in new_anns if cat_by_name.get('공간_주방') and
             a.get('category_id') == cat_by_name.get('공간_주방')),
            None
        )

    if kitchen_poly and kitchen_poly.get('segmentation'):
        k_flat   = kitchen_poly['segmentation'][0]
        k_area   = kitchen_poly['area']
        fixtures = []

        for pi, rp in enumerate(room_polys):
            if pi in used_poly: continue
            # 주방 면적의 5~35%인 마스크만 (싱크대/레인지 크기)
            if not (k_area * 0.05 <= rp['area'] <= k_area * 0.40):
                continue
            # 마스크 중심이 주방 폴리곤 안에 있어야 함
            bx, by, bw, bh = rp['bbox']
            mcx, mcy = bx + bw//2, by + bh//2
            if point_in_polygon(mcx, mcy, k_flat):
                fixtures.append((pi, rp))

        # 면적 큰 순 정렬: 첫번째=싱크대, 두번째=가스레인지
        fixtures.sort(key=lambda x: -x[1]['area'])
        fixture_cats = ['공간_싱크대', '공간_가스레인지']

        for idx, (pi, rp) in enumerate(fixtures[:2]):
            used_poly.add(pi)
            fcat = fixture_cats[idx]
            flat = rp['poly']
            xs = flat[0::2]; ys = flat[1::2]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            log.append(f'  추가(주방시설): {fcat} area={rp["area"]}px')
            if not dry_run:
                new_anns.append({
                    'id': 0,
                    'category_id': ensure_cat(fcat),
                    'image_id': spa['images'][0]['id'],
                    'segmentation': [flat],
                    'area': rp['area'],
                    'bbox': [x0, y0, x1-x0, y1-y0],
                    'iscrowd': 0,
                    'room_name': fcat.replace('공간_', ''),
                    'area_m2': round(rp['area']/10000, 1),
                })
            changes += 1

    # ── 중복 제거: 같은 카테고리 + bbox 50% 이상 겹침 → 큰 것 유지 ───
    def bbox_overlap(b1, b2):
        x1 = max(b1[0], b2[0]); y1 = max(b1[1], b2[1])
        x2 = min(b1[0]+b1[2], b2[0]+b2[2]); y2 = min(b1[1]+b1[3], b2[1]+b2[3])
        if x2 <= x1 or y2 <= y1: return 0.0
        inter = (x2-x1)*(y2-y1)
        smaller = min(b1[2]*b1[3], b2[2]*b2[3])
        return inter / smaller if smaller > 0 else 0.0

    room_only = [a for a in new_anns if cat_by_id.get(a.get('category_id',''),'') not in SKIP_CATS
                 and not cat_by_id.get(a.get('category_id',''),'').startswith('구조_')]
    to_remove = set()
    for i in range(len(room_only)):
        if id(room_only[i]) in to_remove: continue
        for j in range(i+1, len(room_only)):
            if id(room_only[j]) in to_remove: continue
            a, b = room_only[i], room_only[j]
            if cat_by_id.get(a.get('category_id')) != cat_by_id.get(b.get('category_id')): continue
            if not a.get('bbox') or not b.get('bbox'): continue
            # 화장실/욕실은 두 개가 각각 다른 위치에 있을 수 있으므로 임계값 높임
            ov_thresh = 0.70 if cat_by_id.get(a.get('category_id')) in ('공간_화장실','공간_욕실') else 0.50
            if bbox_overlap(a['bbox'], b['bbox']) > ov_thresh:
                smaller = b if (a.get('area',0) >= b.get('area',0)) else a
                to_remove.add(id(smaller))
                log.append(f'  중복제거: {cat_by_id.get(a.get("category_id"))} area={smaller.get("area")}px')
    new_anns = [a for a in new_anns if id(a) not in to_remove]

    # ann id 재부여
    if not dry_run:
        for i, a in enumerate(new_anns, 1):
            a['id'] = i
        spa['annotations'] = new_anns
        spa_path.write_text(json.dumps(spa, indent=2, ensure_ascii=False), encoding='utf-8')

    return changes, log

# ── 메인 ──────────────────────────────────────────────────────────
def main():
    args    = sys.argv[1:]
    dry_run = '--dry-run' in args

    # --reference 135  →  같은 단지 내 135_spa.json을 참조 도면으로 사용
    ref_stem = None
    for i, a in enumerate(args):
        if a == '--reference' and i+1 < len(args):
            ref_stem = args[i+1]; break
    positional = [a for a in args if not a.startswith('--') and a != ref_stem]
    filter_ = positional[0] if positional else None

    if not API_KEY:
        print('GOOGLE_VISION_KEY 없음'); sys.exit(1)
    if not CHECKPOINT.exists():
        print(f'체크포인트 없음: {CHECKPOINT}'); sys.exit(1)
    if dry_run:
        print('[DRY RUN]\n')
    if ref_stem:
        print(f'[참조 도면] {ref_stem}_spa.json 을 면적 제약 기준으로 사용\n')

    complexes = sorted(BASE.iterdir())
    if filter_:
        complexes = [c for c in complexes if c.name == filter_]

    done = skip = err = 0
    for cx_dir in complexes:
        if not cx_dir.is_dir(): continue

        # 같은 단지 내 참조 도면 로드
        ref_constraints = None
        if ref_stem:
            ref_path = cx_dir / f'{ref_stem}_spa.json'
            if ref_path.exists():
                ref_constraints = load_reference_constraints(ref_path)
            else:
                print(f'  [경고] 참조 도면 없음: {ref_path}')

        for spa_path in sorted(cx_dir.glob('*_spa.json')):
            stem = spa_path.stem.replace('_spa', '')
            # 참조 도면 자체는 다시 처리 안 함
            if ref_stem and stem == ref_stem:
                print(f'  [스킵] 참조 도면: {spa_path.name}')
                skip += 1; continue

            img_path = cx_dir / f'{stem}.jpg'
            if not img_path.exists():
                img_path = cx_dir / f'{stem}.jpeg'
            if not img_path.exists():
                skip += 1; continue

            print(f'\n[{cx_dir.name}/{spa_path.name}]')
            try:
                print('  OCR...')
                ocr_rooms = ocr_image(img_path)
                print(f'  OCR: {[r["text"] for r in ocr_rooms]}')
                print('  SAM2...')
                masks, W, H = generate_masks(img_path)
                changes, log = update_spa(spa_path, masks, W, H, ocr_rooms, dry_run, ref_constraints)
                print(f'  -> {changes}개 추가')
                for l in log: print(l)
                done += 1
            except Exception as e:
                import traceback; traceback.print_exc()
                print(f'  ERROR: {e}'); err += 1

    print(f'\n완료: {done}개 처리, {skip}개 스킵, {err}개 오류')

if __name__ == '__main__':
    main()
