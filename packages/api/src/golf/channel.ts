import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { GolfScheduleEntry, GolfTournament } from "./types";

export type GolfDelta = Record<string, unknown>;

export function joinGolfChannel(
  teamId: string,
  handlers: {
    onState: (tournament: GolfTournament) => void;
    onDelta: (diff: GolfDelta) => void;
    onScheduleState: (entries: GolfScheduleEntry[]) => void;
  }
): Channel {
  const socket = getSocket();
  const channel = socket.channel(`sport:golf:${teamId}`, {});

  channel.on("tournament_state", ({ tournaments }) => {
    if (Array.isArray(tournaments)) {
      tournaments.forEach((t) => handlers.onState(t));
    }
  });

  channel.on("golf_delta", (diff: GolfDelta) => {
    handlers.onDelta(diff);
  });

  channel.on("schedule_state", ({ schedule_entries }) => {
    if (Array.isArray(schedule_entries)) {
      handlers.onScheduleState(schedule_entries);
    }
  });

  channel.join();
  return channel;
}
