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
echo "---"
echo "present: $ok    missing: $miss    total: $((ok+miss))"
[ "$miss" -eq 0 ] || exit 1
