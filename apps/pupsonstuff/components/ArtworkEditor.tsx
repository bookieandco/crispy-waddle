'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { placementBounds } from '@/lib/product3d/placement';
import type { ArtworkTransform } from '@/types/creative';

interface Props {
  imageUrl: string | null;
  transform: ArtworkTransform;
  onTransformChange: (transform: ArtworkTransform) => void;
  className?: string;
  printAreaAspect?: number;
}

type SnapState = {
  x: 'left' | 'center' | 'right' | null;
  y: 'top' | 'center' | 'bottom' | null;
};

const SNAP_DISTANCE = 0.028;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  printAreaAspect = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    transform: ArtworkTransform;
  } | null>(null);
  const touchRef = useRef<{ x: number; y: number; transform: ArtworkTransform } | null>(null);
  const gestureRef = useRef<{
    startDistance: number;
    startAngle: number;
    transform: ArtworkTransform;
  } | null>(null);
  const [imageAspect, setImageAspect] = useState(1);
  const [selected, setSelected] = useState(false);
  const [snaps, setSnaps] = useState<SnapState>({ x: null, y: null });

  const applyTransform = useCallback(
    (next: ArtworkTransform) => {
      const bounds = placementBounds(next, imageAspect, printAreaAspect);
      const [x, snapX] = snapPosition(next.x, bounds.minX, bounds.maxX);
      const [rawY, rawSnapY] = snapPosition(next.y, bounds.minY, bounds.maxY);
      const snapY = rawSnapY === 'left' ? 'top' : rawSnapY === 'right' ? 'bottom' : rawSnapY;
      setSnaps({ x: snapX, y: snapY });
      onTransformChange({
        ...next,
        x,
        y: rawY,
        scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
        rotation: clamp(next.rotation, -180, 180),
      });
    },
    [onTransformChange, imageAspect, printAreaAspect]
  );

  const applyPosition = useCallback(
    (x: number, y: number) => applyTransform({ ...transform, x, y }),
    [applyTransform, transform]
  );

  useEffect(() => {
    if (!selected) setSnaps({ x: null, y: null });
  }, [selected]);

  const bounds = placementBounds(transform, imageAspect, printAreaAspect);

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
      role="group"
      tabIndex={0}
      aria-label="Artwork placement. Arrow keys move, plus and minus resize, R rotates."
      onFocus={() => setSelected(true)}
      onBlur={() => setSelected(false)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.05 : 0.01;
        const next = { ...transform };
        if (event.key === 'ArrowLeft') next.x -= step;
        else if (event.key === 'ArrowRight') next.x += step;
        else if (event.key === 'ArrowUp') next.y -= step;
        else if (event.key === 'ArrowDown') next.y += step;
        else if (event.key === '+' || event.key === '=') next.scale += 0.05;
        else if (event.key === '-') next.scale -= 0.05;
        else if (event.key.toLowerCase() === 'r') next.rotation += event.shiftKey ? -5 : 5;
        else return;
        event.preventDefault();
        applyTransform(next);
      }}
      style={{ aspectRatio: printAreaAspect }}
      className={`relative touch-none overflow-hidden rounded-xl border border-greige/40 bg-white/30 ${className}`}
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
        touchRef.current = null;
        setSelected(false);
      }}
      onTouchStart={(event) => {
        setSelected(true);
        if (event.touches.length === 1)
          touchRef.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            transform: { ...transform },
          };
        if (event.touches.length === 2) {
          const [a, b] = [event.touches[0], event.touches[1]];
          gestureRef.current = {
            startDistance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
            startAngle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI),
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
            (touchRef.current?.transform.x ?? transform.x) +
              (touch.clientX - (touchRef.current?.x ?? touch.clientX)) / rect.width,
            (touchRef.current?.transform.y ?? transform.y) +
              (touch.clientY - (touchRef.current?.y ?? touch.clientY)) / rect.height
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
      onTouchEnd={(event) => {
        touchRef.current =
          event.touches.length === 1
            ? {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
                transform: { ...transform },
              }
            : null;
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
        className="absolute origin-center"
        style={{
          width: `${bounds.width * 100}%`,
          height: `${bounds.height * 100}%`,
          left: `${transform.x * 100}%`,
          top: `${transform.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Generated pet artwork"
          onLoad={(event) =>
            setImageAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
          }
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
