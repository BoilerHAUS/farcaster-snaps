#!/usr/bin/env bash
# Build a .tar.gz for upload to https://host.neynar.app (framework: hono).
# The archive contains src/, package.json, tsconfig.json, vercel.json.
# src/server.ts is excluded — it uses @hono/node-server which is Node-only
# and incompatible with the Vercel Edge runtime used by host.neynar.app.
set -euo pipefail

SNAP_DIR="$(cd "$(dirname "$0")" && pwd)"
STAGE="$(mktemp -d "/tmp/pixel-canvas-bundle.XXXXXX")"

# Copy src/ excluding server.ts
mkdir -p "$STAGE/src"
rsync -a --exclude="server.ts" "$SNAP_DIR/src/" "$STAGE/src/"

cp "$SNAP_DIR/package.json"   "$STAGE/package.json"
cp "$SNAP_DIR/tsconfig.json"  "$STAGE/tsconfig.json"
cp "$SNAP_DIR/vercel.json"    "$STAGE/vercel.json"

# Install deps inside the stage dir (without devDeps)
(cd "$STAGE" && pnpm install --prod --no-frozen-lockfile)

# Remove node_modules before archiving — host.neynar.app installs them
rm -rf "$STAGE/node_modules"

OUT="${1:-/tmp/pixel-canvas.tar.gz}"
tar czf "$OUT" -C "$STAGE" .
rm -rf "$STAGE"

echo "Bundle written to: $OUT"
echo ""
echo "Deploy steps:"
echo "  1. Go to https://host.neynar.app"
echo "  2. Create new project → framework: hono"
echo "  3. Upload $OUT"
echo "  4. Set env var: SNAP_PUBLIC_BASE_URL=https://pixel-canvas.host.neynar.app"
echo "  5. Verify: curl -sS -H 'Accept: application/vnd.farcaster.snap+json' https://pixel-canvas.host.neynar.app/"
