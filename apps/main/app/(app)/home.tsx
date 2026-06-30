import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  basketball,
  hockey,
  football,
  soccer,
  golf,
  tennis,
  useAuth,
  useSport,
  type BasketballGame,
  type BasketballTeam,
  type BasketballPlayer,
  type HockeyGame,
  type HockeyTeam,
  type HockeyPlayer,
  type FootballGame,
  type FootballTeam,
  type FootballPlayer,
  type SoccerGame,
  type SoccerTeam,
  type SoccerPlayer,
  type GolfPlayer,
  type TennisPlayer,
} from "@juno/api";
import { useTheme, spacing, radius, typography, countryFlag, type Palette } from "@juno/ui";
import { useFollowedTeams } from "../../context/FollowedTeamsContext";
import { useFollowedPlayersAll } from "../../context/FollowedPlayersContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TeamSport = "basketball" | "hockey" | "football" | "soccer";
type HomeSport = TeamSport | "golf" | "tennis";
type AnyGame = BasketballGame | HockeyGame | FootballGame | SoccerGame;
type AnyTeam = BasketballTeam | HockeyTeam | FootballTeam | SoccerTeam;
type AnyPlayer = BasketballPlayer | HockeyPlayer | FootballPlayer | SoccerPlayer | GolfPlayer | TennisPlayer;

type SectionData = {
  sport: HomeSport;
  emoji: string;
  label: string;
  playersOnly: boolean;          // golf/tennis: skip games & teams, show players only
  todayGames: AnyGame[];
  recentGames: AnyGame[];        // recent finished games for followed teams (off-season)
  suggestedTeams: AnyTeam[];     // unfollowed teams in the same sport
  followedPlayers: AnyPlayer[];
  suggestedPlayers: AnyPlayer[]; // unfollowed players, e.g. top performers
};

const SPORT_META: Record<HomeSport, { emoji: string; label: string }> = {
  basketball: { emoji: "🏀", label: "Basketball" },
  hockey:     { emoji: "🏒", label: "Hockey" },
  football:   { emoji: "🏈", label: "Football" },
  soccer:     { emoji: "⚽", label: "Soccer" },
  golf:       { emoji: "⛳", label: "Golf" },
  tennis:     { emoji: "🎾", label: "Tennis" },
};

// Per-sport primary colors (mirrors packages/ui/src/theme.ts palettes) so
// follow buttons on the home feed always reflect the section's sport,
// not whichever sport is globally active in the tab navigator.
const SPORT_COLOR: Record<HomeSport, { light: string; dark: string }> = {
  golf:       { light: "#009778", dark: "#009778" },
  tennis:     { light: "#689F38", dark: "#C6D930" },
  basketball: { light: "#C1440E", dark: "#F97316" },
  hockey:     { light: "#003F87", dark: "#38BDF8" },
  football:   { light: "#B71C1C", dark: "#EF5350" },
  soccer:     { light: "#1B7A3D", dark: "#34D058" },
};

function sportColor(sport: HomeSport, mode: "light" | "dark"): string {
  return SPORT_COLOR[sport][mode];
}

// ---------------------------------------------------------------------------
// API shims — unified call shape for all 4 team sports
// ---------------------------------------------------------------------------
function getGames(sport: TeamSport, params: Record<string, string>) {
  switch (sport) {
    case "basketball": return basketball.getGames(params);
    case "hockey":     return hockey.getGames(params);
    case "football":   return football.getGames(params);
    case "soccer":     return soccer.getGames(params);
  }
}

function getTeams(sport: TeamSport, params?: Record<string, string>) {
  switch (sport) {
    case "basketball": return basketball.getTeams(params);
    case "hockey":     return hockey.getTeams(params);
    case "football":   return football.getTeams(params);
    case "soccer":     return soccer.getTeams(params);
  }
}

function getPlayer(sport: HomeSport, id: string) {
  switch (sport) {
    case "basketball": return basketball.getPlayer(id);
    case "hockey":     return hockey.getPlayer(id);
    case "football":   return football.getPlayer(id);
    case "soccer":     return soccer.getPlayer(id);
    case "golf":       return golf.getPlayer(id);
    case "tennis":     return tennis.getPlayer(id);
  }
}

function getPlayers(sport: HomeSport, params: Record<string, string>) {
  switch (sport) {
    case "basketball": return basketball.getPlayers(params);
    case "hockey":     return hockey.getPlayers(params);
    case "football":   return football.getPlayers(params);
    case "soccer":     return soccer.getPlayers(params);
    case "golf":       return golf.getPlayers(params);
    case "tennis":     return tennis.getPlayers(params);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function teamHasFollowedTeam(game: AnyGame, followedIds: string[]): boolean {
  const ht = (game as any).home_team?.id;
  const at = (game as any).away_team?.id;
  return (ht && followedIds.includes(ht)) || (at && followedIds.includes(at));
}

function playerTeamIsLive(player: AnyPlayer, todayGames: AnyGame[]): boolean {
  const teamId = (player as any).team_id;
  if (!teamId) return false;
  return todayGames.some((g) => {
    if (g.status !== "live") return false;
    const ht = (g as any).home_team?.id;
    const at = (g as any).away_team?.id;
    return ht === teamId || at === teamId;
  });
}

function gameTime(game: AnyGame): string {
  if (game.status === "live") return "LIVE";
  if (!game.scheduled_at) return "";
  return new Date(game.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function gameDate(game: AnyGame): string {
  if (!game.scheduled_at) return "";
  const d = new Date(game.scheduled_at);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Mini game card
// ---------------------------------------------------------------------------
function HomeFeedGameCard({
  game,
  sport,
  onPress,
}: {
  game: AnyGame;
  sport: TeamSport;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFollowed, follow, unfollow } = useFollowedTeams();

  const away = (game as any).away_team;
  const home = (game as any).home_team;
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const awayFollowed = away?.id ? isFollowed(sport, away.id) : false;
  const homeFollowed = home?.id ? isFollowed(sport, home.id) : false;
  const eitherFollowed = awayFollowed || homeFollowed;
  const awayWins = isFinished && (game.away_score ?? 0) > (game.home_score ?? 0);
  const homeWins = isFinished && (game.home_score ?? 0) > (game.away_score ?? 0);
  const awayFlag = sport === "soccer" ? countryFlag(away?.name) : null;
  const homeFlag = sport === "soccer" ? countryFlag(home?.name) : null;

  return (
    <TouchableOpacity
      style={[styles.gameCard, eitherFollowed && styles.gameCardFollowed]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {eitherFollowed && <View style={styles.followedStrip} />}

      <View style={styles.gameCardTop}>
        {isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        ) : (
          <Text style={styles.gameCardTime}>
            {isFinished ? "Final" : `${gameDate(game)} · ${gameTime(game)}`}
          </Text>
        )}
      </View>

      <View style={styles.gameCardTeamRow}>
        {awayFlag ? (
          <Text style={styles.teamFlag}>{awayFlag}</Text>
        ) : away?.logo ? (
          <Image source={{ uri: away.logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
        ) : (
          <Text style={[styles.teamAbbrev, isFinished && !awayWins && styles.teamMuted]}>
            {away?.abbreviation ?? away?.name?.slice(0, 3).toUpperCase() ?? "TBD"}
          </Text>
        )}
        <Text style={[styles.gameCardTeamName, awayFollowed && styles.gameCardTeamNameFollowed, isFinished && !awayWins && styles.teamMuted]} numberOfLines={1}>
          {away?.name ?? "TBD"}
        </Text>
        {(isLive || isFinished) && game.away_score != null ? (
          <Text style={[styles.gameCardScore, awayWins && styles.gameCardScoreWinner]}>{game.away_score}</Text>
        ) : null}
        <TouchableOpacity
          onPress={() => away?.id && (awayFollowed ? unfollow(sport, away.id) : follow(sport, away.id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={awayFollowed ? "checkmark-circle" : "add-circle-outline"} size={26} color={sportColor(sport, mode)} />
        </TouchableOpacity>
      </View>

      <View style={styles.gameCardDivider} />

      <View style={styles.gameCardTeamRow}>
        {homeFlag ? (
          <Text style={styles.teamFlag}>{homeFlag}</Text>
        ) : home?.logo ? (
          <Image source={{ uri: home.logo }} style={styles.teamLogo} cachePolicy="memory-disk" contentFit="contain" />
        ) : (
          <Text style={[styles.teamAbbrev, isFinished && !homeWins && styles.teamMuted]}>
            {home?.abbreviation ?? home?.name?.slice(0, 3).toUpperCase() ?? "TBD"}
          </Text>
        )}
        <Text style={[styles.gameCardTeamName, homeFollowed && styles.gameCardTeamNameFollowed, isFinished && !homeWins && styles.teamMuted]} numberOfLines={1}>
          {home?.name ?? "TBD"}
        </Text>
        {(isLive || isFinished) && game.home_score != null ? (
          <Text style={[styles.gameCardScore, homeWins && styles.gameCardScoreWinner]}>{game.home_score}</Text>
        ) : null}
        <TouchableOpacity
          onPress={() => home?.id && (homeFollowed ? unfollow(sport, home.id) : follow(sport, home.id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={homeFollowed ? "checkmark-circle" : "add-circle-outline"} size={26} color={sportColor(sport, mode)} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Suggested team chip
// ---------------------------------------------------------------------------
function SuggestedTeamChip({
  team,
  sport,
}: {
  team: AnyTeam;
  sport: TeamSport;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFollowed, follow, unfollow } = useFollowedTeams();

  const t = team as any;
  const followed = isFollowed(sport, t.id);

  return (
    <View style={styles.teamChip}>
      {t.logo ? (
        <Image source={{ uri: t.logo }} style={styles.teamChipLogo} cachePolicy="memory-disk" contentFit="contain" />
      ) : sport === "soccer" && countryFlag(t.name) ? (
        <Text style={styles.teamChipFlagEmoji}>{countryFlag(t.name)}</Text>
      ) : (
        <View style={styles.teamChipLogoPlaceholder}>
          <Text style={styles.teamChipAbbrev}>
            {t.abbreviation ?? t.name?.slice(0, 3).toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <Text style={styles.teamChipName} numberOfLines={1}>{t.short_name ?? t.name}</Text>
      {t.league ? <Text style={styles.teamChipLeague} numberOfLines={1}>{t.league}</Text> : null}
      <TouchableOpacity
        onPress={() => followed ? unfollow(sport, t.id) : follow(sport, t.id)}
        style={styles.teamChipFollowBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name={followed ? "checkmark-circle" : "add-circle-outline"}
          size={26}
          color={sportColor(sport, mode)}
        />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Followed player avatar
// ---------------------------------------------------------------------------
function PlayerAvatar({
  player,
  sport,
  live,
  onPress,
}: {
  player: AnyPlayer;
  sport: HomeSport;
  live: boolean;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFollowed, follow, unfollow } = useFollowedPlayersAll();
  const p = player as any;
  const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
  const followed = isFollowed(sport, p.id);

  return (
    <TouchableOpacity style={styles.playerAvatarWrap} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.playerAvatarPhotoWrap}>
        <View style={[styles.playerAvatarRing, live && styles.playerAvatarRingLive]}>
          {p.photo ? (
            <Image source={{ uri: p.photo }} style={styles.playerAvatarImage} cachePolicy="memory-disk" contentFit="cover" />
          ) : (
            <View style={styles.playerAvatarPlaceholder}>
              <Text style={styles.playerAvatarInitials}>{initials || "?"}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => followed ? unfollow(sport, p.id) : follow(sport, p.id)}
          style={styles.suggestedPlayerFollowBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <View style={styles.suggestedPlayerFollowBtnBg}>
            <Ionicons
              name={followed ? "checkmark-circle" : "add-circle-outline"}
              size={22}
              color={sportColor(sport, mode)}
            />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.playerAvatarName} numberOfLines={1}>{p.display_name ?? p.last_name}</Text>
      {live && <Text style={styles.playerAvatarLive}>Playing</Text>}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Suggested player card — photo with a follow button overlaid bottom-right
// ---------------------------------------------------------------------------
function SuggestedPlayerCard({
  player,
  sport,
  onPress,
}: {
  player: AnyPlayer;
  sport: HomeSport;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isFollowed, follow, unfollow } = useFollowedPlayersAll();
  const p = player as any;
  const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
  const followed = isFollowed(sport, p.id);

  return (
    <TouchableOpacity style={styles.suggestedPlayerCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.suggestedPlayerPhotoWrap}>
        {p.photo ? (
          <Image source={{ uri: p.photo }} style={styles.suggestedPlayerPhoto} cachePolicy="memory-disk" contentFit="cover" />
        ) : (
          <View style={styles.suggestedPlayerPhotoPlaceholder}>
            <Text style={styles.playerAvatarInitials}>{initials || "?"}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => followed ? unfollow(sport, p.id) : follow(sport, p.id)}
          style={styles.suggestedPlayerFollowBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <View style={styles.suggestedPlayerFollowBtnBg}>
            <Ionicons
              name={followed ? "checkmark-circle" : "add-circle-outline"}
              size={22}
              color={sportColor(sport, mode)}
            />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.teamChipName} numberOfLines={1}>{p.display_name ?? p.last_name}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Sport section
// ---------------------------------------------------------------------------
function SportSection({
  section,
  onGamePress,
}: {
  section: SectionData;
  onGamePress: (gameId: string, sport: HomeSport) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { followedIds } = useFollowedTeams();
  const { setActiveSport } = useSport();

  const seeAllLabel =
    section.sport === "golf" ? "All tournaments" :
    section.sport === "tennis" ? "All matches" :
    "All games";

  const seeAllDest =
    section.sport === "golf" ? "/(app)/tournaments" :
    section.sport === "tennis" ? "/(app)/matches" :
    "/(app)/games";

  function handleSeeAll() {
    setActiveSport(section.sport as any);
    router.push(seeAllDest as any);
  }

  const myGames = section.todayGames.filter((g) =>
    teamHasFollowedTeam(g, (followedIds[section.sport as TeamSport] ?? []))
  );
  const otherGames = section.todayGames.filter(
    (g) => !teamHasFollowedTeam(g, (followedIds[section.sport as TeamSport] ?? []))
  );
  const hasToday = section.todayGames.length > 0;
  const hasRecent = section.recentGames.length > 0;
  const hasSuggestions = section.suggestedTeams.length > 0;
  const hasPlayers = section.followedPlayers.length > 0;
  const hasSuggestedPlayers = section.suggestedPlayers.length > 0;

  if (!hasToday && !hasRecent && !hasSuggestions && !hasPlayers && !hasSuggestedPlayers) return null;

  return (
    <View style={styles.sportSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sportEmoji}>{section.emoji}</Text>
          <Text style={styles.sportLabel}>{section.label}</Text>
        </View>
        <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>{seeAllLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Today / live — your teams first */}
      {hasToday && myGames.length > 0 && (
        <>
          <Text style={styles.subLabel}>Your teams</Text>
          <FlatList
            data={myGames}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <HomeFeedGameCard game={item} sport={section.sport as TeamSport} onPress={() => onGamePress(item.id, section.sport)} />
            )}
          />
        </>
      )}
      {hasToday && otherGames.length > 0 && (
        <>
          <Text style={styles.subLabel}>{myGames.length > 0 ? "More games" : "Today's games"}</Text>
          <FlatList
            data={otherGames}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <HomeFeedGameCard game={item} sport={section.sport as TeamSport} onPress={() => onGamePress(item.id, section.sport)} />
            )}
          />
        </>
      )}

      {/* Off-season: recent results for followed teams */}
      {!hasToday && hasRecent && (
        <>
          <Text style={styles.subLabel}>Recent results</Text>
          <FlatList
            data={section.recentGames}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <HomeFeedGameCard game={item} sport={section.sport as TeamSport} onPress={() => onGamePress(item.id, section.sport)} />
            )}
          />
        </>
      )}

      {/* Your followed players */}
      {hasPlayers && (
        <>
          <Text style={styles.subLabel}>Your players</Text>
          <FlatList
            data={section.followedPlayers}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => (p as any).id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <PlayerAvatar
                player={item}
                sport={section.sport}
                live={playerTeamIsLive(item, section.todayGames)}
                onPress={() => router.push(`/(app)/player/${(item as any).id}?sport=${section.sport}`)}
              />
            )}
          />
        </>
      )}

      {/* Suggested teams to follow */}
      {hasSuggestions && (
        <>
          <Text style={styles.subLabel}>
            {(followedIds[section.sport as TeamSport] ?? []).length > 0 ? "More teams" : "Teams to follow"}
          </Text>
          <FlatList
            data={section.suggestedTeams}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(t) => (t as any).id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <SuggestedTeamChip team={item} sport={section.sport as TeamSport} />
            )}
          />
        </>
      )}

      {/* Suggested players to follow */}
      {hasSuggestedPlayers && (
        <>
          <Text style={styles.subLabel}>Players to follow</Text>
          <FlatList
            data={section.suggestedPlayers}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => (p as any).id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <SuggestedPlayerCard
                player={item}
                sport={section.sport}
                onPress={() => router.push(`/(app)/player/${(item as any).id}?sport=${section.sport}`)}
              />
            )}
          />
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { followedSports } = useSport();
  const { followedIds } = useFollowedTeams();
  const { followedIds: followedPlayerIds } = useFollowedPlayersAll();
  const router = useRouter();

  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Follow/unfollow shouldn't re-trigger the full feed fetch (button state
  // updates instantly from useFollowedTeams() context on its own) — read the
  // latest followedIds via ref instead of depending on it directly, so load
  // only re-runs on session/sport changes or an explicit refresh.
  const followedIdsRef = useRef(followedIds);
  useEffect(() => { followedIdsRef.current = followedIds; }, [followedIds]);
  const followedPlayerIdsRef = useRef(followedPlayerIds);
  useEffect(() => { followedPlayerIdsRef.current = followedPlayerIds; }, [followedPlayerIds]);

  const ALL_HOME_SPORTS: HomeSport[] = ["basketball", "hockey", "football", "soccer", "golf", "tennis"];
  const PLAYERS_ONLY_SPORTS = new Set<HomeSport>(["golf", "tennis"]);
  const activeSports = ALL_HOME_SPORTS.filter((s) => followedSports.includes(s as any));

  const load = useCallback(async () => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    const ninetyDaysAgo = nDaysAgoISO(90);
    const followedIds = followedIdsRef.current;
    const followedPlayerIds = followedPlayerIdsRef.current;

    const results = await Promise.all(
      activeSports.map(async (sport): Promise<SectionData> => {
        const playersOnly = PLAYERS_ONLY_SPORTS.has(sport);
        const base: SectionData = {
          sport,
          emoji: SPORT_META[sport].emoji,
          label: SPORT_META[sport].label,
          playersOnly,
          todayGames: [],
          recentGames: [],
          suggestedTeams: [],
          followedPlayers: [],
          suggestedPlayers: [],
        };

        try {
          if (!playersOnly) {
            // Fetch today's live + scheduled games + teams
            const [liveResp, todayResp, teamsResp] = await Promise.all([
              getGames(sport as TeamSport, { status: "live" }),
              getGames(sport as TeamSport, { date: today }),
              getTeams(sport as TeamSport),
            ]);

            // Merge today's games, deduped, live first
            const seen = new Set<string>();
            const todayGames: AnyGame[] = [];
            for (const g of [...(liveResp.data ?? []), ...(todayResp.data ?? [])]) {
              if (!seen.has(g.id)) { seen.add(g.id); todayGames.push(g as AnyGame); }
            }
            todayGames.sort((a, b) => {
              if (a.status === "live" && b.status !== "live") return -1;
              if (b.status === "live" && a.status !== "live") return 1;
              return (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "");
            });
            const myToday = todayGames.filter((g) => teamHasFollowedTeam(g, followedIds[sport as TeamSport]));
            const rest = todayGames.filter((g) => !teamHasFollowedTeam(g, followedIds[sport as TeamSport]));
            base.todayGames = [...myToday, ...rest];

            // Suggested teams: all teams minus already-followed, capped at 8
            base.suggestedTeams = ((teamsResp.data ?? []) as AnyTeam[])
              .filter((t) => !followedIds[sport as TeamSport].includes((t as any).id))
              .slice(0, 8);

            // Off-season: if no today games AND has followed teams, fetch recent results
            if (base.todayGames.length === 0 && followedIds[sport as TeamSport].length > 0) {
              const recentByTeam = await Promise.all(
                followedIds[sport as TeamSport].map((teamId) =>
                  getGames(sport as TeamSport, {
                    team_id: teamId,
                    status: "finished",
                    per_page: "3",
                    date_from: ninetyDaysAgo,
                  }).then((r) => (r.data ?? []) as AnyGame[]).catch(() => [] as AnyGame[])
                )
              );
              const recentSeen = new Set<string>();
              const recentGames: AnyGame[] = [];
              for (const games of recentByTeam) {
                for (const g of games) {
                  if (!recentSeen.has(g.id)) { recentSeen.add(g.id); recentGames.push(g); }
                }
              }
              recentGames.sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""));
              base.recentGames = recentGames.slice(0, 6);
            }
          }

          // Followed players for this sport, capped at 10
          if (followedPlayerIds[sport].length > 0) {
            const players = await Promise.all(
              followedPlayerIds[sport].slice(0, 10).map((id) =>
                getPlayer(sport, id).then((r) => r.data as AnyPlayer).catch(() => null)
              )
            );
            base.followedPlayers = players.filter((p): p is AnyPlayer => p != null);
          }

          // Suggested players: top players minus already-followed, capped at 8
          const playersResp = await getPlayers(sport, { per_page: "12" });
          const candidatePlayers: AnyPlayer[] = (playersResp.data ?? []) as AnyPlayer[];
          base.suggestedPlayers = candidatePlayers
            .filter((p) => !followedPlayerIds[sport].includes((p as any).id))
            .slice(0, 8);
        } catch {
          // Return empty section on error — don't crash the whole feed
        }

        return base;
      })
    );

    setSections(results.filter((s) =>
      s.todayGames.length > 0 || s.recentGames.length > 0 || s.suggestedTeams.length > 0 || s.followedPlayers.length > 0 || s.suggestedPlayers.length > 0
    ));
  }, [session, activeSports.join(",")]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  const hasAnything = sections.some(
    (s) => s.todayGames.length > 0 || s.recentGames.length > 0 || s.suggestedTeams.length > 0 || s.followedPlayers.length > 0 || s.suggestedPlayers.length > 0
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greeting}>
          <Text style={styles.greetingLabel}>Today</Text>
          <Text style={styles.greetingTitle}>Your feed</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !hasAnything ? (
          <View style={styles.empty}>
            <Ionicons name="football-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Open the Games tab and tap the follow button on any team to build your feed.
            </Text>
          </View>
        ) : (
          sections.map((section, i) => (
            <React.Fragment key={section.sport}>
              {i > 0 && <View style={styles.sectionDivider} />}
              <SportSection
                section={section}
                onGamePress={(id, sport) => router.push(`/game/${id}?sport=${sport}`)}
              />
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },

    greeting: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
    greetingLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
    greetingTitle: { ...typography.h1, color: colors.text },

    sportSection: { marginBottom: spacing.lg },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    sportEmoji: { fontSize: 18 },
    sportLabel: { ...typography.h3, color: colors.text },
    seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: { ...typography.caption, color: colors.textSecondary },
    subLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: 6,
    },
    horizontalList: { paddingHorizontal: spacing.md, gap: 10, paddingBottom: 4 },
    sectionDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.md, marginBottom: spacing.lg },

    // Game card
    gameCard: {
      width: 240,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    gameCardFollowed: { borderColor: colors.primary + "55" },
    followedStrip: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.primary, opacity: 0.6 },
    gameCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
    liveBadgeText: { ...typography.caption, color: "#ef4444", fontWeight: "600" },
    gameCardTime: { ...typography.caption, color: colors.textSecondary },
    gameCardTeamRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 2 },
    teamFlag: { fontSize: 22, width: 28, textAlign: "center" },
    teamLogo: { width: 26, height: 26 },
    teamAbbrev: { ...typography.body, color: colors.text, width: 32, fontWeight: "600" },
    teamMuted: { color: colors.textSecondary },
    gameCardTeamName: { ...typography.body, color: colors.text, flex: 1 },
    gameCardTeamNameFollowed: { fontWeight: "600" },
    gameCardScore: { ...typography.h2, color: colors.text, minWidth: 26, textAlign: "right" },
    gameCardScoreWinner: { color: colors.primary },
    gameCardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },

    // Suggested team chip
    teamChip: {
      width: 110,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 12,
      alignItems: "center",
      gap: 6,
    },
    teamChipLogo: { width: 40, height: 40 },
    teamChipFlagEmoji: { fontSize: 36, lineHeight: 44 },
    teamChipLogoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    teamChipAbbrev: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    teamChipName: { ...typography.label, color: colors.text, textAlign: "center" },
    teamChipLeague: { ...typography.caption, color: colors.textSecondary },
    teamChipFollowBtn: { marginTop: 2 },

    // Followed player avatar
    playerAvatarWrap: { width: 84, alignItems: "center", gap: 5 },
    playerAvatarPhotoWrap: { width: 64, height: 64 },
    playerAvatarRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    playerAvatarRingLive: { borderColor: "#ef4444" },
    playerAvatarImage: { width: 60, height: 60, borderRadius: 30 },
    playerAvatarPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    playerAvatarInitials: { ...typography.label, color: colors.textSecondary, fontWeight: "600" },
    playerAvatarName: { ...typography.caption, color: colors.text, textAlign: "center", width: "100%" },
    playerAvatarLive: { ...typography.caption, color: "#ef4444", fontWeight: "600", width: "100%", textAlign: "center" },
    playerAvatarMeta: { ...typography.caption, color: colors.textSecondary, width: "100%", textAlign: "center" },

    // Suggested player card
    suggestedPlayerCard: { width: 84, alignItems: "center", gap: 6 },
    suggestedPlayerPhotoWrap: { width: 64, height: 64 },
    suggestedPlayerPhoto: { width: 64, height: 64, borderRadius: 32 },
    suggestedPlayerPhotoPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestedPlayerFollowBtn: { position: "absolute", bottom: -2, right: -2 },
    suggestedPlayerFollowBtnBg: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },

    // Empty state
    empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: spacing.xl, gap: spacing.sm },
    emptyTitle: { ...typography.h3, color: colors.text },
    emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  });
}
