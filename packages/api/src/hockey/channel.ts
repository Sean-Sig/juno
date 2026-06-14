import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { HockeyGame } from "./types";

export function joinHockeyGamesChannel(handlers: {
  onState: (games: HockeyGame[]) => void;
  onDelta: (games: HockeyGame[]) => void;
}): Channel {
  const socket = getSocket();
  const channel = socket.channel("sport:hockey:games", {});

  channel.on("hockey_state", ({ games }: { games: HockeyGame[] }) => {
    handlers.onState(games);
  });

  channel.on("hockey_delta", ({ games }: { games: HockeyGame[] }) => {
    handlers.onDelta(games);
  });

  channel.join();
  return channel;
}
