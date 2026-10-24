'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// No browser-local identity cache: the owner cookie is the authority.

export interface ActivePetIdentity {
  id: string;
  name: string;
}

export interface LatestPetArtwork {
  petIdentityId: string;
  petName: string;
  previewUrl: string;
  creativeOutputId: string;
}

interface PetIdentityContextValue {
  activePet: ActivePetIdentity | null;
  latestArtwork: LatestPetArtwork | null;
  setActivePet: (pet: ActivePetIdentity | null) => void;
  setLatestArtwork: (artwork: LatestPetArtwork | null) => void;
  clearPet: () => void;
}

const PetIdentityContext = createContext<PetIdentityContextValue | null>(null);

export function PetIdentityProvider({ children }: { children: React.ReactNode }) {
  const [activePet, setActivePetState] = useState<ActivePetIdentity | null>(null);
  const [latestArtwork, setLatestArtwork] = useState<LatestPetArtwork | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A pet-id string in localStorage is not proof of ownership when an
    // owner cookie expires or changes. Only the server may restore a pet.
    try { window.localStorage.removeItem('pupsonstuff:active-pet:v1'); } catch {}
    const restore = async () => {
      try {
        const response = await fetch('/api/creative/recent', {
          credentials: 'same-origin', cache:'no-store'
        });
        if (!response.ok) return;
        const data = await response.json() as { artwork?: LatestPetArtwork | null };
        if (cancelled || !data.artwork) return;
        const art = data.artwork;
        setActivePetState(prev => prev ?? {id:art.petIdentityId,name:art.petName});
        setLatestArtwork(prev => prev ?? art);
      } catch {
        // An unavailable creative service must never make the boutique crash.
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  const setActivePet = useCallback((pet: ActivePetIdentity | null) => {
    setActivePetState(pet);
  }, []);

  const clearPet = useCallback(() => {
    setActivePet(null);
    setLatestArtwork(null);
  }, [setActivePet]);

  const value = useMemo(
    () => ({ activePet, latestArtwork, setActivePet, setLatestArtwork, clearPet }),
    [activePet, latestArtwork, setActivePet, clearPet]
  );

  return <PetIdentityContext.Provider value={value}>{children}</PetIdentityContext.Provider>;
}

export function usePetIdentity() {
  const context = useContext(PetIdentityContext);
  if (!context) throw new Error('usePetIdentity must be used inside PetIdentityProvider');
  return context;
}
