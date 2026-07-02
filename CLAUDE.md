# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React Native (Expo + Expo Router) monorepo for the Juno fan-engagement app, talking to the
`artemis` Phoenix backend (REST `/api/v4/...` + Phoenix channels over `ws://.../socket`). It's a
single cross-sport app — **not** one app per sport. `README.md` and `.env.example` describe an
older layout (`apps/golf/`, `apps/tennis/`, per-app `EXPO_PUBLIC_*_TEAM_ID` vars) that no longer
exists; trust the code below over those files.

The backend is `artemis` (sibling project, `../artemis`) — a Phoenix umbrella app, deployed to Fly.io
as `artemis-golf`. When data looks wrong in the app, check `artemis/CLAUDE.md` for the ingestion
pipeline (Enet adapters → `Core.<Sport>.Teams`/`StandingsComputer` → Postgres) before assuming the
bug is in this repo — several past "frontend" bugs (e.g. duplicate World Cup teams) turned out to be
backend data issues that just surfaced here.

## Commands

```bash
npm install                          # installs all workspaces (npm workspaces, not separate installs)

npm run start                        # turbo run start --filter=@juno/main (expo start)
cd apps/main && npx expo start       # equivalent, run directly
npm run ios / npm run android        # from apps/main, or `npx expo start --ios`/`--android`

npm run build                        # turbo run build (expo export), all workspaces
npm run lint                         # turbo run lint → eslint . --ext .ts,.tsx per package
npm run typecheck                    # turbo run typecheck → tsc --noEmit per package
npm run test                         # turbo run test — currently a no-op: no package defines a
                                      # "test" script, so there is no test suite to run yet
```

`.env` lives in `apps/main/.env` (Expo reads env per-app, not from the monorepo root), with vars
prefixed `EXPO_PUBLIC_` to be bundled into the RN app: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`.
Use your machine's LAN IP instead of `localhost` when testing on a physical device.

## Architecture

### One app, six sports, runtime switching

`apps/main` is the only app. Which sport is "active" is **session state in React, not a build-time
or route concern** — `SportProvider` (`packages/api/src/sport/context.tsx`) holds `activeSport`,
persists `followedSports`/`defaultSport` to `SecureStore`, and syncs them to the backend via
`fan` API calls on `finishOnboarding`. `useSport().activeSport` is read all over the tab layout and
screens to decide what to render/fetch — there's no per-sport route segment.

`app/_layout.tsx` wraps everything in `AuthProvider` → `SportProvider` → a theme that re-keys off
`activeSport` (so colors/branding swap per sport) → `RootNavigator`, which redirects between three
states: not logged in → `(auth)`, logged in but `!isOnboarded` (no followed sports yet) →
`/onboarding`, otherwise → `(app)` tabs.

### Tab layout adapts per sport, doesn't duplicate per sport

`app/(app)/_layout.tsx` defines a fixed set of `Tabs.Screen`s, but most are conditionally hidden via
`href: activeSport === "X" ? undefined : null` rather than having separate route trees — e.g. the
first tab is `tournaments` for golf, `matches` for tennis, or `games` for basketball/hockey/
football/soccer, and `href: null` on the other two hides them from the tab bar. When adding a new
sport-specific concept, check whether it fits one of these existing shared tabs before adding a new
`Tabs.Screen`.

The "Rankings" tab is one of the few places that fans out by sport in the render path itself —
`app/(app)/rankings.tsx` just switches on `activeSport` to render one of
`GolfRankings`/`TennisRankings`/`BasketballStandings`/`HockeyStandings`/`FootballStandings`/
`SoccerStandings` (all in `apps/main/components/`). These per-sport standings components are mostly
independent and don't share much code — check the specific one rather than assuming shared logic.

### `@juno/api` — one client module per sport, same shape

`packages/api/src/<sport>/{api.ts,types.ts,channel.ts?}` repeats per sport (golf, tennis,
basketball, hockey, football, soccer), all built on the shared `apiFetch` in `client.ts`:
- `apiFetch<T>(path, { method, body, token })` — thin `fetch` wrapper. A 401 response calls the
  globally-registered `setUnauthorizedHandler` (wired up by `AuthProvider` to clear the session) and
  throws — that's the only global auth-error handling; individual screens don't need to check 401.
- `buildQuery(params)` — turns a params object into a query string, dropping `undefined` values.
- `PageParams` (`page`/`per_page`) is the shared shape for paginated list endpoints; default
  `per_page` is enforced server-side (see `artemis`'s `Core.Pagination`), not client-side.

Real-time sports (golf, tennis, basketball, hockey, soccer) additionally export a
`join<Sport><Channel>` helper wrapping `phoenix`'s `Socket`/`Channel` (`socket/socket.ts` holds a
lazily-created singleton `Socket`). Pattern: join pushes the full current state once
(`*_state`/`tournament_state`/`match_state`), then `*_delta` events carry only changed fields to
merge into local state. **Football has no channel helper** — if asked to add live football scores,
this is the piece that's missing, not a bug.

Every sport's types and API object are re-exported from `packages/api/src/index.ts` — when adding a
sport, wire it up there too or consumers in `apps/main` won't see it.

### `@juno/ui` and `@juno/config`

`@juno/ui` (`packages/ui/src`) is a small shared component/theme library — `ThemeProvider` takes the
active `sport` and produces a `Palette`; components pull `colors`/`spacing`/`radius`/`typography`
from `useTheme()` rather than hardcoding values. `@juno/config` holds the shared
`tsconfig.base.json` and `eslint.base.js` (`expo` + `prettier` configs) that `apps/main` and
`packages/api`/`packages/ui` extend — change lint/TS rules there, not per-package.

### Auth and "fan" prefs

`auth/context.tsx`'s `AuthProvider` loads a persisted session (`SecureStore`, keyed by
`sessionKey="juno_session"`), then calls `fan.me()` to revalidate the token *and* pull the latest
sport-follow prefs in one request — `SportProvider` reads those prefs off the merged session rather
than making a second call. If you change what `/api/v4/me` returns on the backend, check both
`AuthProvider` and `SportProvider` for assumptions about that payload shape.

### Known stale/dead bits

- `README.md` and `.env.example` describe a pre-refactor per-sport-app layout — don't follow their
  setup instructions literally.
- `packages/api/src/followed/` exists but is empty.
- There is no test suite (`npm test` runs `turbo run test` against packages with no `test` script).
