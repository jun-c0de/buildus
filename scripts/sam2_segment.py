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
    (['현관'],                                           '공간_현관'),
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
def update_spa(spa_path: Path, masks, W, H, ocr_rooms, dry_run):
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

    for room in ocr_rooms:
        cx, cy, cat, text = room['cx'], room['cy'], room['cat'], room['text']

        # point-in-polygon 매칭
        matched = None
        for pi, rp in enumerate(room_polys):
            if pi in used_poly: continue
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

    # ── 2단계: 화장실 색상 감지 (하늘색 배경) ───────────────────
    img_rgb = np.array(Image.open(
        next(p for p in [spa_path.parent / (spa_path.stem.replace('_spa','') + ext)
                         for ext in ['.jpg','.jpeg']] if p.exists())
    ).convert('RGB'))
    import cv2 as _cv2
    hsv_img = _cv2.cvtColor(img_rgb, _cv2.COLOR_RGB2HSV)

    for pi, rp in enumerate(room_polys):
        if pi in used_poly: continue
        mask_2d = rp['seg']
        if mask_2d.shape != (H, W):
            continue
        region_h = hsv_img[:,:,0][mask_2d]
        region_s = hsv_img[:,:,1][mask_2d]
        region_v = hsv_img[:,:,2][mask_2d]
        if len(region_h) == 0: continue
        # 하늘색: H 85-130, S 8-120, V 190-255
        sky_ratio = np.mean(
            (region_h >= 85) & (region_h <= 130) &
            (region_s >= 8)  & (region_s <= 120) &
            (region_v >= 190)
        )
        if sky_ratio >= 0.10:
            used_poly.add(pi)
            flat = rp['poly']
            xs = flat[0::2]; ys = flat[1::2]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            log.append(f'  추가(색상감지): 공간_화장실 sky_ratio={sky_ratio:.2f} area={rp["area"]}px')
            if not dry_run:
                new_anns.append({
                    'id': 0,
                    'category_id': ensure_cat('공간_화장실'),
                    'image_id': spa['images'][0]['id'],
                    'segmentation': [flat],
                    'area': rp['area'],
                    'bbox': [x0, y0, x1-x0, y1-y0],
                    'iscrowd': 0,
                    'room_name': '화장실',
                    'area_m2': round(rp['area']/10000, 1),
                })
            changes += 1

    # ── 3단계: 현관 감지 (출입문 인접 마스크) ────────────────────
    # str.json에서 출입문 좌표 가져오기
    str_path = spa_path.parent / spa_path.name.replace('_spa.json', '_str.json')
    door_centers = []
    if str_path.exists():
        str_data   = json.loads(str_path.read_text(encoding='utf-8'))
        str_cats   = {c['id']: c['name'] for c in str_data.get('categories', [])}
        for ann in str_data.get('annotations', []):
            if str_cats.get(ann['category_id'], '') == '구조_출입문':
                seg = ann.get('segmentation', [[]])[0]
                if len(seg) >= 2:
                    xs = seg[0::2]; ys = seg[1::2]
                    door_centers.append((
                        round((min(xs)+max(xs))/2),
                        round((min(ys)+max(ys))/2)
                    ))

    if door_centers:
        # 중복 문 제거 (40px 이내 = 동일 문)
        unique_doors = []
        for d in door_centers:
            if not any(((d[0]-u[0])**2+(d[1]-u[1])**2)**0.5 < 40 for u in unique_doors):
                unique_doors.append(d)

        # 모든 고유 문 인근(150px) 미매칭 마스크 수집
        # 현관은 드레스룸보다 작음 → 가장 작은 마스크 선택 (면적 우선)
        # 동일 마스크 중복 방지 (여러 문에서 같은 마스크 후보 등장 가능)
        cand_map = {}  # pi -> (pi, rp, min_dist)
        for pi, rp in enumerate(room_polys):
            if pi in used_poly: continue
            bx, by, bw, bh = rp['bbox']
            mcx, mcy = bx+bw//2, by+bh//2
            # 현관 크기 제한: img_area 의 0.3%~8% (너무 크면 드레스룸/침실)
            if not (img_area * 0.003 <= rp['area'] <= img_area * 0.08):
                continue
            min_d = min(((mcx-dx)**2+(mcy-dy)**2)**0.5 for dx,dy in unique_doors)
            if min_d < 150:
                cand_map[pi] = (pi, rp, min_d)

        if cand_map:
            candidates = sorted(cand_map.values(), key=lambda x: x[1]['area'])
            pi, rp, d = candidates[0]
            used_poly.add(pi)
            flat = rp['poly']
            xs = flat[0::2]; ys = flat[1::2]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            log.append(f'  추가(출입문인접): 공간_현관 dist={d:.0f}px area={rp["area"]}px')
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

    # ── 4단계: 주방 내 싱크대/가스레인지 자동 감지 ───────────────
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
    filter_ = next((a for a in args if not a.startswith('--')), None)

    if not API_KEY:
        print('GOOGLE_VISION_KEY 없음'); sys.exit(1)
    if not CHECKPOINT.exists():
        print(f'체크포인트 없음: {CHECKPOINT}'); sys.exit(1)
    if dry_run:
        print('[DRY RUN]\n')

    complexes = sorted(BASE.iterdir())
    if filter_:
        complexes = [c for c in complexes if c.name == filter_]

    done = skip = err = 0
    for cx_dir in complexes:
        if not cx_dir.is_dir(): continue
        for spa_path in sorted(cx_dir.glob('*_spa.json')):
            stem     = spa_path.stem.replace('_spa', '')
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
                changes, log = update_spa(spa_path, masks, W, H, ocr_rooms, dry_run)
                print(f'  -> {changes}개 추가')
                for l in log: print(l)
                done += 1
            except Exception as e:
                import traceback; traceback.print_exc()
                print(f'  ERROR: {e}'); err += 1

    print(f'\n완료: {done}개 처리, {skip}개 스킵, {err}개 오류')

if __name__ == '__main__':
    main()
