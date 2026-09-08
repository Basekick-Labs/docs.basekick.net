#!/usr/bin/env bash
# Phase 6 / V2 gate: every preserved URL must exist in out/ as <path>/index.html
# usage: verify-urls.sh <out-dir> <keep-urls-file>
OUT="${1:-out}"; KEEP="${2:-keep-urls.txt}"
miss=0; ok=0
while read -r u; do
  [ -z "$u" ] && continue
  f="$OUT${u}index.html"
  if [ -f "$f" ]; then ok=$((ok+1)); else echo "MISSING: $u  (expected $f)"; miss=$((miss+1)); fi
done < "$KEEP"
# Redirect targets must exist in the build too, or a typo'd target is only
# discovered once the site is live.
MOVED="$(dirname "$KEEP")/moved-urls.txt"
if [ -f "$MOVED" ]; then
  while read -r from to; do
    case "$from" in ''|\#*) continue;; esac
    f="$OUT${to}index.html"
    if [ -f "$f" ]; then ok=$((ok+1)); else echo "MISSING redirect target: $from -> $to  (expected $f)"; miss=$((miss+1)); fi
  done < "$MOVED"
fi
echo "---"
echo "present: $ok    missing: $miss    total: $((ok+miss))"
[ "$miss" -eq 0 ] || exit 1
