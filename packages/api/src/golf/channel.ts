import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { GolfTournament } from "./types";

export type GolfDelta = Record<string, unknown>;

export function joinGolfChannel(
  teamId: string,
  handlers: {
    onState: (tournament: GolfTournament) => void;
    onDelta: (diff: GolfDelta) => void;
  }
): Channel {
  const socket = getSocket();
  const channel = socket.channel(`sport:golf:${teamId}`, {});

  channel.on("tournament_state", ({ tournaments }) => {
    if (tournaments?.[0]) handlers.onState(tournaments[0]);
  });

  channel.on("golf_delta", (diff: GolfDelta) => {
    handlers.onDelta(diff);
  });

  channel.join();
  return channel;
}
