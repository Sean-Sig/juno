import React, { createContext, useContext, useState } from "react";
import type { TennisPlayer } from "@juno/api";

type ScoutLineupContextValue = {
  pendingPlayer: TennisPlayer | null;
  queuePlayer: (player: TennisPlayer) => void;
  clearPending: () => void;
};

const ScoutLineupContext = createContext<ScoutLineupContextValue | null>(null);

export function ScoutLineupProvider({ children }: { children: React.ReactNode }) {
  const [pendingPlayer, setPendingPlayer] = useState<TennisPlayer | null>(null);

  return (
    <ScoutLineupContext.Provider
      value={{
        pendingPlayer,
        queuePlayer: (player) => setPendingPlayer(player),
        clearPending: () => setPendingPlayer(null),
      }}
    >
      {children}
    </ScoutLineupContext.Provider>
  );
}

export function useScoutLineup() {
  const ctx = useContext(ScoutLineupContext);
  if (!ctx) throw new Error("useScoutLineup must be used within ScoutLineupProvider");
  return ctx;
}
