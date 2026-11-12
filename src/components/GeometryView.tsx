import { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import type { OrbitControls as Controls, Line2 } from 'three-stdlib';
import { Button } from '@/components/ui/button';
import { Plus, Minus, RotateCcw, Maximize, Play, Pause } from 'lucide-react';
import { animatedLine, advanceMotion, motionIsValid, lineSegment, segmentInsidePlane, splitByVisibility, CAMERA_VIEWS, type CaseIndex, type MotionSpeed, type Segment, type Vec3 } from '@/lib/geometry';
const SLOTS = [0, 1, 2, 3];
function draw(lines: (Line2 | null)[], segments: Segment[], dashed: boolean) {
  lines.forEach((l, i) => { if (!l) return; const s = segments[i]; l.visible = Boolean(s); if (!s) return; l.geometry.setPositions([...s[0], ...s[1]]); if (dashed) l.computeLineDistances(); });
}

type Palette = { plane: string; line: string; foreground: string; border: string };
function Label({ text, position, color }: { text: string; position: [number,number,number]; color: string }) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => { const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.font = 'italic 44px Georgia'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text,64,48); const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; setTexture(map); return () => map.dispose(); }, [text,color]);
  return texture ? <sprite position={position} scale={[0.85,0.425,1]}><spriteMaterial map={texture} transparent depthTest={false} /></sprite> : null;
}
function Scene({ index, playing, speed, resetVersion, palette, controls, onReady }: { index: CaseIndex; playing: boolean; speed: MotionSpeed; resetVersion: number; palette: Palette; controls: React.RefObject<Controls | null>; onReady: () => void }) {
  const phase = useRef(0);
  const solid = useRef<(Line2 | null)[]>([]);
  const dashes = useRef<(Line2 | null)[]>([]);
  const marker = useRef<Group | null>(null);
  const label = useRef<Group | null>(null);
  const marked = useRef(false);
  useEffect(() => { phase.current = 0; }, [index,resetVersion]);
  useFrame((state, delta) => {
    phase.current = advanceMotion(phase.current,delta,playing,speed);
    const { origin, direction } = animatedLine(index,phase.current);
    if (!motionIsValid(index,origin,direction)) throw new Error('Quan hệ đường thẳng và mặt phẳng không hợp lệ');
    const [a, b] = lineSegment(index, origin, direction);
    if (index === 2 && !segmentInsidePlane([a, b])) throw new Error('Đường thẳng d phải nằm trong mặt phẳng (P)');
    const cam: Vec3 = [state.camera.position.x, state.camera.position.y, state.camera.position.z];
    // Recomputed every frame from the live camera, so dashes follow orbiting exactly.
    const parts = splitByVisibility(a, b, cam);
    draw(solid.current, parts.visible, false); draw(dashes.current, parts.hidden, true);
    marker.current?.position.set(...origin);
    label.current?.position.set(b[0] + 0.25, b[1] + 0.2, b[2]);
    if (import.meta.env.DEV) { const element = state.gl.domElement; element.dataset['motionPhase'] = String(phase.current); element.dataset['motionOrigin'] = JSON.stringify(origin); element.dataset['motionDirection'] = JSON.stringify(direction); element.dataset['hiddenParts'] = String(parts.hidden.length); element.dataset['segment'] = JSON.stringify([a, b]); }
    if (!marked.current) { marked.current = true; requestAnimationFrame(onReady); }
  });
  const { camera } = useThree();
  useEffect(() => { const c = controls.current; camera.position.set(...CAMERA_VIEWS[index]); camera.lookAt(0, 0, 0); if (c) { c.target.set(0, 0, 0); c.update(); c.saveState(); } }, [index, camera, controls]);
  return <>
    <ambientLight intensity={1.5} />
    {index === 2 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}><planeGeometry args={[80, 80]} /><meshBasicMaterial color={palette.plane} transparent opacity={0.07} side={2} depthWrite={false} /></mesh>}<mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6.1, 4.5]} /><meshBasicMaterial color={palette.plane} transparent opacity={0.2} side={2} depthWrite={false} /></mesh>
    {Array.from({ length: 9 }, (_, i) => <Line key={`x${i}`} points={[[-3, 0, -2 + i * 0.5], [3, 0, -2 + i * 0.5]]} color={palette.plane} transparent opacity={0.19} lineWidth={0.65} />)}
    {Array.from({ length: 13 }, (_, i) => <Line key={`z${i}`} points={[[-3 + i * 0.5, 0, -2.25], [-3 + i * 0.5, 0, 2.25]]} color={palette.plane} transparent opacity={0.19} lineWidth={0.65} />)}
    <Line points={[[-3,0,-2.25],[3,0,-2.25],[3,0,2.25],[-3,0,2.25],[-3,0,-2.25]]} color={palette.plane} lineWidth={1.1} transparent opacity={0.6} />
    {SLOTS.map(i => <Line key={`s${i}`} ref={(l: Line2 | null) => { solid.current[i] = l; }} points={[[0,0,0],[0,0,0.01]]} color={palette.line} lineWidth={3} renderOrder={2} />)}
    {SLOTS.map(i => <Line key={`h${i}`} ref={(l: Line2 | null) => { dashes.current[i] = l; }} points={[[0,0,0],[0,0,0.01]]} color={palette.line} lineWidth={2} dashed dashSize={0.14} gapSize={0.1} transparent opacity={0.85} />)}
    <group ref={label}><Label text="d" position={[0,0,0]} color={palette.line} /></group>
    <Label text="(P)" position={[-2.3,0,1.7]} color={palette.plane} />
    {index === 0 && <group ref={marker}><mesh><sphereGeometry args={[0.07,16,16]} /><meshBasicMaterial color={palette.foreground} /></mesh><Label text="A" position={[0.35,0.12,0]} color={palette.foreground} /></group>}
    <OrbitControls ref={controls} enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI} />
  </>;
}
export default function GeometryView({ index, compact = false }: { index: CaseIndex; compact?: boolean }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<MotionSpeed>('normal');
  const [resetVersion,setResetVersion] = useState(0);
  useEffect(() => { setPlaying(true); setResetVersion(v => v+1); }, [index]);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ready, setReady] = useState(false);
  const controls = useRef<Controls | null>(null);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    // Three.js cannot parse OKLCH; resolve semantic CSS colors through the browser's sRGB canvas.
    const swatch = document.createElement('canvas').getContext('2d');
    if (!swatch) return;
    const resolve = (token: string) => { swatch.fillStyle = css.getPropertyValue(token).trim(); swatch.fillRect(0,0,1,1); const p = swatch.getImageData(0,0,1,1).data; return `rgb(${p[0]},${p[1]},${p[2]})`; };
    setPalette({ plane: resolve('--plane'), line: resolve('--line'), foreground: resolve('--foreground'), border: resolve('--border') });
  }, []);
  function zoom(factor: number) { const c = controls.current; if (!c) return; c.object.position.sub(c.target).multiplyScalar(factor).add(c.target); c.update(); }
  return <>
    <div ref={wrapper} className={`geometry-view ${compact ? 'compact' : ''}`} data-scene-ready={ready || undefined}>
      <div className="scene-top"><span className="legend"><i />Đường thẳng d</span><span className="legend"><i className="plane" />Mặt phẳng (P)</span><span className="legend">Nét đứt: phần bị che khuất</span></div>
      {palette && <Canvas camera={{ position: CAMERA_VIEWS[index], fov: 40 }} frameloop="always" dpr={[1,1.5]}><Scene index={index} playing={playing} speed={speed} resetVersion={resetVersion} palette={palette} controls={controls} onReady={markReady} /></Canvas>}
      <div className="scene-tools">
        <Button variant="ghost" size="icon" title="Phóng to" aria-label="Phóng to" onClick={() => zoom(0.85)}><Plus /></Button>
        <Button variant="ghost" size="icon" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoom(1.15)}><Minus /></Button>
        <Button variant="ghost" size="icon" title="Góc nhìn ban đầu" aria-label="Góc nhìn ban đầu" onClick={() => { controls.current?.reset(); }}><RotateCcw /></Button>
        {!compact && <Button variant="ghost" size="icon" title="Toàn màn hình" aria-label="Toàn màn hình" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void wrapper.current?.requestFullscreen(); }}><Maximize /></Button>}
      </div>
    </div>
    <div className="motion-row">
      <Button variant="outline" size="icon" title="PLAY · Bắt đầu" aria-label="PLAY" aria-pressed={playing} disabled={playing} onClick={() => setPlaying(true)}><Play /></Button>
      <Button variant="outline" size="icon" title="PAUSE · Tạm dừng" aria-label="PAUSE" aria-pressed={!playing} disabled={!playing} onClick={() => setPlaying(false)}><Pause /></Button>
      <Button variant="outline" size="icon" title="RESET · Vị trí ban đầu" aria-label="RESET" onClick={() => { setResetVersion(v => v+1); setPlaying(false); }}><RotateCcw /></Button>
      <select aria-label="Tốc độ chuyển động" value={speed} onChange={e => setSpeed(e.target.value as MotionSpeed)} className="min-w-0 rounded-md border border-input bg-background p-2 text-xs"><option value="slow">Chậm</option><option value="normal">Bình thường</option><option value="fast">Nhanh</option></select>
    </div>
  </>;
}