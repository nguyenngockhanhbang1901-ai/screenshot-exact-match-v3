import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BufferGeometry, CatmullRomCurve3, DoubleSide, MeshPhysicalMaterial, Quaternion, TubeGeometry, Vector3 } from 'three';
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

function Grass({ palette }: { palette: ScenePalette }) {
  // Plain, uniform turf: no texture or stripes that could be mistaken for geometric lines.
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
    <circleGeometry args={[90, 96]} />
    <meshStandardMaterial color={palette.grass} roughness={1} metalness={0} />
  </mesh>;
}

function SteelMember({ start, end, radius, color }: { start: Point3; end: Point3; radius: number; color: string }) {
  const from = useMemo(() => new Vector3(...start), [start]);
  const to = useMemo(() => new Vector3(...end), [end]);
  const center = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to]);
  const direction = useMemo(() => to.clone().sub(from), [from, to]);
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()), [direction]);
  return <mesh position={center} quaternion={quaternion} >
    <cylinderGeometry args={[radius, radius, direction.length(), 24, 1]} />
    <meshPhysicalMaterial color={color} metalness={0.1} roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.2} />
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
    for (let row = 0; row <= 7; row++) {
      const level = row / 7;
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const u = i / steps;
        const y = bottom + level * (frontTop + (rearTop - frontTop) * u - bottom) - 0.055 * Math.sin(Math.PI * u);
        const x = side * (half + 0.045 * Math.sin(Math.PI * u));
        return new Vector3(x, y, front + (back - front) * u);
      });
      addStrand(points);
    }
    for (let column = 0; column <= 6; column++) {
      const u = column / 6;
      const z = front + (back - front) * u;
      const top = frontTop + (rearTop - frontTop) * u;
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const v = i / steps;
        return new Vector3(side * (half + 0.035 * Math.sin(Math.PI * v)), bottom + (top - bottom) * v, z);
      });
      addStrand(points);
    }
  }

  for (let row = 0; row <= 20; row++) {
    const level = row / 20;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      const y = frontTop + (rearTop - frontTop) * u - 0.12 * Math.sin(Math.PI * u);
      return new Vector3(-half + 2 * half * level, y, front + (back - front) * u);
    });
    addStrand(points);
  }
  for (let column = 0; column <= 6; column++) {
    const u = column / 6;
    const z = front + (back - front) * u;
    const top = frontTop + (rearTop - frontTop) * u - 0.12 * Math.sin(Math.PI * u);
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const v = i / steps;
      return new Vector3(-half + 2 * half * v, top - 0.035 * Math.sin(Math.PI * v), z);
    });
    addStrand(points);
  }

  const rearZ = back - 0.025;
  for (let row = 0; row <= 7; row++) {
    const level = row / 7;
    const y = bottom + (rearTop - bottom) * level;
    addStrand(Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      return new Vector3(-half + 2 * half * u, y - 0.035 * Math.sin(Math.PI * u), rearZ - 0.035 * Math.sin(Math.PI * level));
    }));
  }
  for (let column = 0; column <= 20; column++) {
    const x = -half + 2 * half * (column / 20);
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
  const material = useMemo(() => new MeshPhysicalMaterial({ color, roughness: 0.7, metalness: 0, side: DoubleSide }), [color]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} />;
}

function GoalScene({ palette }: { palette: ScenePalette }) {
  const members = useMemo(getGoalSteelMembers, []);
  return <>
    <color attach="background" args={[palette.sky]} />
    <fog attach="fog" args={[palette.sky, 36, 110]} />
    {/* Soft, even, shadow-free lighting: depth comes from perspective, not cast shadows. */}
    <hemisphereLight args={[palette.sky, palette.grass, 1.6]} />
    <ambientLight intensity={0.75} />
    <directionalLight position={[-6, 10, 8]} intensity={0.9} />
    <directionalLight position={[8, 6, -6]} intensity={0.45} />
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
        {palette && <Canvas data-testid="goal-canvas" dpr={[1, 1.5]} camera={{ position: [5.4, 1.1, 6.6], fov: 44, near: 0.1, far: 150 }} onCreated={() => setReady(true)}>
          <GoalScene palette={palette} />
          <OrbitControls ref={controls} makeDefault target={[0, 1.5, 0]} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.72} minDistance={4.2} maxDistance={26} minPolarAngle={0} maxPolarAngle={Math.PI} />
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