import { Channel } from "phoenix";
import { getSocket } from "../socket/socket";
import type { TennisMatch, MatchScoreDelta, MatchComment } from "./types";

export function joinTennisMatchChannel(
  matchId: string,
  handlers: {
    onState: (match: TennisMatch) => void;
    onDelta: (diff: MatchScoreDelta) => void;
    onComment: (comment: MatchComment) => void;
  }
): Channel {
  const socket = getSocket();
  const channel = socket.channel(`tennis_match:${matchId}`, {});

  channel.on("match_state", (match: TennisMatch) => {
    handlers.onState(match);
  });

  channel.on("tennis_score_delta", (diff: MatchScoreDelta) => {
    handlers.onDelta(diff);
  });

  channel.on("tennis_comment", (comment: MatchComment) => {
    handlers.onComment(comment);
  });

  channel.join();
  return channel;
}
