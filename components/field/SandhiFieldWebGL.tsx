"use client";

/* eslint-disable react-hooks/immutability -- Three.js requires its typed GPU buffers to be updated in place on each animation frame. */

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  MeshBasicMaterial,
  PointsMaterial,
} from "three";

interface GlyphData {
  points: Array<[number, number]>;
  breaks?: number[];
}

interface FieldColors {
  mist: string;
  lotus: string;
  lamplight: string;
}

interface ParticleSeed {
  side: number;
  startX: number;
  startY: number;
  startZ: number;
  weaveX: number;
  weaveY: number;
  settleX: number;
  settleY: number;
  settleZ: number;
  phase: number;
}

const SESSION_KEY = "sandhi-field-settled";
const MAX_LINE_SEGMENTS = 280;
const JUNCTION_X = 0.3;

function randomGenerator(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function ease(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function useFieldColors(): FieldColors | null {
  const [colors, setColors] = useState<FieldColors | null>(null);

  useEffect(() => {
    const update = () => {
      const next = {
        mist: readToken("--mist"),
        lotus: readToken("--lotus"),
        lamplight: readToken("--lamplight"),
      };
      if (next.mist && next.lotus && next.lamplight) setColors(next);
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return colors;
}

function buildSeeds(count: number): ParticleSeed[] {
  const random = randomGenerator(2671994);
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = (index % 7) - 3;
    return {
      side,
      startX: side * (4.6 + random() * 2.8),
      startY: (random() - 0.5) * 5.1 + lane * 0.035,
      startZ: (random() - 0.5) * 1.1,
      weaveX: side * (0.35 + random() * 1.5),
      weaveY:
        Math.sin(index * 0.29) * (0.3 + random() * 0.7) +
        (random() - 0.5) * 0.35,
      settleX: (random() - 0.5) * 7.4,
      settleY: (random() - 0.5) * 4.4,
      settleZ: (random() - 0.5) * 1.5,
      phase: random() * Math.PI * 2,
    };
  });
}

function setLinePositions(
  particlePositions: Float32Array,
  target: Float32Array,
  count: number,
) {
  const gridSize = 0.58;
  const maxDistanceSquared = 0.18;
  const cells = new Map<string, number[]>();
  let segments = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = particlePositions[offset];
    const y = particlePositions[offset + 1];
    const cellX = Math.floor(x / gridSize);
    const cellY = Math.floor(y / gridSize);

    for (let xStep = -1; xStep <= 1; xStep += 1) {
      for (let yStep = -1; yStep <= 1; yStep += 1) {
        const neighbours = cells.get(`${cellX + xStep}:${cellY + yStep}`);
        if (!neighbours) continue;
        for (const other of neighbours) {
          const otherOffset = other * 3;
          const deltaX = x - particlePositions[otherOffset];
          const deltaY = y - particlePositions[otherOffset + 1];
          if (
            deltaX * deltaX + deltaY * deltaY > maxDistanceSquared ||
            segments >= MAX_LINE_SEGMENTS
          ) {
            continue;
          }
          const lineOffset = segments * 6;
          target[lineOffset] = x;
          target[lineOffset + 1] = y;
          target[lineOffset + 2] = particlePositions[offset + 2];
          target[lineOffset + 3] = particlePositions[otherOffset];
          target[lineOffset + 4] = particlePositions[otherOffset + 1];
          target[lineOffset + 5] = particlePositions[otherOffset + 2];
          segments += 1;
        }
      }
    }

    const key = `${cellX}:${cellY}`;
    const cell = cells.get(key);
    if (cell) cell.push(index);
    else cells.set(key, [index]);
  }

  return segments;
}

function FieldScene({
  colors,
  count,
  glyphBreaks,
  glyphPoints,
  settledVisit,
}: {
  colors: FieldColors;
  count: number;
  glyphBreaks: number[];
  glyphPoints: Array<[number, number]>;
  settledVisit: boolean;
}) {
  const positionAttribute = useRef<BufferAttribute>(null);
  const lineGeometry = useRef<BufferGeometry>(null);
  const lineAttribute = useRef<BufferAttribute>(null);
  const glyphGeometry = useRef<BufferGeometry>(null);
  const glyphAttribute = useRef<BufferAttribute>(null);
  const pointsMaterial = useRef<PointsMaterial>(null);
  const lineMaterial = useRef<LineBasicMaterial>(null);
  const glyphMaterial = useRef<LineBasicMaterial>(null);
  const centerMaterial = useRef<MeshBasicMaterial>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const elapsedTime = useRef(settledVisit ? 4 : 0);
  const sessionRecorded = useRef(settledVisit);
  const ripple = useRef<{ x: number; y: number; startedAt: number } | null>(
    null,
  );
  const seeds = useMemo(() => buildSeeds(count), [count]);
  const particlePositions = useMemo(() => new Float32Array(count * 3), [count]);
  const linePositions = useMemo(
    () => new Float32Array(MAX_LINE_SEGMENTS * 6),
    [],
  );
  const glyphLinePositions = useMemo(
    () => new Float32Array(Math.max(1, glyphPoints.length - 1) * 6),
    [glyphPoints.length],
  );
  const glyphBreakMap = useMemo(() => {
    const map = new Uint8Array(glyphPoints.length);
    for (const start of glyphBreaks) {
      if (start > 0 && start < map.length) map[start] = 1;
    }
    return map;
  }, [glyphBreaks, glyphPoints.length]);

  useEffect(() => {
    positionAttribute.current?.setUsage(DynamicDrawUsage);
    lineAttribute.current?.setUsage(DynamicDrawUsage);
    glyphAttribute.current?.setUsage(DynamicDrawUsage);
  }, []);

  useFrame((state, delta) => {
    // R3F stops calling this frame when the hero is outside the viewport or the
    // document is hidden. Capping the first resumed delta makes that a real
    // pause instead of jumping directly to the end of the ceremony.
    elapsedTime.current += Math.min(delta, 0.05);
    const elapsed = elapsedTime.current;
    const enter = ease(elapsed / 1.2);
    const converge = ease((elapsed - 1.2) / 1.2);
    const glyph = ease((elapsed - 2.4) / 0.8);
    const dissolve = ease((elapsed - 3.2) / 0.8);
    const pointerX = state.pointer.x * (state.viewport.width / 2);
    const pointerY = state.pointer.y * (state.viewport.height / 2);
    const pointerRadius =
      (140 / Math.max(1, state.size.height)) * state.viewport.height;
    const rippleState = ripple.current;
    const rippleAge = rippleState ? elapsed - rippleState.startedAt : 10;
    const glyphCount = Math.min(glyphPoints.length, count);

    for (let index = 0; index < count; index += 1) {
      const seed = seeds[index];
      const nearX = seed.side * (1.7 + (index % 11) * 0.045);
      const nearY = seed.startY * 0.72;
      let x = mix(seed.startX, nearX, enter);
      let y = mix(seed.startY, nearY, enter);
      let z = mix(seed.startZ, seed.settleZ * 0.35, enter);

      if (elapsed >= 1.2) {
        x = mix(x, seed.weaveX, converge);
        y = mix(y, seed.weaveY, converge);
      }

      if (elapsed >= 2.4 && index < glyphCount) {
        const point = glyphPoints[index];
        x = mix(x, point[0] * 3.25 + JUNCTION_X, glyph);
        y = mix(y, point[1] * 3.25, glyph);
        z = mix(z, 0, glyph);
      }

      if (elapsed >= 3.2) {
        x = mix(x, seed.settleX, dissolve);
        y = mix(y, seed.settleY, dissolve);
        z = mix(z, seed.settleZ, dissolve);
      }

      if (elapsed >= 4) {
        const breath = Math.sin(elapsed * 0.34 + seed.phase) * 0.035;
        x += breath * seed.side;
        y += breath * 0.7;
      }

      const pointerDeltaX = x - pointerX;
      const pointerDeltaY = y - pointerY;
      const pointerDistance = Math.hypot(pointerDeltaX, pointerDeltaY);
      if (pointerDistance < pointerRadius && pointerDistance > 0.001) {
        const push = (1 - pointerDistance / pointerRadius) * 0.24;
        x += (pointerDeltaX / pointerDistance) * push;
        y += (pointerDeltaY / pointerDistance) * push;
      }

      if (rippleState && rippleAge < 2.4) {
        const deltaX = x - rippleState.x;
        const deltaY = y - rippleState.y;
        const distanceFromTap = Math.hypot(deltaX, deltaY);
        const wave = rippleAge * 2.2;
        const influence = Math.max(
          0,
          1 - Math.abs(distanceFromTap - wave) / 0.5,
        );
        if (distanceFromTap > 0.001) {
          x += (deltaX / distanceFromTap) * influence * 0.12;
          y += (deltaY / distanceFromTap) * influence * 0.12;
        }
      }

      const offset = index * 3;
      particlePositions[offset] = x;
      particlePositions[offset + 1] = y;
      particlePositions[offset + 2] = z;
    }

    if (rippleState && rippleAge >= 2.4) ripple.current = null;

    const segmentCount = setLinePositions(
      particlePositions,
      linePositions,
      Math.min(count, 720),
    );
    lineGeometry.current?.setDrawRange(0, segmentCount * 2);

    if (glyphPoints.length > 1) {
      let segment = 0;
      for (let index = 1; index < glyphCount; index += 1) {
        if (glyphBreakMap[index]) continue;
        const previous = (index - 1) * 3;
        const current = index * 3;
        const offset = segment * 6;
        glyphLinePositions[offset] = particlePositions[previous];
        glyphLinePositions[offset + 1] = particlePositions[previous + 1];
        glyphLinePositions[offset + 2] = particlePositions[previous + 2];
        glyphLinePositions[offset + 3] = particlePositions[current];
        glyphLinePositions[offset + 4] = particlePositions[current + 1];
        glyphLinePositions[offset + 5] = particlePositions[current + 2];
        segment += 1;
      }
      glyphGeometry.current?.setDrawRange(0, segment * 2);
    }

    if (positionAttribute.current) positionAttribute.current.needsUpdate = true;
    if (lineAttribute.current) lineAttribute.current.needsUpdate = true;
    if (glyphAttribute.current) glyphAttribute.current.needsUpdate = true;
    if (pointsMaterial.current) {
      pointsMaterial.current.opacity =
        elapsed < 1.2 ? 0.12 + enter * 0.35 : 0.47;
    }
    if (lineMaterial.current) {
      lineMaterial.current.opacity = elapsed < 1.2 ? 0.04 : 0.14;
    }
    if (glyphMaterial.current) {
      glyphMaterial.current.opacity = glyph * (1 - dissolve) * 0.42;
    }
    const nodeProgress = ease((elapsed - 2.4) / 0.8);
    if (centerMaterial.current) {
      centerMaterial.current.opacity = nodeProgress * 0.9;
    }
    if (ringMaterial.current) {
      ringMaterial.current.opacity = nodeProgress * 0.28;
    }

    if (!sessionRecorded.current && elapsed >= 4) {
      try {
        sessionStorage.setItem(SESSION_KEY, "true");
        sessionRecorded.current = true;
      } catch {
        // The animation remains functional when storage is unavailable.
      }
    }
  });

  return (
    <group
      onPointerDown={(event) => {
        if (event.nativeEvent.pointerType !== "touch") return;
        ripple.current = {
          x: event.point.x,
          y: event.point.y,
          startedAt: elapsedTime.current,
        };
      }}
    >
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[20, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={positionAttribute}
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMaterial}
          color={new Color(colors.mist)}
          size={0.022}
          sizeAttenuation
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </points>
      <lineSegments>
        <bufferGeometry ref={lineGeometry}>
          <bufferAttribute
            ref={lineAttribute}
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMaterial}
          color={new Color(colors.lotus)}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments visible={!settledVisit}>
        <bufferGeometry ref={glyphGeometry}>
          <bufferAttribute
            ref={glyphAttribute}
            attach="attributes-position"
            args={[glyphLinePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={glyphMaterial}
          color={new Color(colors.lamplight)}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </lineSegments>
      <mesh position={[JUNCTION_X, 0, 0.05]}>
        <circleGeometry args={[0.045, 24]} />
        <meshBasicMaterial
          ref={centerMaterial}
          color={new Color(colors.lamplight)}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[JUNCTION_X, 0, 0.04]}>
        <ringGeometry args={[0.075, 0.085, 32]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={new Color(colors.lamplight)}
          transparent
          opacity={0.28}
        />
      </mesh>
    </group>
  );
}

export function SandhiFieldWebGL({ active }: { active: boolean }) {
  const colors = useFieldColors();
  const [glyphBreaks, setGlyphBreaks] = useState<number[]>([]);
  const [glyphPoints, setGlyphPoints] = useState<Array<[number, number]>>([]);
  const [documentVisible, setDocumentVisible] = useState(
    () => !document.hidden,
  );
  const count =
    typeof window !== "undefined" && window.innerWidth < 720 ? 600 : 1500;
  const settledVisit = useMemo(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/field/sandhi-points.json", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: GlyphData | null) => {
        if (!data?.points) return;
        const step = Math.max(1, Math.ceil(data.points.length / count));
        const sourceBreaks = data.breaks ?? [0];
        const nextPoints: Array<[number, number]> = [];
        const nextBreaks: number[] = [];

        for (
          let pathIndex = 0;
          pathIndex < sourceBreaks.length;
          pathIndex += 1
        ) {
          const start = sourceBreaks[pathIndex];
          const end = sourceBreaks[pathIndex + 1] ?? data.points.length;
          nextBreaks.push(nextPoints.length);
          for (let index = start; index < end; index += step) {
            const point = data.points[index];
            if (point) nextPoints.push(point);
          }
          const finalPoint = data.points[end - 1];
          if (finalPoint && nextPoints.at(-1) !== finalPoint) {
            nextPoints.push(finalPoint);
          }
        }

        setGlyphBreaks(nextBreaks);
        setGlyphPoints(nextPoints);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [count]);

  useEffect(() => {
    const sync = () => setDocumentVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  if (!colors) return null;

  return (
    <div
      className="sandhi-field-webgl"
      data-particle-count={count}
      data-sequence={settledVisit ? "settled" : "intro"}
      data-rendering={active && documentVisible ? "active" : "paused"}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 52 }}
        dpr={[1, 1.75]}
        frameloop={active && documentVisible ? "always" : "never"}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
      >
        <FieldScene
          colors={colors}
          count={count}
          glyphBreaks={glyphBreaks}
          glyphPoints={glyphPoints}
          settledVisit={settledVisit}
        />
      </Canvas>
    </div>
  );
}
