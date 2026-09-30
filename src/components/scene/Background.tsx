"use client";

/* eslint-disable react-hooks/immutability, react-hooks/purity --
   react-three-fiber's frame loop mutates GPU-bound objects (uniforms, materials,
   transforms) in place every frame by design; seeding particles uses Math.random once. */

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fieldFragment, fieldVertex, particlesFragment, particlesVertex } from "./shaders";
import { pointer, scrollState } from "@/lib/pointer";
import { calmMotion, usePref } from "@/lib/prefs";
import { moodLive } from "@/lib/mood-live";

/** Slower field and particles under OS reduced-motion or the Calm motion switch. */
const tempo = () => (calmMotion() ? 0.15 : 1);

const setSrgb = (c: THREE.Color, v: { r: number; g: number; b: number }) => c.setRGB(v.r, v.g, v.b, THREE.SRGBColorSpace);

function Field() {
  const { size } = useThree();
  const mouse = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  const target = useMemo(() => new THREE.Vector2(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0.5 },
      uVel: { value: 0 },
      uScroll: { value: 0 },
      uFocus: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uC: { value: new THREE.Color() },
    }),
    [],
  );

  useFrame((_, dt) => {
    const u = uniforms;
    u.uTime.value += Math.min(dt, 0.05) * (0.35 + moodLive.energy * 1.6) * tempo();
    u.uEnergy.value = moodLive.energy;
    u.uVel.value += (pointer.speed - u.uVel.value) * 0.12;
    u.uScroll.value = scrollState.y / Math.max(1, window.innerHeight);
    u.uFocus.value = moodLive.focus;
    u.uRes.value.set(size.width, size.height);
    mouse.lerp(target.set(pointer.u, 1 - pointer.v), 0.08);
    u.uMouse.value.copy(mouse);
    setSrgb(u.uA.value, moodLive.a);
    setSrgb(u.uB.value, moodLive.b);
    setSrgb(u.uC.value, moodLive.c);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={fieldVertex}
        fragmentShader={fieldFragment}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function Particles({ count }: { count: number }) {
  const { size, viewport } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 2] = -9 + Math.random() * 11;
      seed[i] = Math.random();
      scale[i] = Math.pow(Math.random(), 2.2);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVel: { value: 0 },
      uPixelRatio: { value: 1 },
      uScroll: { value: 0 },
      uFocus: { value: 0 },
      uSize: { value: 9 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color() },
    }),
    [],
  );

  useFrame((_, dt) => {
    const u = uniforms;
    u.uTime.value += Math.min(dt, 0.05) * (0.25 + moodLive.energy * 1.9) * tempo();
    u.uVel.value += (pointer.speed - u.uVel.value) * 0.15;
    u.uPixelRatio.value = viewport.dpr;
    u.uScroll.value = scrollState.y / Math.max(1, window.innerHeight);
    u.uFocus.value = moodLive.focus;
    u.uAspect.value = size.width / size.height;
    u.uMouse.value.set(pointer.u * 2 - 1, -(pointer.v * 2 - 1));
    setSrgb(u.uColor.value, moodLive.accent);
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={particlesVertex}
        fragmentShader={particlesFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Armillary rings — an instrument dial that tilts toward the cursor and becomes the focus clock. */
function Rings() {
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const { objects, materials } = useMemo(() => {
    const materials: THREE.LineBasicMaterial[] = [];
    const objects: THREE.Object3D[] = [];
    const ring = (r: number, segments = 256, opacity = 0.16) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const m = new THREE.LineBasicMaterial({ transparent: true, opacity, depthWrite: false });
      m.userData.base = opacity;
      materials.push(m);
      return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
    };
    const ticks = (r: number, n: number, len: number, opacity = 0.22) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const l = i % 6 === 0 ? len * 2.2 : len;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
        pts.push(new THREE.Vector3(Math.cos(a) * (r - l), Math.sin(a) * (r - l), 0));
      }
      const m = new THREE.LineBasicMaterial({ transparent: true, opacity, depthWrite: false });
      m.userData.base = opacity;
      materials.push(m);
      return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m);
    };
    const a = new THREE.Group();
    a.add(ring(2.6, 256, 0.22), ticks(2.6, 120, 0.06, 0.3));
    const b = new THREE.Group();
    b.add(ring(3.25, 256, 0.12));
    b.rotation.set(1.1, 0.3, 0);
    const c = new THREE.Group();
    c.add(ring(3.9, 256, 0.08), ticks(3.9, 36, 0.1, 0.14));
    c.rotation.set(0.4, 1.2, 0);
    objects.push(a, b, c);
    return { objects, materials };
  }, []);

  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const f = moodLive.focus;
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.05));
    const wide = viewport.aspect > 1;
    const tx = THREE.MathUtils.lerp(wide ? viewport.width * 0.2 : 0.4, 0, f);
    const ty = THREE.MathUtils.lerp(wide ? 0.35 : 1.6, 0, f);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    const s = THREE.MathUtils.lerp(wide ? 1 : 0.7, 0.92, f);
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
    // tilt toward the cursor with inertia
    const rx = -(pointer.v - 0.5) * 0.5 * (1 - f);
    const ry = (pointer.u - 0.5) * 0.7 * (1 - f);
    g.rotation.x += (rx - g.rotation.x) * k * 0.6;
    g.rotation.y += (ry - g.rotation.y) * k * 0.6;
    const t = state.clock.elapsedTime * (0.05 + moodLive.energy * 0.12);
    objects[0].rotation.z = t;
    objects[1].rotation.x = THREE.MathUtils.lerp(1.1 + Math.sin(t) * 0.2, 0, f);
    objects[1].rotation.z = -t * 0.7;
    objects[2].rotation.y = THREE.MathUtils.lerp(1.2 + t * 0.5, 0, f);
    objects[2].rotation.z = t * 0.3;
    const fade = Math.max(0, 1 - scrollState.y / (window.innerHeight * 0.9));
    const vis = Math.max(fade, f);
    color.setRGB(moodLive.accent.r, moodLive.accent.g, moodLive.accent.b, THREE.SRGBColorSpace);
    for (const m of materials) {
      m.opacity = m.userData.base * vis * (1 + f * 0.8);
      m.color.copy(color);
    }
    g.visible = vis > 0.01;
  });

  return (
    <group ref={group}>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}

function CameraRig() {
  useFrame(({ camera }, dt) => {
    const k = 1 - Math.pow(0.1, Math.min(dt, 0.05));
    camera.position.x += ((pointer.u - 0.5) * 0.6 - camera.position.x) * k;
    camera.position.y += (-(pointer.v - 0.5) * 0.35 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function Background() {
  const field = usePref("field");
  const particles = usePref("particles");
  const rings = usePref("rings");
  const count = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 900 : 2400;
  // with every layer switched off there is no reason to keep a GPU context alive
  if (!field && !particles && !rings) return <div className="pointer-events-none fixed inset-0 z-0 bg-[var(--void)]" aria-hidden />;
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 7], fov: 45 }}
        onCreated={({ gl }) => gl.setClearColor("#050506")}
      >
        {field && <Field />}
        {particles && <Particles count={count} />}
        {rings && <Rings />}
        <CameraRig />
      </Canvas>
    </div>
  );
}
