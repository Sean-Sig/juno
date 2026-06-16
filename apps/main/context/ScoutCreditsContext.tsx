import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { scout, useAuth } from "@juno/api";

type ScoutCreditsContextValue = {
  credits: number | null;
  refreshCredits: () => Promise<void>;
  showSheet: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  setCredits: React.Dispatch<React.SetStateAction<number | null>>;
};

const ScoutCreditsContext = createContext<ScoutCreditsContextValue | null>(null);

export function ScoutCreditsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const refreshCredits = useCallback(async () => {
    if (!session?.token) return;
    try {
      const { data } = await scout.getCredits(session.token);
      setCredits(data.credits);
    } catch {}
  }, [session?.token]);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  return (
    <ScoutCreditsContext.Provider value={{
      credits,
      setCredits,
      refreshCredits,
      showSheet,
      openSheet: () => setShowSheet(true),
      closeSheet: () => setShowSheet(false),
    }}>
      {children}
    </ScoutCreditsContext.Provider>
  );
}

export function useScoutCredits() {
  const ctx = useContext(ScoutCreditsContext);
  if (!ctx) throw new Error("useScoutCredits must be used inside ScoutCreditsProvider");
  return ctx;
}
