"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ArtworkTransform {
  /** normalized to the product print area: 0..1 */
  x: number;
  /** normalized to the product print area: 0..1 */
  y: number;
  /** relative artwork scale, 1 = natural editor size */
  scale: number;
  /** degrees */
  rotation: number;
}

export interface SnapState {
  x: "left" | "center" | "right" | null;
  y: "top" | "center" | "bottom" | null;
}

interface Props {
  imageUrl: string | null;
  transform: ArtworkTransform;
  onTransformChange: (transform: ArtworkTransform) => void;
  className?: string;
}

const SNAP_DISTANCE = 0.035;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function snap(value: number, targets: Array<[number, SnapState["x"]]>): [number, SnapState["x"]] {
  for (const [target, name] of targets) {
    if (Math.abs(value - target) <= SNAP_DISTANCE) return [target, name];
  }
  return [value, null];
}

export default function ArtworkEditor({
  imageUrl,
  transform,
  onTransformChange,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startDistance: number;
    startAngle: number;
    transform: ArtworkTransform;
  } | null>(null);
  const [selected, setSelected] = useState(false);
  const [snaps, setSnaps] = useState<SnapState>({ x: null, y: null });

  const getPoint = (touch: Touch) => ({ x: touch.clientX, y: touch.clientY });
  const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const angle = (a: Touch, b: Touch) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);

  const applyPosition = useCallback(
    (x: number, y: number) => {
      const [sx, snapX] = snap(x, [
        [0.08, "left"],
        [0.5, "center"],
        [0.92, "right"],
      ]);
      const [sy, snapY] = snap(y, [
        [0.08, "top"],
        [0.5, "center"],
        [0.92, "bottom"],
      ]);
      setSnaps({ x: snapX, y: snapY });
      onTransformChange({ ...transform, x: clamp(sx, 0, 1), y: clamp(sy, 0, 1) });
    },
    [onTransformChange, transform]
  );

  useEffect(() => {
    if (!selected) setSnaps({ x: null, y: null });
  }, [selected]);

  if (!imageUrl) {
    return (
      <div className={`flex aspect-square items-center justify-center rounded-xl border border-greige/40 bg-white/40 ${className}`}>
        <span className="px-6 text-center text-sm text-ink/50">
          Your generated pet design will appear here
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square touch-none overflow-hidden rounded-xl border border-greige/40 bg-white/30 ${className}`}
      onPointerDown={() => setSelected(true)}
      onPointerUp={() => setSelected(false)}
    >
      {snaps.x === "center" && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px bg-bronze/60" />
      )}
      {snaps.y === "center" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px bg-bronze/60" />
      )}

      <div
        className={`absolute left-0 top-0 h-full w-full ${selected ? "ring-1 ring-bronze/50" : ""}`}
        onTouchStart={(event) => {
          if (event.touches.length === 1) {
            const p = getPoint(event.touches[0]);
            gestureRef.current = {
              startX: p.x,
              startY: p.y,
              startDistance: 0,
              startAngle: 0,
              transform: { ...transform },
            };
          } else if (event.touches.length === 2) {
            gestureRef.current = {
              startX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
              startY: (event.touches[0].clientY + event.touches[1].clientY) / 2,
              startDistance: distance(event.touches[0], event.touches[1]),
              startAngle: angle(event.touches[0], event.touches[1]),
              transform: { ...transform },
            };
          }
        }}
        onTouchMove={(event) => {
          const gesture = gestureRef.current;
          const rect = containerRef.current?.getBoundingClientRect();
          if (!gesture || !rect) return;
          event.preventDefault();

          if (event.touches.length === 1) {
            const touch = event.touches[0];
            const dx = (touch.clientX - gesture.startX) / rect.width;
            const dy = (touch.clientY - gesture.startY) / rect.height;
            applyPosition(gesture.transform.x + dx, gesture.transform.y + dy);
          } else if (event.touches.length === 2) {
            const nextDistance = distance(event.touches[0], event.touches[1]);
            const nextAngle = angle(event.touches[0], event.touches[1]);
            const scaleFactor = gesture.startDistance ? nextDistance / gesture.startDistance : 1;
            onTransformChange({
              ...gesture.transform,
              scale: clamp(gesture.transform.scale * scaleFactor, MIN_SCALE, MAX_SCALE),
              rotation: gesture.transform.rotation + (nextAngle - gesture.startAngle),
            });
          }
        }}
        onTouchEnd={() => {
          gestureRef.current = null;
          setTimeout(() => setSnaps({ x: null, y: null }), 350);
        }}
      >
        <div
          className="absolute h-1/2 w-1/2 origin-center"
          style={{
            left: `${transform.x * 100}%`,
            top: `${transform.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
          }}
        >
          <img
            src={imageUrl}
            alt="Generated pet artwork"
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
          {selected && (
            <div className="pointer-events-none absolute inset-0 rounded-md border border-bronze/70" />
          )}
        </div>
      </div>
    </div>
  );
}
