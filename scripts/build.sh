#!/usr/bin/env bash
# Build the Chrome Web Store package from extension/.
# Usage: bash scripts/build.sh   ->  dist/notidem-vX.Y.Z.zip  (+ copy in docs/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
VERSION="$(node -p "require('$EXT/manifest.json').version")"
OUT="$ROOT/dist/notidem-v$VERSION.zip"

# Syntax-check every script before packaging.
for f in $(find "$EXT/src" -name '*.js'); do node --check "$f" >/dev/null; done

mkdir -p "$ROOT/dist"
rm -f "$OUT"
# store-assets are uploaded separately in the dashboard, not shipped in the package.
(cd "$EXT" && zip -qr -X "$OUT" manifest.json assets src vendor -x '*.DS_Store')
cp "$OUT" "$ROOT/docs/notidem-v${VERSION%.*}.zip"
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
echo "Copied to docs/notidem-v${VERSION%.*}.zip"
