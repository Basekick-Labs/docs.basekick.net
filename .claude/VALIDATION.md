# Validating technical claims

The migration must not invent, and must not silently carry forward, anything
false. Every uncertain claim gets checked against source before it ships.

## Sources of truth

**Arc OSS and Enterprise** - `/Users/nacho/dev/basekick-labs/arc`

- `arc.toml` is the canonical config reference. Sections: `server`, `log`,
  `database`, `storage`, `ingest`, `compaction`, `auth`, `delete`,
  `retention`, `continuous_query`, `mqtt`, `query`, `telemetry`,
  `tiered_storage` (+ `.cold`), `audit_log`, `backup`, `wal`.
- `RELEASE_NOTES_2026.*.md` - when a feature actually shipped. Latest is
  26.09.1.
- Go source under `cmd/` and `internal/` - handler signatures, CLI flags,
  defaults.

**Launchpad** - `/Users/nacho/dev/basekick-labs/launchpad` (SvelteKit).

**Main site and blog** - `/Users/nacho/dev/basekick-labs/basekick.net`.
Feed at `https://basekick.net/feed.xml` (RSS 2.0, live).

## Rules

Do not invent flags, endpoints, config keys, defaults or version numbers. If
a claim cannot be confirmed, either drop the sentence or mark it

    {/* TODO(verify): <the specific claim> */}

Never guess. A plausible-looking wrong flag is worse than an omission.

**Every external URL added or changed must return 200 before it ships.**
Verified benchmark blog URLs are listed in `.claude/BENCHMARK-LINKS.md`;
`arc-clickbench-vs-clickhouse` does **not** exist despite fitting the
pattern, which is exactly why guessing is banned.

Version numbers in install commands should point at
`/releases/latest/download/...` rather than a pinned version, so the docs do
not go stale on the next release. Read the surrounding lines first: a literal
`${LATEST_VERSION}` inside a shell block may be a deliberate variable the
reader sets, not a broken URL.

## Known pre-existing gap - do not expand scope

`azure_access_tier` and `default_sort_keys` exist in `arc.toml` but appear in
no page. The `tiered_storage` `migration_*` and `retrieval_mode` keys ARE
documented, in `docs-arc-enterprise/data-lifecycle/tiered-storage.md`, which
is the correct place for them.

Fix the two missing keys only if you are already editing the page that should
document them. Do not turn this migration into a configuration-reference
audit.
