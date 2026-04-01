export function parseLabels(strData, spaData) {
  const cats_str = Object.fromEntries(strData.categories.map(c => [c.id, c.name]));
  const cats_spa = Object.fromEntries(spaData.categories.map(c => [c.id, c.name]));
  const imgInfo  = strData.images[0];
  const W = imgInfo.width, H = imgInfo.height;

  const walls = [], windows = [], doors = [], rooms = [];

  // ── 새 포맷: structure_skeleton (노드+엣지 그래프) ──
  if (strData.structure_skeleton) {
    const nodeMap = new Map(strData.structure_skeleton.nodes.map(n => [n.id, n]));
    for (const edge of strData.structure_skeleton.edges) {
      const n1 = nodeMap.get(edge.from), n2 = nodeMap.get(edge.to);
      if (!n1 || !n2) continue;
      // 엣지를 2점 폴리곤으로 변환
      const seg = [[n1.x, n1.y], [n2.x, n2.y]];
      const type = edge.type ?? 'wall';
      if (type === 'wall')                    walls.push(seg);
      else if (type === 'window')             windows.push(seg);
      else if (type === 'door' || type === 'sliding') {
        seg._type = type;
        doors.push(seg);
      }
    }
  } else {
    // ── 구 포맷: COCO annotations ──
    for (const ann of strData.annotations) {
      const name = cats_str[ann.category_id];
      const poly = segToPoly(ann.segmentation);
      if (!poly) continue;
      if (name === '구조_벽체')        walls.push(poly);
      else if (name === '구조_창호')   windows.push(poly);
      else if (name === '구조_출입문') doors.push(poly);
    }
  }

  for (const ann of spaData.annotations) {
    const name = cats_spa[ann.category_id];
    const poly = segToPoly(ann.segmentation);
    if (!poly || name === 'background') continue;
    if (!name.startsWith('공간_')) continue;
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    // area: from annotation area_m2 field (extracted data) or shoelace pixel calc
    const area = ann.area_m2 != null
      ? ann.area_m2
      : Math.abs(shoelace(poly)) / (1000 * 1000);
    // displayName: Korean name from room_name field, or strip "공간_" prefix
    const displayName = ann.room_name ?? name.replace(/^공간_/, '');
    rooms.push({ id: ann.id, name, displayName, poly, cx, cy, area, area_m2: ann.area_m2 ?? null });
  }

  return { imgWidth: W, imgHeight: H, walls, windows, doors, rooms, isSkeleton: !!strData.structure_skeleton };
}

function segToPoly(seg) {
  if (!seg?.[0] || seg[0].length < 4) return null;  // 선(2점)도 허용
  const c = seg[0];
  return Array.from({ length: Math.floor(c.length / 2) }, (_, i) => [c[i*2], c[i*2+1]]);
}

function shoelace(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function polyToSvgPoints(poly) {
  return poly.map(p => p.join(',')).join(' ');
}
