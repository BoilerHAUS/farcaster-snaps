# Farcaster Snaps

Multi-snap repository. Each snap lives in its own subdirectory (e.g., `snaps/my-snap/`).

## Project Context

Farcaster snaps are server-rendered interactive apps embedded in Farcaster casts. They run on a Node/TypeScript server, respond to GET/POST with JSON, and render in the Farcaster feed via the snap protocol.

Deployment target: `host.neynar.app` (not Vercel, not Railway).

## Active Skills

Only invoke these skills for this project:

- `/farcaster-snap` — core snap development patterns, response format, deployment
- `/clanker` — Clanker REST API (token search), SDK (token deployment), send_token integration
- `/neynar-deploy` — deploy snaps to host.neynar.app: archive, POST to API, poll for build status, rollback
- `/coding-standards` — TypeScript/JS quality rules
- `/tdd-workflow` — test-first development
- `/api-design` — snap endpoint design
- `/frontend-patterns` — React UI patterns for snap components
- `/frontend-design` — snap UI design when needed

Do NOT invoke: frontend-slides, logo-design-guide, configure-ecc, skill-stocktake,
strategic-compact, continuous-learning, continuous-learning-v2, iterative-retrieval,
plankton-code-quality, verification-loop, project-guidelines-example, find-skills.

## Relevant Agents

- `planner` — before starting a new snap
- `tdd-guide` — writing snap handlers and utilities
- `code-reviewer` — after writing snap code
- `typescript-reviewer` — TypeScript-specific review

## Shared Packages

```
packages/hub/   — @farcaster-snaps/hub: free Hub v1 API client (no auth)
```

### @farcaster-snaps/hub

Primary data source for any FID-keyed Farcaster lookups. No API key needed.
Public node: `https://haatz.quilibrium.com`

**Use this for:**
- User profiles (username, displayName, pfpUrl, bio) → `getUserProfile(fid)`
- Verified wallet addresses (ETH + SOL) → `getWalletAddresses(fid)`
- Fetching casts → `getCasts(fid, limit?)`, `getCast(fid, hash)`

**Do NOT use for:**
- Username → FID resolution — Hub only knows FIDs; use `api.warpcast.com/v2/user-by-username`
- Text search, trending, or engagement counts — use Neynar only when these are required

**Setup for a new snap:**

1. Add to `package.json` dependencies:
   ```json
   "@farcaster-snaps/hub": "workspace:*"
   ```

2. Add to `tsconfig.json` `compilerOptions`:
   ```json
   "paths": {
     "@farcaster-snaps/hub": ["../../packages/hub/src/index.ts"]
   }
   ```

3. Import:
   ```typescript
   import { getUserProfile, getWalletAddresses } from "@farcaster-snaps/hub";
   ```

All functions return `null` or empty arrays on failure — never throw.

## Snap Structure (per snap)

```
snaps/<snap-name>/
  src/
    index.ts        # snap handler (SnapFunction)
    components/     # UI components
    lib/            # utilities
  tests/
  package.json
  tsconfig.json
```

## Key Constraints

- Every handler returns `{ version: "2.0", ui: { root, elements } }`
- Local dev: `SKIP_JFS_VERIFICATION=1 pnpm dev`
- Validate: `curl -sS -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:<port>/`
- No secrets in source — use environment variables
- Fetch Farcaster docs: `curl -H 'Accept: text/markdown' https://docs.farcaster.xyz/snap/<page>`
