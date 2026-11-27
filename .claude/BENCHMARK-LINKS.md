# Benchmark blog URLs — ALL VERIFIED 200 (checked before use)

Hub (use as the primary link on benchmark stub pages):
  https://basekick.net/blog/arc-fastest-timeseries-database-clickbench

Per-database comparisons (8 total):
  https://basekick.net/blog/arc-clickbench-vs-influxdb
  https://basekick.net/blog/arc-clickbench-vs-timescaledb
  https://basekick.net/blog/arc-clickbench-vs-duckdb
  https://basekick.net/blog/arc-clickbench-vs-cratedb
  https://basekick.net/blog/arc-clickbench-vs-starrocks
  https://basekick.net/blog/arc-clickbench-vs-elasticsearch
  https://basekick.net/blog/arc-clickbench-cold-runs
  https://basekick.net/blog/arc-log-benchmark-2026

Release posts with measurements (verified 200, 2026-11-27):
  https://basekick.net/blog/arc-release-26-09-1   (response compression: JSON 5M rows −68%; Arrow dictionary + zstd: 39.0 → 19.4 bytes/row)

## DO NOT USE
  arc-clickbench-vs-clickhouse  -> 404, NO SUCH POST EXISTS.
  There is no ClickHouse ClickBench comparison. Do not link it, do not
  guess a slug. If a page needs a ClickHouse reference, link the hub.

## Rule
Never invent a blog slug from a pattern. Every external URL an agent adds
must be verified 200 before it ships.
