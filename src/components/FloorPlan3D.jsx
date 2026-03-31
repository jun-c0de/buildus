import { useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_CONFIG } from '../data/roomConfig';

const SCALE  = 10;
const WALL_H = 1.8;

const FLOOR_COLORS = {
  공간_거실:       '#D4A96A',
  공간_침실:       '#C8A060',
  공간_드레스룸:   '#C4A060',
  공간_다목적공간: '#C8A862',
  공간_화장실:     '#E8E6E2',
  공간_욕실:       '#E4E2DE',
  공간_주방:       '#ECECEA',
  공간_현관:       '#B8B0A4',
  공간_발코니:     '#A8C4A0',
  공간_실외기실:   '#C8CDD2',
  공간_기타:       '#D8D8D8',
};

// ── 좌표 정규화 ──────────────────────────────────────────────────
function normalize(poly, W, H) {
  return poly.map(([x, y]) => [(x / W - 0.5) * SCALE, (y / H - 0.5) * SCALE]);
}

function makeShape(pts) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

// ── 엣지 키 (중복 제거용) ────────────────────────────────────────
function edgeKey(p1, p2) {
  const r = ([x, y]) => `${Math.round(x * 20) / 20},${Math.round(y * 20) / 20}`;
  const k1 = r(p1), k2 = r(p2);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

// ── 방 범위 계산 ────────────────────────────────────────────────
function calcBounds(rooms, W, H) {
  if (!rooms.length) return { minX: -5, maxX: 5, minZ: -5, maxZ: 5, cx: 0, cz: 0, w: 10, d: 10 };
  const allPts = rooms.flatMap(r => normalize(r.poly, W, H));
  const minX = Math.min(...allPts.map(p => p[0]));
  const maxX = Math.max(...allPts.map(p => p[0]));
  const minZ = Math.min(...allPts.map(p => p[1]));
  const maxZ = Math.max(...allPts.map(p => p[1]));
  return {
    minX, maxX, minZ, maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w:  maxX - minX,
    d:  maxZ - minZ,
  };
}

// ── 컴포넌트 ────────────────────────────────────────────────────
function Wall({ poly, W, H }) {
  const geo = useMemo(() => {
    const pts = normalize(poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ExtrudeGeometry(makeShape(pts), { depth: WALL_H, bevelEnabled: false });
  }, [poly, W, H]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#E8E8E6" roughness={0.6} />
    </mesh>
  );
}

function Window3D({ poly, W, H }) {
  const geo = useMemo(() => {
    const pts = normalize(poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ExtrudeGeometry(makeShape(pts), { depth: WALL_H * 0.6, bevelEnabled: false });
  }, [poly, W, H]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, WALL_H * 0.2, 0]}>
      <meshStandardMaterial color="#B8D8F0" transparent opacity={0.35} />
    </mesh>
  );
}

function makeWoodTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);
  const plankH = 42;
  for (let y = 0; y < 512; y += plankH) {
    // 판자 경계선 (진하게)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, y, 512, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, y + 2, 512, 1);
    // 나뭇결
    for (let i = 0; i < 6; i++) {
      const gy = y + 5 + Math.random() * (plankH - 10);
      const style = Math.random() < 0.5
        ? `rgba(0,0,0,${(Math.random() * 0.07 + 0.03).toFixed(2)})`
        : `rgba(255,255,255,${(Math.random() * 0.07 + 0.02).toFixed(2)})`;
      ctx.strokeStyle = style;
      ctx.lineWidth = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        128, gy + (Math.random() - 0.5) * 5,
        384, gy + (Math.random() - 0.5) * 5,
        512, gy + (Math.random() - 0.5) * 3
      );
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function makeTileTexture(dark = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = dark ? '#CCCAC6' : '#EAEAE8';
  const tile = dark ? '#D4D2CE' : '#F0F0EE';
  const line = dark ? '#B0AEAD' : '#D0CECC';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const sz = 60, gap = 4;
  for (let row = 0; row * (sz + gap) < 256; row++) {
    for (let col = 0; col * (sz + gap) < 256; col++) {
      const x = col * (sz + gap) + gap / 2;
      const y = row * (sz + gap) + gap / 2;
      ctx.fillStyle = tile;
      ctx.fillRect(x, y, sz, sz);
      ctx.strokeStyle = line;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, sz, sz);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function Room({ room, W, H }) {
  const floorColor = FLOOR_COLORS[room.name] || '#D8CEC4';
  const isWood = ['공간_거실','공간_침실','공간_드레스룸','공간_다목적공간'].includes(room.name);
  const isTile = ['공간_화장실','공간_욕실','공간_주방'].includes(room.name);
  const isDarkTile = room.name === '공간_발코니';

  const tex = useMemo(() => {
    if (isWood) return makeWoodTexture(floorColor);
    if (isTile) return makeTileTexture(false);
    if (isDarkTile) return makeTileTexture(true);
    return null;
  }, [room.name]);

  const geo = useMemo(() => {
    const pts = normalize(room.poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ShapeGeometry(makeShape(pts));
  }, [room.poly, W, H]);

  const cx = (room.cx / W - 0.5) * SCALE;
  const cy = (room.cy / H - 0.5) * SCALE;
  const cfg = ROOM_CONFIG[room.name] || { label: room.name };
  const label = room.displayName ?? cfg.label ?? room.name;

  if (!geo) return null;
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <meshStandardMaterial color={floorColor} map={tex ?? null}
          roughness={isWood ? 0.72 : isDarkTile ? 0.55 : 0.38} metalness={isWood ? 0 : 0.04} />
      </mesh>
      <Text position={[cx, 0.02, cy]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22} color="#2D2D2D" fontWeight="bold"
        anchorX="center" anchorY="middle"
        outlineWidth={0.015} outlineColor="rgba(255,255,255,0.8)">
        {label}
      </Text>
    </group>
  );
}

// 벽 세그먼트: 외벽(1번만 등장) vs 내벽(2번 등장) 두께 구분
function WallSeg({ p1, p2, isExterior }) {
  const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
  const len = Math.sqrt(dx*dx + dz*dz);
  if (len < 0.04) return null;
  const cx = (p1[0]+p2[0])/2, cz = (p1[1]+p2[1])/2;
  const angle = Math.atan2(dz, dx);
  const thick = isExterior ? 0.14 : 0.07;
  const h     = isExterior ? WALL_H : WALL_H * 0.95;
  return (
    <mesh position={[cx, h/2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, h, thick]} />
      <meshStandardMaterial color={isExterior ? '#EEECEA' : '#F4F2F0'} roughness={0.6} metalness={0} />
    </mesh>
  );
}

function Scene({ data }) {
  const { imgWidth: W, imgHeight: H, walls, windows, rooms } = data;

  // 실제 방 범위 계산
  const bounds = useMemo(() => calcBounds(rooms, W, H), [rooms, W, H]);

  // 벽 세그먼트: 중복 제거 + 외벽/내벽 구분
  const wallSegs = useMemo(() => {
    if (walls.length > 0) return [];   // str JSON에 벽 있으면 그쪽 사용
    const counts = {};
    const segs   = {};
    for (const room of rooms) {
      const pts = normalize(room.poly, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i], p2 = pts[(i+1) % pts.length];
        const k  = edgeKey(p1, p2);
        counts[k] = (counts[k] || 0) + 1;
        segs[k]   = { p1, p2 };
      }
    }
    return Object.entries(segs).map(([k, { p1, p2 }]) => ({
      p1, p2, isExterior: counts[k] === 1,
    }));
  }, [walls, rooms, W, H]);

  return (
    <>
      <color attach="background" args={['#F2F1EE']} />
      <fog attach="fog" args={['#F2F1EE', 28, 60]} />

      {/* 조명 — 밝고 클린한 건축 스타일 */}
      <ambientLight intensity={0.95} />
      <directionalLight
        position={[5, 22, 8]} intensity={1.05} castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5} shadow-camera-far={60}
        shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={16}  shadow-camera-bottom={-16}
      />
      <directionalLight position={[-5, 10, -6]} intensity={0.3} color="#EEF4FF" />
      <hemisphereLight skyColor="#D8EAF8" groundColor="#EDE8E0" intensity={0.5} />

      {/* 배경 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[bounds.cx, -0.01, bounds.cz]} receiveShadow>
        <planeGeometry args={[bounds.w + 2, bounds.d + 2]} />
        <meshStandardMaterial color="#F0EDE8" roughness={0.92} />
      </mesh>

      {/* 방 바닥 */}
      {rooms.map((r, i) => <Room key={i} room={r} W={W} H={H} />)}

      {/* 창호 */}
      {windows.map((poly, i) => <Window3D key={i} poly={poly} W={W} H={H} />)}

      {/* 벽체: str JSON 우선, 없으면 자동 생성 (중복 제거) */}
      {walls.length > 0
        ? walls.map((poly, i) => <Wall key={i} poly={poly} W={W} H={H} />)
        : wallSegs.map(({ p1, p2, isExterior }, i) => (
            <WallSeg key={i} p1={p1} p2={p2} isExterior={isExterior} />
          ))
      }

      <OrbitControls enableDamping dampingFactor={0.07}
        minDistance={3} maxDistance={26}
        maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} />
    </>
  );
}

export default function FloorPlan3D({ data }) {
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden',
      border: '1px solid #E2E8F0', position: 'relative',
    }}>
      <Canvas shadows camera={{ position: [2, 20, 9], fov: 36 }}>
        <Scene data={data} />
      </Canvas>

      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(8px)',
        color: '#CBD5E1', padding: '7px 20px', borderRadius: 24,
        fontSize: 12, fontWeight: 500, letterSpacing: '0.03em',
        border: '1px solid rgba(255,255,255,0.1)',
        pointerEvents: 'none', display: 'flex', gap: 16,
      }}>
        <span>🖱️ 드래그: 회전</span>
        <span>⚲ 스크롤: 줌</span>
        <span>우클릭: 이동</span>
      </div>
    </div>
  );
}
