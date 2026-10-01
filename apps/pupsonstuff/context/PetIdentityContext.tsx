'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pupsonstuff:active-pet:v1';

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
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ActivePetIdentity;
      if (parsed?.id && parsed?.name) setActivePetState(parsed);
    } catch {
      // Reusable Pet Identity is a convenience layer; a corrupt browser
      // cache must never block the shopper from uploading again.
    }
  }, []);

  const setActivePet = useCallback((pet: ActivePetIdentity | null) => {
    setActivePetState(pet);
    try {
      if (pet) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pet));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Continue in-memory when browser storage is unavailable.
    }
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
