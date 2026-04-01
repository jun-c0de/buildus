import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_CONFIG, OPEN_PLAN_GROUPS, ROOM_FLOOR_COLOR } from '../data/roomConfig';

const SCALE  = 10;
const WALL_H = 2.5;

// ── 문/창호 설정 ─────────────────────────────────────────────────
const DOOR_W            = 0.52;   // 표준 문 너비 (~80cm)
const DOOR_H            = WALL_H * 0.84;  // 문 높이 (벽 높이의 84%)
const BALCONY_OPEN_RATIO = 0.78;  // 발코니 창호 개구 비율
const BALCONY_TYPES     = ['공간_발코니', '공간_실외기실'];

// ── 좌표 정규화 ──────────────────────────────────────────────────
function normalize(poly, W, H) {
  return poly.map(([x, y]) => [(x / W - 0.5) * SCALE, (y / H - 0.5) * SCALE]);
}
function makeShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
function edgeKey(p1, p2) {
  // 4px 허용 오차 (SAM2 폴리곤 좌표 정밀도 보정 → 벽 두께 gap ~3-5px 브릿지)
  const r = ([x, y]) => `${Math.round(x * 4) / 4},${Math.round(y * 4) / 4}`;
  const k1 = r(p1), k2 = r(p2);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}
function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
// ── 이미지 Y → 3D world Z 변환 (floor 회전 -π/2 보정: shape_Y → world_-Z)
// 방 바닥: normalize()[1] = +Yn → rotation(-π/2) → world Z = -Yn
// 모든 직접 배치 요소(벽·텍스트·가구)는 -Yn 을 써야 방 바닥과 일치
function toWorldZ(yImg, H) { return -(yImg / H - 0.5) * SCALE; }

function calcBounds(rooms, W, H) {
  if (!rooms.length) return { minX:-5, maxX:5, minZ:-5, maxZ:5, cx:0, cz:0, w:10, d:10 };
  const allPts = rooms.flatMap(r => r.poly.map(([x, y]) => [(x/W-0.5)*SCALE, toWorldZ(y,H)]));
  const minX = Math.min(...allPts.map(p => p[0]));
  const maxX = Math.max(...allPts.map(p => p[0]));
  const minZ = Math.min(...allPts.map(p => p[1]));
  const maxZ = Math.max(...allPts.map(p => p[1]));
  return { minX, maxX, minZ, maxZ, cx:(minX+maxX)/2, cz:(minZ+maxZ)/2, w:maxX-minX, d:maxZ-minZ };
}

// ── 텍스처 ───────────────────────────────────────────────────────
function makeWoodTexture(color = '#C9A050') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 512);
  const plankH = 42;
  for (let y = 0; y < 512; y += plankH) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, y, 512, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, y+2, 512, 1);
    for (let i = 0; i < 6; i++) {
      const gy = y + 5 + Math.random()*(plankH-10);
      const style = Math.random()<0.5
        ? `rgba(0,0,0,${(Math.random()*0.07+0.03).toFixed(2)})`
        : `rgba(255,255,255,${(Math.random()*0.07+0.02).toFixed(2)})`;
      ctx.strokeStyle = style; ctx.lineWidth = Math.random()*1.5+0.5;
      ctx.beginPath(); ctx.moveTo(0, gy);
      ctx.bezierCurveTo(128,gy+(Math.random()-0.5)*5, 384,gy+(Math.random()-0.5)*5, 512,gy+(Math.random()-0.5)*3);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2,2);
  return tex;
}
function makeTileTexture(dark=false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = dark?'#DDD9D2':'#E8F2F8', tile=dark?'#E5E2DB':'#EEF6FB', line=dark?'#C8C4BC':'#C4D8E8';
  ctx.fillStyle = base; ctx.fillRect(0,0,256,256);
  const sz=60, gap=4;
  for (let row=0; row*(sz+gap)<256; row++) {
    for (let col=0; col*(sz+gap)<256; col++) {
      const x=col*(sz+gap)+gap/2, y=row*(sz+gap)+gap/2;
      ctx.fillStyle=tile; ctx.fillRect(x,y,sz,sz);
      ctx.strokeStyle=line; ctx.lineWidth=0.8; ctx.strokeRect(x,y,sz,sz);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3,3);
  return tex;
}

// ── 가구 컴포넌트 ─────────────────────────────────────────────────
const STD = <meshStandardMaterial color="#B8A898" roughness={0.8} />;

function Sofa({ position, rotation=0, s=1 }) {
  const c = '#B4A494';
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.22*s, 0]} castShadow>
        <boxGeometry args={[1.55*s, 0.24*s, 0.72*s]} />
        <meshStandardMaterial color={c} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.52*s, -0.3*s]} castShadow>
        <boxGeometry args={[1.55*s, 0.48*s, 0.16*s]} />
        <meshStandardMaterial color={c} roughness={0.75} />
      </mesh>
      {[[-0.71,0],[0.71,0]].map(([lx],i)=>(
        <mesh key={i} position={[lx*s, 0.38*s, 0]} castShadow>
          <boxGeometry args={[0.16*s, 0.36*s, 0.72*s]} />
          <meshStandardMaterial color={c} roughness={0.75} />
        </mesh>
      ))}
      {[[-0.64,-0.28],[0.64,-0.28],[-0.64,0.28],[0.64,0.28]].map(([lx,lz],i)=>(
        <mesh key={i} position={[lx*s, 0.04*s, lz*s]} castShadow>
          <boxGeometry args={[0.07*s, 0.08*s, 0.07*s]} />
          <meshStandardMaterial color="#7A6348" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable({ position, s=1 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.33*s, 0]} castShadow>
        <boxGeometry args={[0.78*s, 0.05*s, 0.44*s]} />
        <meshStandardMaterial color="#C8B08A" roughness={0.45} />
      </mesh>
      {[[-0.33,-0.17],[0.33,-0.17],[-0.33,0.17],[0.33,0.17]].map(([lx,lz],i)=>(
        <mesh key={i} position={[lx*s, 0.165*s, lz*s]} castShadow>
          <boxGeometry args={[0.05*s, 0.33*s, 0.05*s]} />
          <meshStandardMaterial color="#A07850" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function TVUnit({ position, rotation=0, s=1 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.2*s, 0]} castShadow>
        <boxGeometry args={[1.5*s, 0.38*s, 0.38*s]} />
        <meshStandardMaterial color="#3A3530" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.75*s, 0.04*s]} castShadow>
        <boxGeometry args={[1.15*s, 0.65*s, 0.06*s]} />
        <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Bed({ position, rotation=0, s=1 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.13*s, 0]} castShadow>
        <boxGeometry args={[1.42*s, 0.24*s, 2.1*s]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.28*s, 0.06*s]} castShadow>
        <boxGeometry args={[1.28*s, 0.14*s, 1.78*s]} />
        <meshStandardMaterial color="#F4EFE8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36*s, 0.32*s]} castShadow>
        <boxGeometry args={[1.28*s, 0.07*s, 1.12*s]} />
        <meshStandardMaterial color="#C0D0E0" roughness={0.55} />
      </mesh>
      {[[-0.3,0],[0.3,0]].map(([px],i)=>(
        <mesh key={i} position={[px*s, 0.37*s, -0.68*s]} castShadow>
          <boxGeometry args={[0.48*s, 0.1*s, 0.3*s]} />
          <meshStandardMaterial color="#FAFAFA" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.68*s, -0.98*s]} castShadow>
        <boxGeometry args={[1.42*s, 0.88*s, 0.1*s]} />
        <meshStandardMaterial color="#7A6348" roughness={0.7} />
      </mesh>
    </group>
  );
}

function DiningSet({ position, s=1 }) {
  const wood = <meshStandardMaterial color="#C8A878" roughness={0.5} />;
  const leg  = <meshStandardMaterial color="#A07850" roughness={0.6} />;
  const ch   = <meshStandardMaterial color="#D4B890" roughness={0.7} />;
  return (
    <group position={position}>
      {/* 테이블 상판 */}
      <mesh position={[0, 0.72*s, 0]} castShadow>
        <boxGeometry args={[1.1*s, 0.05*s, 0.65*s]} />
        {wood}
      </mesh>
      {[[-0.47,-0.26],[0.47,-0.26],[-0.47,0.26],[0.47,0.26]].map(([lx,lz],i)=>(
        <mesh key={i} position={[lx*s, 0.36*s, lz*s]} castShadow>
          <boxGeometry args={[0.05*s, 0.72*s, 0.05*s]} />{leg}
        </mesh>
      ))}
      {/* 의자 2개 */}
      {[[-0.72,0,Math.PI/2],[0.72,0,-Math.PI/2]].map(([cx,cz,rot],i)=>(
        <group key={i} position={[cx*s, 0, cz*s]} rotation={[0,rot,0]}>
          <mesh position={[0, 0.4*s, 0]} castShadow>
            <boxGeometry args={[0.38*s, 0.04*s, 0.38*s]} />{ch}
          </mesh>
          <mesh position={[0, 0.72*s, 0.18*s]} castShadow>
            <boxGeometry args={[0.38*s, 0.56*s, 0.05*s]} />{ch}
          </mesh>
          {[[-0.15,-0.15],[0.15,-0.15],[-0.15,0.15],[0.15,0.15]].map(([lx,lz],j)=>(
            <mesh key={j} position={[lx*s, 0.2*s, lz*s]} castShadow>
              <boxGeometry args={[0.04*s, 0.4*s, 0.04*s]} />
              <meshStandardMaterial color="#A08060" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Plant({ position, s=0.5 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.13*s, 0]} castShadow>
        <cylinderGeometry args={[0.14*s, 0.11*s, 0.24*s, 7]} />
        <meshStandardMaterial color="#C4856A" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.44*s, 0]} castShadow>
        <sphereGeometry args={[0.26*s, 8, 7]} />
        <meshStandardMaterial color="#5C8C48" roughness={0.65} />
      </mesh>
    </group>
  );
}

function Wardrobe({ position, rotation=0, s=1 }) {
  return (
    <group position={position} rotation={[0,rotation,0]}>
      <mesh position={[0, WALL_H*0.42, 0]} castShadow>
        <boxGeometry args={[1.55*s, WALL_H*0.84, 0.5*s]} />
        <meshStandardMaterial color="#D8CCB8" roughness={0.6} />
      </mesh>
      <mesh position={[0, WALL_H*0.42, 0.26*s]}>
        <boxGeometry args={[0.015, WALL_H*0.78, 0.01]} />
        <meshStandardMaterial color="#B8AA98" roughness={0.8} />
      </mesh>
      <mesh position={[0, WALL_H*0.42-0.05*s, 0.26*s]}>
        <sphereGeometry args={[0.03*s, 6, 6]} />
        <meshStandardMaterial color="#C8B898" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ── 룸별 가구 자동 배치 ──────────────────────────────────────────
function RoomFurniture({ room, W, H }) {
  const cx3 = (room.cx / W - 0.5) * SCALE;
  const cz3 = toWorldZ(room.cy, H);
  const pct  = room.area / (W * H);
  const s    = Math.min(Math.sqrt(pct) * 3.2, 1.3);

  switch (room.name) {
    case '공간_거실':
      return (
        <group>
          <Sofa     position={[cx3-0.1, 0, cz3+s*0.5]}  rotation={0}        s={s*0.72} />
          <CoffeeTable position={[cx3, 0, cz3-s*0.05]}                       s={s*0.55} />
          <TVUnit   position={[cx3, 0, cz3-s*0.9]}       rotation={Math.PI}  s={s*0.65} />
          <Plant    position={[cx3+s*0.85, 0, cz3+s*0.5]}                    s={0.48}   />
        </group>
      );
    case '공간_침실':
      return <Bed position={[cx3, 0, cz3]} s={s*0.78} />;
    case '공간_주방':
      return <DiningSet position={[cx3, 0, cz3]} s={s*0.62} />;
    case '공간_드레스룸':
      return <Wardrobe position={[cx3, 0, cz3]} s={s*0.85} />;
    case '공간_발코니':
      return pct > 0.018 ? <Plant position={[cx3, 0, cz3]} s={0.45} /> : null;
    default:
      return null;
  }
}

// ── 방 바닥 ───────────────────────────────────────────────────────
function Room({ room, W, H }) {
  const floorColor = ROOM_FLOOR_COLOR[room.name] || '#EDE8DF';
  // 2D 아키스케치 스타일과 동일: 침실/드레스룸만 나무
  const isWood     = ['공간_침실','공간_드레스룸','공간_다목적공간'].includes(room.name);
  const isTile     = ['공간_화장실','공간_욕실'].includes(room.name);
  const isDarkTile = ['공간_발코니','공간_실외기실'].includes(room.name);

  const tex = useMemo(() => {
    if (isWood)              return makeWoodTexture(floorColor);
    if (isTile || isDarkTile) return makeTileTexture(isDarkTile);
    return null;
  }, [room.name]);

  const geo = useMemo(() => {
    const pts = normalize(room.poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ShapeGeometry(makeShape(pts));
  }, [room.poly, W, H]);

  const cx3 = (room.cx / W - 0.5) * SCALE;
  const cz3 = toWorldZ(room.cy, H);
  const cfg  = ROOM_CONFIG[room.name] || { label: room.name };
  const label = room.displayName ?? cfg.label ?? room.name;

  if (!geo) return null;
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <meshStandardMaterial
          color={floorColor} map={tex ?? null}
          roughness={isWood ? 0.72 : isDarkTile ? 0.55 : 0.38}
          metalness={isWood ? 0 : 0.04}
        />
      </mesh>
      <Text
        position={[cx3, 0.025, cz3]}
        rotation={[-Math.PI/2, 0, 0]}
        fontSize={0.19} color="#1A1A18" fontWeight="bold"
        anchorX="center" anchorY="middle"
        outlineWidth={0.018} outlineColor="rgba(255,255,255,0.92)"
      >
        {label}
      </Text>
    </group>
  );
}

// ── 벽/창호 ──────────────────────────────────────────────────────
function Wall({ poly, W, H }) {
  const geo = useMemo(() => {
    const pts = normalize(poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ExtrudeGeometry(makeShape(pts), { depth: WALL_H, bevelEnabled: false });
  }, [poly, W, H]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI/2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#E6E4E0" roughness={0.55} />
    </mesh>
  );
}

function Window3D({ poly, W, H }) {
  const geo = useMemo(() => {
    const pts = normalize(poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ExtrudeGeometry(makeShape(pts), { depth: WALL_H*0.6, bevelEnabled: false });
  }, [poly, W, H]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI/2, 0, 0]} position={[0, WALL_H*0.2, 0]}>
      <meshStandardMaterial color="#B8D8F0" transparent opacity={0.32} />
    </mesh>
  );
}

function WallSeg({ p1, p2, isExterior, hasDoor, isBalconyEdge }) {
  const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx+dz*dz);
  if (len < 0.04) return null;

  const thick = isExterior ? 0.16 : 0.07;
  const h     = isExterior ? WALL_H : WALL_H * 0.96;
  const color = isExterior ? '#E0DDD8' : '#EDEAE6';
  const angle = Math.atan2(dz, dx);
  const ux = dx / len, uz = dz / len;

  // 벽 구간을 [from, to] 범위로 렌더링하는 헬퍼
  const wallPart = (from, to, key) => {
    const partLen = to - from;
    if (partLen < 0.04) return null;
    const pcx = p1[0] + ux * (from + partLen / 2);
    const pcz = p1[1] + uz * (from + partLen / 2);
    return (
      <mesh key={key} position={[pcx, h / 2, pcz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
        <boxGeometry args={[partLen, h, thick]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    );
  };

  // ── 발코니 창호: 중앙 78% 개구, 양 끝 벽만 남김
  if (isBalconyEdge) {
    const openW = len * BALCONY_OPEN_RATIO;
    const sideW = (len - openW) / 2;
    if (sideW < 0.04) return null;
    return <>{wallPart(0, sideW, 'L')}{wallPart(len - sideW, len, 'R')}</>;
  }

  // ── 내부 문: 중앙에 DOOR_W 크기 구멍 + 상단 인방
  if (hasDoor) {
    const doorW = Math.min(DOOR_W, len * 0.8);
    if (len <= doorW * 1.25) return null;  // 벽 전체가 문
    const side = (len - doorW) / 2;
    const lintH = h - DOOR_H;              // 인방 높이
    const lintY = DOOR_H + lintH / 2;
    const doorCX = p1[0] + ux * (side + doorW / 2);
    const doorCZ = p1[1] + uz * (side + doorW / 2);
    return (
      <>
        {wallPart(0, side, 'L')}
        {wallPart(len - side, len, 'R')}
        {/* 문 상단 인방 */}
        <mesh position={[doorCX, lintY, doorCZ]} rotation={[0, -angle, 0]} castShadow>
          <boxGeometry args={[doorW, lintH, thick]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      </>
    );
  }

  // ── 일반 벽
  const cx = (p1[0] + p2[0]) / 2, cz = (p1[1] + p2[1]) / 2;
  return (
    <mesh position={[cx, h / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, h, thick]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

// ── 스켈레톤 전용 3D 컴포넌트 ─────────────────────────────────────
// 방 바닥과 동일한 Z 방향 사용 (toWorldZ 적용)
function normSeg(seg, W, H) {
  return seg.map(([x, y]) => [(x / W - 0.5) * SCALE, toWorldZ(y, H)]);
}

function WallSkeletonSeg({ seg, W, H }) {
  const [p1, p2] = normSeg(seg, W, H);
  const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx+dz*dz);
  if (len < 0.02) return null;
  const angle = Math.atan2(dz, dx);
  const cx = (p1[0]+p2[0])/2, cz = (p1[1]+p2[1])/2;
  return (
    <mesh position={[cx, WALL_H/2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, WALL_H, 0.13]} />
      <meshStandardMaterial color="#D6D2CB" roughness={0.54} />
    </mesh>
  );
}

function DoorSeg3D({ seg, W, H }) {
  const [p1, p2] = normSeg(seg, W, H);
  const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx+dz*dz);
  if (len < 0.02) return null;
  const angle = Math.atan2(dz, dx);
  const cx = (p1[0]+p2[0])/2, cz = (p1[1]+p2[1])/2;
  const doorH = WALL_H * 0.84;
  const lintH = WALL_H - doorH;
  // 힌지 기준 문짝 (p1에서 90도 열린 방향)
  const nx = -dz/len, nz = dx/len;
  const panelCX = p1[0] + nx * len * 0.5;
  const panelCZ = p1[1] + nz * len * 0.5;
  return (
    <group>
      {/* 인방 (lintel) */}
      <mesh position={[cx, doorH + lintH/2, cz]} rotation={[0, -angle, 0]} castShadow>
        <boxGeometry args={[len, lintH, 0.13]} />
        <meshStandardMaterial color="#D6D2CB" roughness={0.54} />
      </mesh>
      {/* 문짝 패널 (90도 열린 상태) */}
      <mesh position={[panelCX, doorH/2, panelCZ]} rotation={[0, -(angle + Math.PI/2), 0]}>
        <boxGeometry args={[len * 0.95, doorH * 0.95, 0.04]} />
        <meshStandardMaterial color="#C8B48A" roughness={0.48} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function WindowSeg3D({ seg, W, H }) {
  const [p1, p2] = normSeg(seg, W, H);
  const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx+dz*dz);
  if (len < 0.02) return null;
  const angle = Math.atan2(dz, dx);
  const cx = (p1[0]+p2[0])/2, cz = (p1[1]+p2[1])/2;
  const sillH = WALL_H * 0.22;
  const headH = WALL_H * 0.12;
  const winH  = WALL_H - sillH - headH;
  return (
    <group>
      <mesh position={[cx, sillH/2, cz]} rotation={[0, -angle, 0]} castShadow>
        <boxGeometry args={[len, sillH, 0.13]} />
        <meshStandardMaterial color="#D6D2CB" roughness={0.54} />
      </mesh>
      <mesh position={[cx, sillH + winH + headH/2, cz]} rotation={[0, -angle, 0]} castShadow>
        <boxGeometry args={[len, headH, 0.13]} />
        <meshStandardMaterial color="#D6D2CB" roughness={0.54} />
      </mesh>
      <mesh position={[cx, sillH + winH/2, cz]} rotation={[0, -angle, 0]}>
        <boxGeometry args={[len * 0.94, winH, 0.04]} />
        <meshStandardMaterial color="#B8D8F0" transparent opacity={0.38} />
      </mesh>
    </group>
  );
}

// ── 씬 ───────────────────────────────────────────────────────────
function Scene({ data }) {
  const { imgWidth:W, imgHeight:H, walls, windows, doors = [], rooms, isSkeleton = false } = data;
  const bounds = useMemo(() => calcBounds(rooms, W, H), [rooms, W, H]);

  // 오픈플랜 그룹 맵 (roomName → groupIndex)
  const openPlanMap = useMemo(() => {
    const m = {};
    OPEN_PLAN_GROUPS.forEach((names, gi) => names.forEach(n => (m[n] = gi)));
    return m;
  }, []);

  const wallSegs = useMemo(() => {
    const counts={}, segs={}, edgeRooms={};
    // 정규화된 폴리곤 미리 계산 (공간 체크용)
    const normRooms = rooms.map(r => ({ name: r.name, poly: normalize(r.poly, W, H) }));

    for (const room of normRooms) {
      for (let i=0; i<room.poly.length; i++) {
        const p1=room.poly[i], p2=room.poly[(i+1)%room.poly.length];
        const k=edgeKey(p1,p2);
        counts[k]=(counts[k]||0)+1;
        segs[k]={p1,p2};
        if (!edgeRooms[k]) edgeRooms[k]=[];
        edgeRooms[k].push(room.name);
      }
    }

    return Object.entries(segs)
      .map(([k,{p1,p2}])=>{
        const isExteriorByCount = counts[k] === 1;
        const roomNames = edgeRooms[k] ?? [];

        // 공유 엣지 오픈플랜 체크
        if (!isExteriorByCount) {
          const isOpen = OPEN_PLAN_GROUPS.some(g => roomNames.every(n => g.includes(n)));
          if (isOpen) return null;
        }

        // gap으로 분리된 오픈플랜 경계 공간 체크 (거실-주방 등)
        if (isExteriorByCount) {
          const mx = (p1[0]+p2[0])/2, mz = (p1[1]+p2[1])/2;
          const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
          const len = Math.sqrt(dx*dx+dz*dz);
          if (len >= 0.01) {
            const nx = -dz/len, nz = dx/len;
            const OFF = 0.10;
            const r1 = normRooms.find(r => pointInPoly([mx+nx*OFF, mz+nz*OFF], r.poly))?.name;
            const r2 = normRooms.find(r => pointInPoly([mx-nx*OFF, mz-nz*OFF], r.poly))?.name;
            if (r1 && r2 && r1 !== r2) {
              const isOpen = OPEN_PLAN_GROUPS.some(g => g.includes(r1) && g.includes(r2));
              if (isOpen) return null;
              // gap으로 분리된 내부 경계 → 얇은 내벽으로 처리
              return { p1, p2, isExterior: false, hasDoor: false, isBalconyEdge: false };
            }
          }
        }

        const isExterior = isExteriorByCount;
        const hasBalcony = roomNames.some(n => BALCONY_TYPES.includes(n));
        const hasDoor    = !isExterior && !hasBalcony && roomNames.length >= 2;
        const isBalconyEdge = !isExterior && hasBalcony;
        return { p1, p2, isExterior, hasDoor, isBalconyEdge };
      })
      .filter(Boolean);
  }, [rooms, W, H, openPlanMap]);

  // 외곽 윤곽선 폴리곤 (배경을 아파트 형태로)
  const outerPoly = useMemo(() => {
    const extSegs = wallSegs.filter(s => s.isExterior);
    if (extSegs.length < 3) return null;
    try {
      const kp = ([x, y]) => `${Math.round(x * 8)},${Math.round(y * 8)}`;
      const adj = new Map();
      for (const { p1, p2 } of extSegs) {
        const k1 = kp(p1), k2 = kp(p2);
        if (!adj.has(k1)) adj.set(k1, { pt: p1, neighbors: [] });
        if (!adj.has(k2)) adj.set(k2, { pt: p2, neighbors: [] });
        adj.get(k1).neighbors.push(k2);
        adj.get(k2).neighbors.push(k1);
      }
      const start = adj.keys().next().value;
      const visited = new Set([start]);
      const poly = [adj.get(start).pt];
      let cur = start;
      for (let i = 0; i < extSegs.length * 2; i++) {
        const next = adj.get(cur).neighbors.find(n => !visited.has(n));
        if (!next) break;
        visited.add(next);
        poly.push(adj.get(next).pt);
        cur = next;
      }
      return poly.length >= 3 ? poly : null;
    } catch { return null; }
  }, [wallSegs]);

  // 등각투영 카메라 위치 (아파트 우상단 45도)
  const isoX = bounds.cx + (bounds.w*0.6 + 10);
  const isoZ = bounds.cz + (bounds.d*0.6 + 10);

  return (
    <>
      {/* 등각투영 직교 카메라 */}
      <OrthographicCamera
        makeDefault
        position={[isoX, 18, isoZ]}
        zoom={46}
        near={0.1}
        far={200}
      />

      {/* 캔버스 배경 — 2D와 동일한 중립 베이지 */}
      <color attach="background" args={['#F2F2F0']} />

      {/* 조명 — iso3d 스타일 (강한 방향광 + 부드러운 앰비언트) */}
      <ambientLight intensity={0.92} />
      <directionalLight
        position={[bounds.cx+10, 24, bounds.cz+6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-22}  shadow-camera-right={22}
        shadow-camera-top={22}    shadow-camera-bottom={-22}
      />
      <directionalLight position={[bounds.cx-8, 12, bounds.cz-6]} intensity={0.22} color="#EEF0F4" />
      <hemisphereLight skyColor="#F0EFEC" groundColor="#E8E4DE" intensity={0.42} />

      {/* 배경 바닥 — 아파트 외곽 형태 (방 색상과 같은 아이보리) */}
      {outerPoly ? (
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]} receiveShadow>
          <shapeGeometry args={[makeShape(outerPoly)]} />
          <meshStandardMaterial color="#F5F0E8" roughness={0.88} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI/2,0,0]} position={[bounds.cx,-0.01,bounds.cz]} receiveShadow>
          <planeGeometry args={[bounds.w+2.5, bounds.d+2.5]} />
          <meshStandardMaterial color="#F5F0E8" roughness={0.88} />
        </mesh>
      )}

      {/* 방 바닥 */}
      {rooms.map((r,i) => <Room key={i} room={r} W={W} H={H} />)}

      {/* 가구 */}
      {rooms.map((r,i) => <RoomFurniture key={i} room={r} W={W} H={H} />)}

      {/* 벽/창호/문 — skeleton vs 레거시 분기 */}
      {isSkeleton ? (
        <>
          {walls.map((seg, i) => <WallSkeletonSeg key={i} seg={seg} W={W} H={H} />)}
          {doors.map((seg, i) => <DoorSeg3D key={i} seg={seg} W={W} H={H} />)}
          {windows.map((seg, i) => <WindowSeg3D key={i} seg={seg} W={W} H={H} />)}
        </>
      ) : (
        <>
          {windows.map((poly, i) => <Window3D key={i} poly={poly} W={W} H={H} />)}
          {wallSegs.map(({ p1, p2, isExterior, hasDoor, isBalconyEdge }, i) => (
            <WallSeg key={i} p1={p1} p2={p2} isExterior={isExterior} hasDoor={hasDoor} isBalconyEdge={isBalconyEdge} />
          ))}
        </>
      )}

      <OrbitControls
        enableDamping dampingFactor={0.07}
        minZoom={22} maxZoom={130}
        maxPolarAngle={Math.PI/2.05}
        target={[bounds.cx, 0, bounds.cz]}
      />
    </>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function FloorPlan3D({ data }) {
  return (
    <div style={{
      width:'100%', height:'100%', borderRadius:16, overflow:'hidden',
      border:'1px solid #E2E8F0', position:'relative',
    }}>
      <Canvas shadows camera={{ position:[2,20,9], fov:36 }}>
        <Scene data={data} />
      </Canvas>

      <div style={{
        position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
        background:'rgba(30,41,59,0.7)', backdropFilter:'blur(8px)',
        color:'#CBD5E1', padding:'7px 20px', borderRadius:24,
        fontSize:12, fontWeight:500, letterSpacing:'0.03em',
        border:'1px solid rgba(255,255,255,0.1)',
        pointerEvents:'none', display:'flex', gap:16,
      }}>
        <span>🖱️ 드래그: 회전</span>
        <span>⚲ 스크롤: 줌</span>
        <span>우클릭: 이동</span>
      </div>
    </div>
  );
}
