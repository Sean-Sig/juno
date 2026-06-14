# Adding a New Sport to Juno (Mobile App) — Complete Implementation Guide

Use this prompt at the start of a new session to add a sport to the mobile app.
Replace every `{Sport}`, `{sport}`, `{SPORT}`, and `{emoji}` with the values for the sport you're adding.

This prompt covers Juno only. The backend (Artemis) must be built first — see `NEW_SPORT_PROMPT.md` in the artemis repo.

---

## Project Overview

**Juno** is a React Native / Expo Router app at `/Users/seansiggard/Personal/juno`.
The unified sports app lives at `apps/main` inside the monorepo.

Monorepo structure:
```
apps/main/           — Expo Router app (screens, layouts)
packages/api/        — @juno/api — typed API client + sport context
packages/ui/         — @juno/ui  — shared components (useTheme, spacing, typography, etc.)
```

The backend API is Artemis (`/Users/seansiggard/Personal/artemis`), an Elixir/Phoenix umbrella app.
API base URL is set via `EXPO_PUBLIC_API_URL` in `.env`.

---

## Sport-Specific Values (fill these in before starting)

| Placeholder    | Example (Basketball) | Your value |
|----------------|----------------------|------------|
| `{Sport}`      | `Basketball`         |            |
| `{sport}`      | `basketball`         |            |
| `{SPORT}`      | `BASKETBALL`         |            |
| `{emoji}`      | `🏀`                 |            |
| `{tab_icon}`   | `basketball`         |            |
| `{leagues}`    | `["NBA","NCAAB","WNBA"]` |        |
| `{period_label}` | `Q` (quarter) / `P` (period) / `H` (half) / `Inn` (inning) | |
| `{period_count}` | `4` (basketball/football), `3` (hockey), `2` (soccer halves), `9` (baseball innings) | |

Ionicons tab icon reference (pick the closest match):
- `basketball`, `football`, `baseball`, `tennisball`, `golf`
- For soccer/hockey use: `globe-outline`, `snow-outline`, or `ellipse`
- Browse full list: https://ionic.io/ionicons

---

## Files to Create or Update

```
Layer                       | File
----------------------------|-------------------------------------------------------------
1. TypeScript types         | packages/api/src/{sport}/types.ts  (new)
2. API client               | packages/api/src/{sport}/api.ts    (new)
3. API package exports      | packages/api/src/index.ts          (update)
4. Sport type + ALL_SPORTS  | packages/api/src/sport/context.tsx (update)
5. Layout — tab + SPORT_META| apps/main/app/(app)/_layout.tsx    (update)
6. Games list screen        | apps/main/app/(app)/games.tsx      (update — add {sport} branch)
7. Game detail screen       | apps/main/app/(app)/game/[id].tsx  (update — add {sport} branch)
8. Standings component      | apps/main/components/{Sport}Standings.tsx  (new)
9. Rankings/Standings tab   | apps/main/app/(app)/rankings.tsx   (update — add {sport} branch)
10. Home screen             | apps/main/app/(app)/index.tsx      (update — add {Sport}Home)
11. Player detail screen    | apps/main/app/(app)/player/[id].tsx (update)
```

---

## Step 1 — TypeScript Types

Create `packages/api/src/{sport}/types.ts`.

Model after `packages/api/src/basketball/types.ts`. Every sport needs Team, Player, and Game types.

```typescript
// packages/api/src/{sport}/types.ts

export type {Sport}Team = {
  id: string;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  logo: string | null;
  league: string | null;
  conference: string | null;        // if sport has conferences
  division: string | null;          // if sport has divisions
  wins: number;
  losses: number;
  wins_home: number | null;
  losses_home: number | null;
  wins_away: number | null;
  losses_away: number | null;
  standing_rank: number | null;
  streak: string | null;
};

export type {Sport}Player = {
  id: string;
  first_name: string;
  last_name: string;
  display_first_name: string | null;
  display_last_name: string | null;
  country: string | null;
  photo: string | null;
  position: string | null;
  jersey_number: string | null;
  height: string | null;
  weight: string | null;
  league: string | null;
  team_id: string | null;
  enet_id: string | null;
};

export type {Sport}Game = {
  id: string;
  league: string | null;
  status: "scheduled" | "live" | "finished";
  status_detail: string | null;
  period: number | null;
  period_time: string | null;
  scheduled_at: string | null;
  home_score: number | null;
  away_score: number | null;
  // Add sport-specific period scores here, e.g.:
  // Basketball/Football: home_score_q1..q4, away_score_q1..q4
  // Hockey:              home_score_p1..p3, away_score_p1..p3
  // Soccer:              home_score_ht, away_score_ht  (half-time)
  // Baseball:            home_score_innings (number[]), away_score_innings (number[])
  home_team: {Sport}Team | null;
  away_team: {Sport}Team | null;
  enet_event_id: string | null;
};
```

---

## Step 2 — API Client

Create `packages/api/src/{sport}/api.ts`.

Copy `packages/api/src/basketball/api.ts` exactly and replace module names.
The API routes follow the pattern `/api/v4/{sport}/...` — all backends expose:

```typescript
// packages/api/src/{sport}/api.ts
import { apiFetch, buildQuery, type PageParams } from "../client";
import type { {Sport}Game, {Sport}Team, {Sport}Player } from "./types";

export const {sport} = {
  getGames(params?: { date?: string; league?: string; status?: string } & PageParams) {
    return apiFetch<{ data: {Sport}Game[] }>(`/api/v4/{sport}/games${buildQuery(params)}`);
  },
  getGame(id: string) {
    return apiFetch<{ data: {Sport}Game }>(`/api/v4/{sport}/games/${id}`);
  },
  getTeams(params?: { league?: string; conference?: string } & PageParams) {
    return apiFetch<{ data: {Sport}Team[] }>(`/api/v4/{sport}/teams${buildQuery(params)}`);
  },
  getTeam(id: string) {
    return apiFetch<{ data: {Sport}Team }>(`/api/v4/{sport}/teams/${id}`);
  },
  getPlayers(params?: { league?: string; team_id?: string; q?: string } & PageParams) {
    return apiFetch<{ data: {Sport}Player[] }>(`/api/v4/{sport}/players${buildQuery(params)}`);
  },
  getPlayer(id: string) {
    return apiFetch<{ data: {Sport}Player }>(`/api/v4/{sport}/players/${id}`);
  },
  getFollowedPlayers(token: string) {
    return apiFetch<{ data: string[] }>("/api/v4/{sport}/players/followed_players", { token });
  },
  followPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/{sport}/players/follow", { method: "POST", body: { player_id: playerId }, token });
  },
  unfollowPlayer(playerId: string, token: string) {
    return apiFetch("/api/v4/{sport}/players/unfollow", { method: "POST", body: { player_id: playerId }, token });
  },
};
```

---

## Step 3 — API Package Exports

Update `packages/api/src/index.ts` — add three lines:

```typescript
// Add export for the client:
export { {sport} } from "./{sport}/api";

// Add export for the types:
export type * from "./{sport}/types";
```

---

## Step 4 — Sport Type + ALL_SPORTS

File: `packages/api/src/sport/context.tsx`

Two changes:

```typescript
// BEFORE:
export type Sport = "golf" | "tennis" | "basketball";
export const ALL_SPORTS: Sport[] = ["golf", "tennis", "basketball"];

// AFTER:
export type Sport = "golf" | "tennis" | "basketball" | "{sport}";
export const ALL_SPORTS: Sport[] = ["golf", "tennis", "basketball", "{sport}"];
```

---

## Step 5 — Layout: Tab Registration + SPORT_META

File: `apps/main/app/(app)/_layout.tsx`

**Change 1** — Add to `SPORT_META`:
```typescript
const SPORT_META: Record<Sport, { label: string; emoji: string }> = {
  golf:       { label: "Golf",       emoji: "⛳" },
  tennis:     { label: "Tennis",     emoji: "🎾" },
  basketball: { label: "Basketball", emoji: "🏀" },
  {sport}:    { label: "{Sport}",    emoji: "{emoji}" },   // <-- add
};
```

**Change 2** — Register the Games tab (sport-specific tab bar entry):

The pattern for sport-specific tabs uses `href: activeSport === "{sport}" ? undefined : null`.
- `undefined` = show in tab bar (normal behavior)
- `null` = hidden from tab bar (route still accessible via `router.push`)

Add alongside the existing basketball tab:
```tsx
{/* {Sport}-only tabs */}
<Tabs.Screen
  name="games"
  options={{
    title: "Games",
    href: activeSport === "basketball" || activeSport === "{sport}" ? undefined : null,
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="{tab_icon}" color={color} size={size} />
    ),
  }}
/>
```

NOTE: `games.tsx` is a shared screen. If basketball already owns it, you share the tab — `games.tsx` reads `activeSport` and renders the appropriate sport's list.

**Change 3** — Register detail routes (always hidden from tab bar):
The `game/[id]`, `player/[id]` routes are already registered with `href: null`. No change needed.

---

## Step 6 — Games List Screen

File: `apps/main/app/(app)/games.tsx`

This screen already handles basketball. Add a `{sport}` branch.

The screen is structured as:
1. Filter tabs (Live / Today / Upcoming / Final)
2. `FlatList` of `GameCard` components
3. `GameCard` shows: league badge → status row → matchup (away @ home with scores) → period breakdown

**Import** the new types at the top:
```typescript
import { basketball, {sport}, type BasketballGame, type {Sport}Game } from "@juno/api";
```

**Add a `{Sport}GameCard` component** following the `GameCard` pattern.

For the period breakdown (quarter/period/inning box score), use **explicit object arrays** — never dynamic key access:
```typescript
// CORRECT — TypeScript can't narrow dynamic keys to avoid union with BasketballTeam
const periods = [
  { label: "{period_label}1", away: game.away_score_{period_field}1, home: game.home_score_{period_field}1 },
  { label: "{period_label}2", away: game.away_score_{period_field}2, home: game.home_score_{period_field}2 },
  // ...
];

// WRONG — don't do this:
// game[`away_score_q${n}` as keyof {Sport}Game]  ← resolves to union that includes {Sport}Team
```

**The main `GamesScreen` export** dispatches to the right component based on `activeSport`:
```typescript
export default function GamesScreen() {
  const { activeSport } = useSport();

  if (activeSport === "basketball") return <BasketballGamesContent />;
  if (activeSport === "{sport}") return <{Sport}GamesContent />;
  return null;
}
```

Or if the two sports share enough structure, use a single component with sport-specific props passed in.

---

## Step 7 — Game Detail Screen

File: `apps/main/app/(app)/game/[id].tsx`

Currently basketball-only. Dispatch on `activeSport`:

```typescript
export default function GameScreen() {
  const { activeSport } = useSport();
  if (activeSport === "basketball") return <BasketballGameDetail />;
  if (activeSport === "{sport}") return <{Sport}GameDetail />;
  return null;
}
```

Create `{Sport}GameDetail` following the `BasketballGameDetail` pattern:
1. Load game via `{sport}.getGame(id)`
2. Scoreboard hero (away @ home with large scores)
3. Period-by-period box score table (same explicit array pattern as Step 6)
4. Team records section

`SafeAreaView` on this screen uses `edges={["bottom"]}` only — the native header above already handles top insets.

---

## Step 8 — Standings Component

Create `apps/main/components/{Sport}Standings.tsx`.

Use `BasketballStandings.tsx` as the template. Key decisions by sport:

**Grouped by conference** (NFL, NHL, NBA style) → use `SectionList` with `stickySectionHeadersEnabled`.
```typescript
function groupByConference(teams: {Sport}Team[]): Section[] {
  // group into map, sort each group by standing_rank, then wins
  // sort sections: if NFL — AFC before NFC; NHL — Eastern before Western
}
```

**Not grouped** (MLB, Soccer table-style) → use `FlatList` with a sticky header row.

**League tabs** — if the sport has multiple leagues (NFL + NCAAF, NHL + AHL):
```typescript
type LeagueTab = "NFL" | "NCAAF";
const LEAGUE_TABS: LeagueTab[] = ["NFL", "NCAAF"];
```

**Columns to show** for each sport:
- NFL/NCAA Football: W-L-T, PCT, PF, PA, STRK
- NHL: GP, W-L-OT, PTS, GF, GA, STRK
- Soccer: GP, W-D-L, PTS, GD
- MLB: W-L, PCT, GB (games back), STRK

`SafeAreaView` uses `edges={["bottom", "left", "right"]}` — this is a full tab screen, not behind a native detail header.

---

## Step 9 — Rankings/Standings Tab

File: `apps/main/app/(app)/rankings.tsx`

Add the new sport to the dispatch chain:
```typescript
import {Sport}Standings from "../../components/{Sport}Standings";

export default function RankingsScreen() {
  const { activeSport } = useSport();
  if (activeSport === "golf")       return <GolfRankings />;
  if (activeSport === "tennis")     return <TennisRankings />;
  if (activeSport === "basketball") return <BasketballStandings />;
  if (activeSport === "{sport}")    return <{Sport}Standings />;
  return <BasketballStandings />;  // fallback
}
```

The tab title in `_layout.tsx` may also need updating if the label changes per sport:
```tsx
<Tabs.Screen
  name="rankings"
  options={{
    title: activeSport === "basketball" || activeSport === "{sport}"
      ? "Standings"
      : "Rankings",
    tabBarIcon: ...
  }}
/>
```

---

## Step 10 — Home Screen

File: `apps/main/app/(app)/index.tsx`

Add a `{Sport}Home` component following the `BasketballHome` pattern:

```typescript
import { {sport}, {Sport}Game, ... } from "@juno/api";

function {Sport}Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [games, setGames] = useState<{Sport}Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    return {sport}.getGames({ date: todayStr }).then(({ data }) => setGames(data));
  }, [todayStr]);

  // ... same useEffect, onRefresh, loading skeleton pattern as BasketballHome

  const liveGames = games.filter((g) => g.status === "live");

  return (
    <FlatList
      data={games}
      // Live banner at top if any live games
      ListHeaderComponent={liveGames.length > 0 ? (
        <TouchableOpacity style={styles.liveCard} onPress={() => router.push("/(app)/games")}>
          <View style={styles.liveDot} />
          <View style={styles.liveInfo}>
            <Text style={styles.liveLabel}>Live now</Text>
            <Text style={styles.liveName}>{liveGames.length} game{liveGames.length > 1 ? "s" : ""} in progress</Text>
          </View>
          <Text style={styles.liveCta}>View scores →</Text>
        </TouchableOpacity>
      ) : null}
      renderItem={({ item }) => (
        // compact game row — tapping goes to /(app)/games (the list), not the detail
        <TouchableOpacity style={styles.card} onPress={() => router.push("/(app)/games")}>
          ...
        </TouchableOpacity>
      )}
    />
  );
}
```

Update the root `HomeScreen` dispatch:
```typescript
export default function HomeScreen() {
  const { activeSport } = useSport();
  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      {activeSport === "golf"       ? <GolfHome />       :
       activeSport === "tennis"     ? <TennisHome />     :
       activeSport === "basketball" ? <BasketballHome /> :
       activeSport === "{sport}"    ? <{Sport}Home />    :
       <BasketballHome />}
    </SafeAreaView>
  );
}
```

---

## Step 11 — Player Detail Screen

File: `apps/main/app/(app)/player/[id].tsx`

**Import** the new player type:
```typescript
import { golf, tennis, basketball, {sport},
         GolfPlayer, TennisPlayer, BasketballPlayer, {Sport}Player,
         useAuth, useSport, type Sport } from "@juno/api";

type Player = GolfPlayer | TennisPlayer | BasketballPlayer | {Sport}Player;
```

**API dispatch** — already uses ternary chain, extend it:
```typescript
const api = activeSport === "golf"       ? golf       :
            activeSport === "tennis"     ? tennis     :
            activeSport === "basketball" ? basketball :
                                          {sport};
```

**Stats panel** — add a branch to `getRankStats`:
```typescript
function getRankStats(player: Player, sport: Sport) {
  // ... existing golf/tennis/basketball branches ...
  } else if (sport === "{sport}") {
    const p = player as {Sport}Player;
    return [
      p.position     != null && { label: "Position", value: p.position },
      p.jersey_number != null && { label: "Jersey",   value: `#${p.jersey_number}` },
      p.league       != null && { label: "League",   value: p.league },
    ].filter(Boolean) as { label: string; value: string }[];
  }
}
```

---

## Common Pitfalls

### TypeScript: dynamic key access
```typescript
// WRONG — resolves to a union that includes {Sport}Team, not number
game[`away_score_q${n}` as keyof {Sport}Game]

// CORRECT — use explicit array of objects
const periods = [
  { label: "Q1", away: game.away_score_q1, home: game.home_score_q1 },
  { label: "Q2", away: game.away_score_q2, home: game.home_score_q2 },
] as const;
```

### SafeAreaView edges
- Full tab screen (home, games list, standings): `edges={["bottom", "left", "right"]}`
- Screen shown behind native stack header (game detail, player detail): `edges={["bottom"]}` only
  - Using `["bottom", "left", "right", "top"]` on a detail screen creates a double top inset

### Sport type is a string union
After adding to `Sport` in `context.tsx`, TypeScript will flag every exhaustive check that doesn't handle the new value. Check for errors with `npx tsc --noEmit` from the juno root.

### `activeSport` default
`activeSport` defaults to `"golf"` in `SportProvider`. New sports are only active after the user selects them in onboarding / sport settings. Don't assume your sport will be active in dev unless you manually switch to it.

### Onboarding screen
`apps/main/app/(onboarding)/sport-select.tsx` (or similar) renders sport options from `ALL_SPORTS`. Since you added `{sport}` to `ALL_SPORTS` and `SPORT_META`, it should appear automatically. Verify it shows the right emoji + label.

---

## Verification

```bash
# Type check — zero errors is the target
cd /Users/seansiggard/Personal/juno && npx tsc --noEmit

# Start the dev build
npx expo start --clear
```

Check:
- [ ] Sport appears in the sport switcher sheet
- [ ] Switching to `{sport}` shows the correct tab bar (Games + Rankings/Standings visible)
- [ ] Home screen renders `{Sport}Home`
- [ ] Games tab loads and filters work (Live / Today / Upcoming / Final)
- [ ] Tapping a game card navigates to `/(app)/game/{id}` and shows the correct detail
- [ ] Rankings tab renders `{Sport}Standings`
- [ ] Player detail loads and shows sport-appropriate stat pills
- [ ] Follow/Unfollow works on player detail

---

## Reference Files

```
Basketball types:      packages/api/src/basketball/types.ts
Basketball API client: packages/api/src/basketball/api.ts
API index exports:     packages/api/src/index.ts
Sport context:         packages/api/src/sport/context.tsx
Tab layout:            apps/main/app/(app)/_layout.tsx
Games screen:          apps/main/app/(app)/games.tsx
Game detail:           apps/main/app/(app)/game/[id].tsx
Basketball standings:  apps/main/components/BasketballStandings.tsx
Rankings tab:          apps/main/app/(app)/rankings.tsx
Home screen:           apps/main/app/(app)/index.tsx
Player detail:         apps/main/app/(app)/player/[id].tsx
```
