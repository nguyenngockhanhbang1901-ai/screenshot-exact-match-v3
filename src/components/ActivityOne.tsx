import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, MeshPhysicalMaterial, Quaternion, RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { OrbitControls as Controls } from 'three-stdlib';
import { ArrowLeft, Box, Minus, Plus, RotateCcw } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { getGoalSteelMembers, GOAL_DIMENSIONS, type Point3 } from '@/lib/goal-model';

type ScenePalette = { sky: string; grass: string; grassDark: string; grassLight: string; steel: string; net: string };

function useScenePalette() {
  const [palette, setPalette] = useState<ScenePalette | null>(null);
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    const resolve = (token: string) => {
      context.fillStyle = styles.getPropertyValue(token).trim();
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    };
    setPalette({
      sky: resolve('--goal-sky'), grass: resolve('--goal-grass'),
      grassDark: resolve('--goal-grass-dark'), grassLight: resolve('--goal-grass-light'),
      steel: resolve('--goal-steel'), net: resolve('--goal-net'),
    });
  }, []);
  return palette;
}

function makeGrassTexture(palette: ScenePalette) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = palette.grass;
  context.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 743;
  const next = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 6500; i++) {
    context.fillStyle = next() > 0.52 ? palette.grassLight : palette.grassDark;
    const x = next() * canvas.width;
    const y = next() * canvas.height;
    context.globalAlpha = 0.12 + next() * 0.24;
    context.fillRect(x, y, 1 + next() * 2, 2 + next() * 5);
  }
  context.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = 8;
  return texture;
}

function Grass({ palette }: { palette: ScenePalette }) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    const nextTexture = makeGrassTexture(palette);
    setTexture(nextTexture);
    return () => nextTexture?.dispose();
  }, [palette]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
    <planeGeometry args={[180, 180]} />
    <meshStandardMaterial color={texture ? "#ffffff" : palette.grass} map={texture} roughness={0.96} />
  </mesh>;
}

function SteelMember({ start, end, radius, color }: { start: Point3; end: Point3; radius: number; color: string }) {
  const from = useMemo(() => new Vector3(...start), [start]);
  const to = useMemo(() => new Vector3(...end), [end]);
  const center = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to]);
  const direction = useMemo(() => to.clone().sub(from), [from, to]);
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()), [direction]);
  return <mesh position={center} quaternion={quaternion} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 24, 1]} />
    <meshPhysicalMaterial color={color} metalness={0.22} roughness={0.28} clearcoat={0.45} clearcoatRoughness={0.24} />
  </mesh>;
}

function createNetGeometry() {
  const { width, height, depth, rearHeight, netRadius } = GOAL_DIMENSIONS;
  const half = width / 2 - 0.08;
  const front = depth / 2 - 0.1;
  const back = -depth / 2 + 0.1;
  const bottom = 0.065;
  const frontTop = height - 0.1;
  const rearTop = rearHeight - 0.1;
  const sections: BufferGeometry[] = [];
  const addStrand = (points: Vector3[]) => {
    const curve = new CatmullRomCurve3(points);
    sections.push(new TubeGeometry(curve, 10, netRadius, 4, false));
  };
  const steps = 8;

  for (const side of [-1, 1]) {
    for (let row = 0; row <= 11; row++) {
      const level = row / 11;
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const u = i / steps;
        const y = bottom + level * (frontTop + (rearTop - frontTop) * u - bottom) - 0.055 * Math.sin(Math.PI * u);
        const x = side * (half + 0.045 * Math.sin(Math.PI * u));
        return new Vector3(x, y, front + (back - front) * u);
      });
      addStrand(points);
    }
    for (let column = 0; column <= 10; column++) {
      const u = column / 10;
      const z = front + (back - front) * u;
      const top = frontTop + (rearTop - frontTop) * u;
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const v = i / steps;
        return new Vector3(side * (half + 0.035 * Math.sin(Math.PI * v)), bottom + (top - bottom) * v, z);
      });
      addStrand(points);
    }
  }

  for (let row = 0; row <= 12; row++) {
    const level = row / 12;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      const y = frontTop + (rearTop - frontTop) * u - 0.12 * Math.sin(Math.PI * u);
      return new Vector3(-half + 2 * half * level, y, front + (back - front) * u);
    });
    addStrand(points);
  }
  for (let column = 0; column <= 10; column++) {
    const u = column / 10;
    const z = front + (back - front) * u;
    const top = frontTop + (rearTop - frontTop) * u - 0.12 * Math.sin(Math.PI * u);
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const v = i / steps;
      return new Vector3(-half + 2 * half * v, top - 0.035 * Math.sin(Math.PI * v), z);
    });
    addStrand(points);
  }

  const rearZ = back - 0.025;
  for (let row = 0; row <= 12; row++) {
    const level = row / 12;
    const y = bottom + (rearTop - bottom) * level;
    addStrand(Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      return new Vector3(-half + 2 * half * u, y - 0.035 * Math.sin(Math.PI * u), rearZ - 0.035 * Math.sin(Math.PI * level));
    }));
  }
  for (let column = 0; column <= 18; column++) {
    const x = -half + 2 * half * (column / 18);
    addStrand(Array.from({ length: steps + 1 }, (_, i) => {
      const v = i / steps;
      return new Vector3(x, bottom + (rearTop - bottom) * v, rearZ - 0.035 * Math.sin(Math.PI * v));
    }));
  }

  const merged = mergeGeometries(sections, false) ?? new BufferGeometry();
  sections.forEach((geometry) => geometry.dispose());
  return merged;
}

function Net({ color }: { color: string }) {
  const geometry = useMemo(createNetGeometry, []);
  const material = useMemo(() => new MeshPhysicalMaterial({ color, roughness: 0.82, metalness: 0.02, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }), [color]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} castShadow={false} receiveShadow={false} />;
}

function GoalScene({ palette }: { palette: ScenePalette }) {
  const members = useMemo(getGoalSteelMembers, []);
  return <>
    <color attach="background" args={[palette.sky]} />
    <fog attach="fog" args={[palette.sky, 36, 110]} />
    <hemisphereLight args={[palette.sky, palette.grassDark, 1.15]} />
    <ambientLight intensity={0.42} />
    <directionalLight position={[-7, 12, 8]} intensity={2.25} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-0.00015} />
    <Grass palette={palette} />
    {members.map((member) => <SteelMember key={member.name} start={member.start} end={member.end} radius={member.radius} color={palette.steel} />)}
    <Net color={palette.net} />
  </>;
}

export default function ActivityOne() {
  const palette = useScenePalette();
  const [ready, setReady] = useState(false);
  const controls = useRef<Controls | null>(null);
  const zoom = (factor: number) => {
    const current = controls.current;
    if (!current) return;
    current.object.position.sub(current.target).multiplyScalar(factor).add(current.target);
    current.update();
  };

  return <main className="goal-activity">
    <header className="goal-header">
      <div className="goal-brand"><span className="goal-brand-mark"><Box size={21} /></span><div>Hình học 3D<small>Toán học 11 · Hình học không gian</small></div></div>
      <Link to="/" className="goal-back-link"><ArrowLeft size={16} />Hoạt động 2</Link>
    </header>
    <div className="goal-content">
      <div className="goal-kicker">Hoạt động 1 <span>·</span> Quan sát không gian thực</div>
      <div className="goal-title-row">
        <div><h1>Khung thành bóng đá</h1><p>Mô hình khung thép và lưới trong không gian ba chiều.</p></div>
        <div className="goal-dimensions"><span>KÍCH THƯỚC KHUNG THÀNH 11 NGƯỜI</span><strong>7,32 × 2,44 × 2,20 m</strong></div>
      </div>
      <section className="goal-viewer" aria-label="Mô hình khung thành bóng đá 3D">
        <div className="goal-legend"><span><i className="goal-legend-steel" />Khung thép sơn trắng</span><span><i className="goal-legend-net" />Lưới sợi</span></div>
        {palette && <Canvas data-testid="goal-canvas" shadows dpr={[1, 1.5]} camera={{ position: [8.5, 5.1, 10], fov: 37, near: 0.1, far: 150 }} onCreated={() => setReady(true)}>
          <GoalScene palette={palette} />
          <OrbitControls ref={controls} makeDefault target={[0, 1.12, 0]} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.72} minDistance={5.2} maxDistance={26} minPolarAngle={0} maxPolarAngle={Math.PI} />
        </Canvas>}
        <div className="goal-view-status"><span className="goal-status-dot" />{ready ? 'Mô hình 3D sẵn sàng' : 'Đang dựng mô hình 3D'}</div>
        <div className="goal-controls">
          <Button variant="ghost" size="icon" title="Phóng to" aria-label="Phóng to" onClick={() => zoom(0.82)}><Plus /></Button>
          <Button variant="ghost" size="icon" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoom(1.22)}><Minus /></Button>
          <span className="goal-control-divider" />
          <Button variant="ghost" size="icon" title="Đưa về góc nhìn ban đầu" aria-label="Đưa về góc nhìn ban đầu" onClick={() => controls.current?.reset()}><RotateCcw /></Button>
        </div>
      </section>
      <div className="goal-caption"><span>KHUNG CỐ ĐỊNH · CAMERA QUAN SÁT TỰ DO</span><span>Hai cột dọc <i /> xà ngang <i /> thanh nối sau <i /> lưới</span></div>
    </div>
  </main>;
}