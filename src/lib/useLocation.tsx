import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from './api';

interface LocationContextValue {
  locationId: number | null;
  setLocationId: (id: number | null) => void;
  locations: { id: number; address: string | null }[];
  refreshLocations: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue>({
  locationId: null,
  setLocationId: () => {},
  locations: [],
  refreshLocations: async () => {},
});

const STORAGE_KEY = 'rs2:active-location-id';

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationId, setLocationIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });
  const [locations, setLocations] = useState<{ id: number; address: string | null }[]>([]);

  const setLocationId = (id: number | null) => {
    setLocationIdState(id);
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  };

  async function refreshLocations() {
    if (!authApi.isLoggedIn()) return;
    try {
      const { locations } = await authApi.me();
      setLocations(locations);
      if (!locationId && locations[0]) setLocationId(locations[0].id);
    } catch {
      // not logged in or session expired — request() already redirects on 401
    }
  }

  useEffect(() => {
    refreshLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider value={{ locationId, setLocationId, locations, refreshLocations }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useActiveLocation() {
  return useContext(LocationContext);
}
