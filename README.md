# Juno Mobile

React Native monorepo for the Juno fan engagement apps. Built with Expo + Turborepo.

## Structure

```
juno/
├── apps/
│   ├── golf/          # Golf fan app (leaderboard, players, schedule)
│   └── tennis/        # Tennis fan app (scores, players, schedule, live match)
├── packages/
│   ├── api/           # Shared REST + WebSocket client for the Juno backend
│   ├── ui/            # Shared component library (PlayerCard, LiveBadge, theme)
│   └── config/        # Shared TypeScript and ESLint config
```

## Requirements

- Node 18+
- [Expo Go](https://expo.dev/go) on your phone, or iOS Simulator / Android Emulator
- The Juno backend running at `http://localhost:4000` (see [juno/README.md](../juno/README.md))

## Setup

```bash
# 1. Install dependencies (all workspaces)
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env if your backend runs somewhere other than localhost:4000
```

## Running

```bash
# Golf app
npm run golf

# Tennis app
npm run tennis
```

Or from within an app directory:

```bash
cd apps/tennis
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android.

## Environment Variables

All vars are prefixed `EXPO_PUBLIC_` so they're available in the RN bundle.

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Juno REST base URL | `http://localhost:4000` |
| `EXPO_PUBLIC_WS_URL` | Juno WebSocket URL | `ws://localhost:4000/socket` |
| `EXPO_PUBLIC_GOLF_TEAM_ID` | Golf team ID | seed value |
| `EXPO_PUBLIC_TENNIS_TEAM_ID` | Tennis team ID | seed value |

## Packages

### `@juno/api`

Typed clients for every Juno endpoint plus Phoenix channel helpers.

```ts
import { golf, tennis, joinTennisMatchChannel } from "@juno/api";

// REST
const { data: players } = await tennis.searchPlayers("sinner");

// WebSocket — live score updates
const channel = joinTennisMatchChannel(matchId, {
  onState: (match) => setMatch(match),
  onDelta: (diff) => setMatch((prev) => ({ ...prev, ...diff })),
  onComment: (c) => setComments((prev) => [c, ...prev]),
});
```

### `@juno/ui`

Shared components and design tokens.

```ts
import { PlayerCard, LiveBadge, colors, spacing } from "@juno/ui";
```

Components:
- `PlayerCard` — photo, name, country, rank badge
- `LiveBadge` — animated green "LIVE" pill

Tokens: `colors`, `spacing`, `radius`, `typography`

## App screens

### Golf
| Tab | Screen |
|-----|--------|
| Leaderboard | Live tournament scores, real-time via WebSocket |
| Players | World rankings list |
| Schedule | Tournament schedule entries |

### Tennis
| Tab | Screen |
|-----|--------|
| Scores | All tournament matches with set scores |
| Players | Player list with search |
| Schedule | Tournament schedule entries |
| `/match/:id` | Live scoreboard + real-time commentary |

## Adding a new sport

1. Create `apps/<sport>/` with `package.json`, `app.json`, `tsconfig.json`
2. Add sport API methods to `packages/api/src/<sport>/`
3. Add sport types to `packages/api/src/<sport>/types.ts`
4. Add a channel helper if the sport has real-time updates
5. Export from `packages/api/src/index.ts`
