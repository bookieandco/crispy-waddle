'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtworkTransform } from '@/types/creative';

interface Props {
  imageUrl: string | null;
  transform: ArtworkTransform;
  onTransformChange: (transform: ArtworkTransform) => void;
  className?: string;
}

type SnapState = {
  x: 'left' | 'center' | 'right' | null;
  y: 'top' | 'center' | 'bottom' | null;
};

const SNAP_DISTANCE = 0.028;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function rotatedHalfExtent(scale: number, rotation: number): number {
  const radians = (rotation * Math.PI) / 180;
  const squareHalf = 0.25 * scale;
  return Math.min(
    0.5,
    squareHalf * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)))
  );
}

function snapPosition(value: number, min: number, max: number) {
  const candidates: Array<[number, 'left' | 'center' | 'right']> = [
    [min, 'left'],
    [0.5, 'center'],
    [max, 'right'],
  ];
  for (const [target, name] of candidates) {
    if (Math.abs(value - target) <= SNAP_DISTANCE) return [target, name] as const;
  }
  return [clamp(value, min, max), null] as const;
}

export default function ArtworkEditor({
  imageUrl,
  transform,
  onTransformChange,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    transform: ArtworkTransform;
  } | null>(null);
  const gestureRef = useRef<{
    startDistance: number;
    startAngle: number;
    transform: ArtworkTransform;
  } | null>(null);
  const [selected, setSelected] = useState(false);
  const [snaps, setSnaps] = useState<SnapState>({ x: null, y: null });

  const applyTransform = useCallback(
    (next: ArtworkTransform) => {
      const half = rotatedHalfExtent(next.scale, next.rotation);
      const min = Math.min(0.5, half);
      const max = Math.max(0.5, 1 - half);
      const [x, snapX] = snapPosition(next.x, min, max);
      const [rawY, rawSnapY] = snapPosition(next.y, min, max);
      const snapY =
        rawSnapY === 'left' ? 'top' : rawSnapY === 'right' ? 'bottom' : rawSnapY;
      setSnaps({ x: snapX, y: snapY });
      onTransformChange({
        ...next,
        x,
        y: rawY,
        scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
        rotation: clamp(next.rotation, -180, 180),
      });
    },
    [onTransformChange]
  );

  const applyPosition = useCallback(
    (x: number, y: number) => applyTransform({ ...transform, x, y }),
    [applyTransform, transform]
  );

  useEffect(() => {
    if (!selected) setSnaps({ x: null, y: null });
  }, [selected]);

  if (!imageUrl) {
    return (
      <div
        className={`flex aspect-square items-center justify-center rounded-xl border border-greige/40 bg-white/40 ${className}`}
      >
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
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setSelected(true);
        pointerRef.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          transform: { ...transform },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const pointer = pointerRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!pointer || pointer.id !== event.pointerId || !rect) return;
        const dx = (event.clientX - pointer.x) / rect.width;
        const dy = (event.clientY - pointer.y) / rect.height;
        applyPosition(pointer.transform.x + dx, pointer.transform.y + dy);
      }}
      onPointerUp={(event) => {
        if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
        setSelected(false);
      }}
      onPointerCancel={() => {
        pointerRef.current = null;
        gestureRef.current = null;
        setSelected(false);
      }}
      onTouchStart={(event) => {
        setSelected(true);
        if (event.touches.length === 2) {
          const [a, b] = [event.touches[0], event.touches[1]];
          gestureRef.current = {
            startDistance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
            startAngle:
              Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI),
            transform: { ...transform },
          };
        }
      }}
      onTouchMove={(event) => {
        if (event.touches.length === 1) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const touch = event.touches[0];
          applyPosition(
            (touch.clientX - rect.left) / rect.width,
            (touch.clientY - rect.top) / rect.height
          );
          return;
        }
        if (event.touches.length !== 2 || !gestureRef.current) return;
        const [a, b] = [event.touches[0], event.touches[1]];
        const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);
        const gesture = gestureRef.current;
        const scaleFactor = gesture.startDistance ? distance / gesture.startDistance : 1;
        applyTransform({
          ...gesture.transform,
          scale: clamp(gesture.transform.scale * scaleFactor, MIN_SCALE, MAX_SCALE),
          rotation: clamp(gesture.transform.rotation + angle - gesture.startAngle, -180, 180),
        });
      }}
      onTouchEnd={() => {
        gestureRef.current = null;
        setSelected(false);
      }}
    >
      {selected && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 grid-rows-3 opacity-25">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className="border border-bronze/35" />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px bg-bronze/35" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px bg-bronze/35" />
        </>
      )}

      {(snaps.x === 'left' || snaps.x === 'right') && (
        <div
          className="pointer-events-none absolute inset-y-0 z-30 w-[2px] bg-bronze/80"
          style={{ [snaps.x]: 0 }}
        />
      )}
      {snaps.x === 'center' && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[2px] bg-bronze/80" />
      )}
      {(snaps.y === 'top' || snaps.y === 'bottom') && (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 h-[2px] bg-bronze/80"
          style={{ [snaps.y]: 0 }}
        />
      )}
      {snaps.y === 'center' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-[2px] bg-bronze/80" />
      )}

      <div
        className="absolute h-1/2 w-1/2 origin-center"
        style={{
          left: `${transform.x * 100}%`,
          top: `${transform.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Generated pet artwork"
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
        {selected && (
          <div className="pointer-events-none absolute inset-0 rounded-md border-2 border-bronze/75 shadow-[0_0_0_1px_rgba(255,255,255,.65)]" />
        )}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 z-40 rounded bg-white/80 px-2 py-1 text-[10px] text-ink/60 shadow-sm">
        Drag · pinch · rotate · magnetic snap
      </div>
    </div>
  );
}
