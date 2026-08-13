"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "pupsonstuff:music";
const BASE_VOLUME = 0.12; // V2 spec: 12%
const DUCKED_VOLUME = BASE_VOLUME * 0.3;
const FADE_MS = 3000; // V2 spec: fade in over 3 seconds

interface StoredPrefs {
  /** true only if the user explicitly turned music off */
  userDisabled: boolean;
  volume: number;
}

interface MusicContextValue {
  enabled: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
  /** Call with `true` when something should duck the music, `false` when it's done. */
  duck: (active: boolean) => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

function readPrefs(): StoredPrefs {
  if (typeof window === "undefined")
    return { userDisabled: false, volume: BASE_VOLUME };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userDisabled: false, volume: BASE_VOLUME };
    const parsed = JSON.parse(raw);
    return {
      userDisabled: !!parsed.userDisabled,
      volume: typeof parsed.volume === "number" ? parsed.volume : BASE_VOLUME,
    };
  } catch {
    return { userDisabled: false, volume: BASE_VOLUME };
  }
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckCountRef = useRef(0);
  const fadeFrameRef = useRef<number | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [userDisabled, setUserDisabled] = useState(false);
  const [volume, setVolumeState] = useState(BASE_VOLUME);
  const [ducked, setDucked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount (client-only, avoids SSR mismatch)
  useEffect(() => {
    const prefs = readPrefs();
    setUserDisabled(prefs.userDisabled);
    setVolumeState(prefs.volume);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userDisabled, volume })
    );
  }, [userDisabled, volume, hydrated]);

  // "Autoplay after first interaction": browsers won't allow real
  // autoplay-on-load with sound, so this listens for the very first
  // click/tap/keypress anywhere on the page and starts music then —
  // the visitor never has to find and click the music button specifically,
  // but nothing ever plays before they've touched the page at all.
  useEffect(() => {
    if (!hydrated || userDisabled) return;

    const start = () => setEnabled(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", start, opts);
    window.addEventListener("keydown", start, opts);

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [hydrated, userDisabled]);

  // Smoothly animate the audio element's actual volume toward the target
  // (base volume, or ducked volume, or 0 if paused) over FADE_MS.
  const fadeTo = useCallback((target: number, durationMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);

    const start = audio.volume;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // audio.volume's setter throws if the value is even a hair outside
      // [0,1] — found live during Milestone 6 testing (real pageerrors:
      // "The volume provided (1.00856) is outside the range [0, 1]"), from
      // ordinary float accumulation in this interpolation, not a logic bug
      // in the fade itself. Clamping the assignment is the fix; the eased
      // trajectory this produces is unchanged.
      audio.volume = Math.min(1, Math.max(0, start + (target - start) * t));
      if (t < 1) {
        fadeFrameRef.current = requestAnimationFrame(step);
      }
    };
    fadeFrameRef.current = requestAnimationFrame(step);
  }, []);

  // React to enabled/volume/ducked changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hydrated) return;

    if (enabled) {
      if (audio.paused) {
        audio.volume = 0;
        audio.play().catch(() => {
          // Autoplay can still be blocked until a user gesture; the toggle
          // button click itself counts as one, so this mainly guards
          // against browsers being extra strict.
        });
      }
      fadeTo(ducked ? DUCKED_VOLUME : volume, FADE_MS);
    } else {
      fadeTo(0, FADE_MS / 2);
      const audioEl = audio;
      const t = setTimeout(() => {
        if (!enabled) audioEl.pause();
      }, FADE_MS / 2 + 50);
      return () => clearTimeout(t);
    }
  }, [enabled, volume, ducked, hydrated, fadeTo]);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      setUserDisabled(!next);
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const duck = useCallback((active: boolean) => {
    duckCountRef.current += active ? 1 : -1;
    if (duckCountRef.current < 0) duckCountRef.current = 0;
    setDucked(duckCountRef.current > 0);
  }, []);

  return (
    <MusicContext.Provider value={{ enabled, volume, toggle, setVolume, duck }}>
      <audio ref={audioRef} src="/music/boutique-theme.mp3" loop preload="none" />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return ctx;
}
