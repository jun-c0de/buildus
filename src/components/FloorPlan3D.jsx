import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_CONFIG, OPEN_PLAN_GROUPS, ROOM_FLOOR_COLOR } from '../data/roomConfig';

const SCALE  = 10;
const WALL_H = 2.5;

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
  // 8px 허용 오차 (SAM2 폴리곤 좌표 정밀도 보정 → 끊긴 벽 방지)
  const r = ([x, y]) => `${Math.round(x * 8) / 8},${Math.round(y * 8) / 8}`;
  const k1 = r(p1), k2 = r(p2);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}
function calcBounds(rooms, W, H) {
  if (!rooms.length) return { minX:-5, maxX:5, minZ:-5, maxZ:5, cx:0, cz:0, w:10, d:10 };
  const allPts = rooms.flatMap(r => normalize(r.poly, W, H));
  const minX = Math.min(...allPts.map(p => p[0]));
  const maxX = Math.max(...allPts.map(p => p[0]));
  const minZ = Math.min(...allPts.map(p => p[1]));
  const maxZ = Math.max(...allPts.map(p => p[1]));
  return { minX, maxX, minZ, maxZ, cx:(minX+maxX)/2, cz:(minZ+maxZ)/2, w:maxX-minX, d:maxZ-minZ };
}

// ── 텍스처 ───────────────────────────────────────────────────────
function makeWoodTexture(color) {
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
  const base = dark?'#CCCAC6':'#EAEAE8', tile=dark?'#D4D2CE':'#F0F0EE', line=dark?'#B0AEAD':'#D0CECC';
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
  const cz3 = (room.cy / H - 0.5) * SCALE;
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
  const floorColor = ROOM_FLOOR_COLOR[room.name] || '#D8CEC4';
  // 2D 텍스처와 동일하게 맞춤
  const isWood     = ['공간_침실','공간_드레스룸','공간_다목적공간'].includes(room.name);
  const isTile     = ['공간_화장실','공간_욕실'].includes(room.name);
  const isDarkTile = room.name === '공간_발코니';

  const tex = useMemo(() => {
    if (isWood)     return makeWoodTexture(floorColor);
    if (isTile)     return makeTileTexture(false);
    if (isDarkTile) return makeTileTexture(true);
    return null;
  }, [room.name]);

  const geo = useMemo(() => {
    const pts = normalize(room.poly, W, H);
    if (pts.length < 3) return null;
    return new THREE.ShapeGeometry(makeShape(pts));
  }, [room.poly, W, H]);

  const cx3 = (room.cx / W - 0.5) * SCALE;
  const cz3 = (room.cy / H - 0.5) * SCALE;
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
        fontSize={0.19} color="#2A2A2A" fontWeight="bold"
        anchorX="center" anchorY="middle"
        outlineWidth={0.014} outlineColor="rgba(255,255,255,0.85)"
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

function WallSeg({ p1, p2, isExterior }) {
  const dx = p2[0]-p1[0], dz = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx+dz*dz);
  if (len < 0.04) return null;
  const cx = (p1[0]+p2[0])/2, cz = (p1[1]+p2[1])/2;
  const angle = Math.atan2(dz, dx);
  const thick = isExterior ? 0.15 : 0.08;
  const h     = isExterior ? WALL_H : WALL_H*0.94;
  return (
    <mesh position={[cx, h/2, cz]} rotation={[0,-angle,0]} castShadow receiveShadow>
      <boxGeometry args={[len, h, thick]} />
      <meshStandardMaterial color={isExterior ? '#E8E6E2' : '#F2F0EE'} roughness={0.55} />
    </mesh>
  );
}

// ── 씬 ───────────────────────────────────────────────────────────
function Scene({ data }) {
  const { imgWidth:W, imgHeight:H, walls, windows, rooms } = data;
  const bounds = useMemo(() => calcBounds(rooms, W, H), [rooms, W, H]);

  // 오픈플랜 그룹 맵 (roomName → groupIndex)
  const openPlanMap = useMemo(() => {
    const m = {};
    OPEN_PLAN_GROUPS.forEach((names, gi) => names.forEach(n => (m[n] = gi)));
    return m;
  }, []);

  const wallSegs = useMemo(() => {
    const counts={}, segs={}, edgeRooms={};
    for (const room of rooms) {
      const pts = normalize(room.poly, W, H);
      for (let i=0; i<pts.length; i++) {
        const p1=pts[i], p2=pts[(i+1)%pts.length];
        const k=edgeKey(p1,p2);
        counts[k]=(counts[k]||0)+1;
        segs[k]={p1,p2};
        if (!edgeRooms[k]) edgeRooms[k]=[];
        edgeRooms[k].push(room.name);
      }
    }
    return Object.entries(segs)
      .filter(([k]) => {
        if (counts[k] === 1) return true;
        const names = edgeRooms[k] ?? [];
        const isOpenPlan = OPEN_PLAN_GROUPS.some(g => names.every(n => g.includes(n)));
        return !isOpenPlan;
      })
      .map(([k,{p1,p2}])=>({p1,p2,isExterior:counts[k]===1}));
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

      <color attach="background" args={['#F2F0EC']} />

      {/* 조명 — iso3d 스타일 (강한 방향광 + 부드러운 앰비언트) */}
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[bounds.cx+10, 24, bounds.cz+6]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-22}  shadow-camera-right={22}
        shadow-camera-top={22}    shadow-camera-bottom={-22}
      />
      <directionalLight position={[bounds.cx-8, 12, bounds.cz-6]} intensity={0.28} color="#DDE8F8" />
      <hemisphereLight skyColor="#D8EAF8" groundColor="#EDE8E0" intensity={0.38} />

      {/* 배경 바닥 — 아파트 외곽 형태 */}
      {outerPoly ? (
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]} receiveShadow>
          <shapeGeometry args={[makeShape(outerPoly)]} />
          <meshStandardMaterial color="#EDE9E3" roughness={0.94} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI/2,0,0]} position={[bounds.cx,-0.01,bounds.cz]} receiveShadow>
          <planeGeometry args={[bounds.w+2.5, bounds.d+2.5]} />
          <meshStandardMaterial color="#EDE9E3" roughness={0.94} />
        </mesh>
      )}

      {/* 방 바닥 */}
      {rooms.map((r,i) => <Room key={i} room={r} W={W} H={H} />)}

      {/* 가구 */}
      {rooms.map((r,i) => <RoomFurniture key={i} room={r} W={W} H={H} />)}

      {/* 창호 */}
      {windows.map((poly,i) => <Window3D key={i} poly={poly} W={W} H={H} />)}

      {/* 벽체 — 항상 wallSegs 사용 (오픈플랜 내부벽 필터링 적용) */}
      {wallSegs.map(({p1,p2,isExterior},i) => (
        <WallSeg key={i} p1={p1} p2={p2} isExterior={isExterior} />
      ))}

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
