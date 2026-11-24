#!/usr/bin/env bash
# Every docs.basekick.net link in out/llms.txt must be a file in the build.
# The post-deploy check only samples a few of these URLs, and by then the
# release is live; this catches a missing content.md or llms-full file while
# it is still local.
# usage: verify-llms.sh <out-dir>
OUT="${1:-out}"
SITE="https://docs.basekick.net"
[ -f "$OUT/llms.txt" ] || { echo "MISSING: $OUT/llms.txt"; exit 1; }
miss=0; ok=0
while read -r url; do
  path="${url#"$SITE"}"
  case "$path" in
    */) f="$OUT${path}index.html" ;;
    *)  f="$OUT$path" ;;
  esac
  if [ -f "$f" ]; then ok=$((ok+1)); else echo "MISSING: $url  (expected $f)"; miss=$((miss+1)); fi
done < <(grep -oE "\\]\\($SITE/[^)]+" "$OUT/llms.txt" | sed 's/^](//' | sort -u)
echo "---"
echo "present: $ok    missing: $miss    total: $((ok+miss))"
[ "$ok" -gt 0 ] || { echo "no links found in $OUT/llms.txt"; exit 1; }
[ "$miss" -eq 0 ] || exit 1
