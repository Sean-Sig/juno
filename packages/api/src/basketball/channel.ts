import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { BasketballGame } from "./types";

export function joinBasketballGamesChannel(handlers: {
  onState: (games: BasketballGame[]) => void;
  onDelta: (games: BasketballGame[]) => void;
}): Channel {
  const socket = getSocket();
  const channel = socket.channel("sport:basketball:games", {});

  channel.on("basketball_state", ({ games }: { games: BasketballGame[] }) => {
    handlers.onState(games);
  });

  channel.on("basketball_delta", ({ games }: { games: BasketballGame[] }) => {
    handlers.onDelta(games);
  });

  channel.join();
  return channel;
}
