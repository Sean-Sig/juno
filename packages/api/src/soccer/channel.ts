import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { SoccerGame } from "./types";

export function joinSoccerGamesChannel(handlers: {
  onState: (games: SoccerGame[]) => void;
  onDelta: (games: SoccerGame[]) => void;
}): Channel {
  const socket = getSocket();
  const channel = socket.channel("sport:soccer:games", {});

  channel.on("soccer_state", ({ games }: { games: SoccerGame[] }) => {
    handlers.onState(games);
  });

  channel.on("soccer_delta", ({ games }: { games: SoccerGame[] }) => {
    handlers.onDelta(games);
  });

  channel.join();
  return channel;
}
