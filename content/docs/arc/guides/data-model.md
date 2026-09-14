---
title: "Data Model"
description: "How Arc structures data: databases, measurements, hourly partitions, and plain columns. The modeling decisions that are expensive to change later, and how to get them right the first time."
---

Arc's data model is deliberately thin. A **measurement** is a table, and every value you write is an ordinary column alongside a `time` column. There is no internal tag type, no series index, and no schema registry you must declare against before writing.

That thinness moves the important decisions to you. This guide covers the ones that are expensive to reverse once data is on disk.

## The physical layout

Every Parquet file Arc writes lands at a path built from exactly three things:

```
{database}/{measurement}/{YYYY}/{MM}/{DD}/{HH}/{measurement}_{timestamp}_{nanos}.parquet
```

Hourly partitioning is fixed and not configurable. This is the single most important fact about modeling in Arc:

<Callout type="info" title="Your only partition dimensions are database, measurement, and time">
Everything else you write is a column inside the file. There is no partitioning by tenant, region, or device unless you encode it in the database or measurement name.
</Callout>

Queries prune by directory glob, so a time-bounded query reads only the hour directories it needs. Daily compaction later rewrites a day's files into the day-level directory (no `HH` segment), and the query pruner looks in both places.

## Databases and measurements

### Naming rules

Both names are validated at write time:

| | Pattern | Length |
|---|---|---|
| Database | Must start with an ASCII letter, then `[a-zA-Z0-9_-]` | 1–64 |
| Measurement | `^[a-zA-Z][a-zA-Z0-9_-]*$` | 1–128 |

Select the database with the `x-arc-database` header. The default, when nothing is specified, is literally `default`.

### Naming is a permanent policy boundary

Names decide more than organization. Three subsystems key off them, and all three are hard to retrofit:

- **Access control.** RBAC matches database and measurement names with wildcards — `*`, `prefix_*`, `*_suffix`, and `prefix*`. A policy like "read everything in production" is only expressible if your names share a prefix.
- **Retention.** Policies are per-database, optionally narrowed to a single measurement.
- **Tiering.** Policies are **per-database only**. There is no per-measurement tiering policy.

<Callout type="warn" title="Avoid hyphens in database names">
Arc's query router validates database identifiers as `^[a-zA-Z0-9_]+$` — stricter than the create-time rule, which permits hyphens. A hyphenated database name parses differently in RBAC's `db.table` patterns than in the router, so the two can disagree about which database is being read. Use underscores.
</Callout>

### What earns a separate measurement

Put data in its own measurement when it needs its own **retention**, **access policy**, or **lifecycle** — those are the boundaries Arc can act on. Split when schemas are genuinely unrelated, since a measurement's columns are the union of everything written to it, and unrelated data produces wide, sparse files.

Keep data together when it is queried together. Arc reads only the columns a query touches, so extra columns cost far less than a join across measurements.

Splitting by *value* — one measurement per device, per tenant, per satellite — is almost always wrong. It multiplies buffers and files without improving pruning, because the value would have pruned just as well as a column. Split by *kind*, not by *instance*.

## Columns and types

Types are inferred per column from the first non-null value in the batch:

| Input | Arrow / Parquet type |
|---|---|
| Integer types | `INT64` |
| `float32` / `float64` | `DOUBLE` |
| String | `STRING` |
| Boolean | `BOOL` |
| Declared decimal columns | `DECIMAL128(precision, scale)` |
| `time` | `TIMESTAMP(µs, UTC)` |

All columns are nullable. Unsupported types are rejected at write time.

Decimals are the exception to inference: they must be **declared** via `ingest.decimal_columns`, because a decimal arrives on the wire as a number and is otherwise indistinguishable from a float. See [Decimal Precision](/arc/guides/decimal-precision/).

### Keep a column's type stable

A column that arrives as `int64` in one batch and `float64` in the next is treated as a different schema (see [Schema evolution](#schema-evolution)). Pick a type per column and hold it — send `1.0`, not `1`, for a float column that happens to have a round value.

<Callout type="warn" title="Never reuse a name across tags and fields">
On the line protocol path, a field whose name collides with a tag name on the same record is silently renamed to `{name}_value`. You will query `temperature` and get the tag, while the measured value sits in `temperature_value`. No error is raised.
</Callout>

## Timestamps

Arc's canonical unit is **microseconds**, stored as a UTC-zoned Parquet timestamp and read back as `TIMESTAMP WITH TIME ZONE`.

How the unit is determined depends on the write path, and the difference matters:

### MessagePack and MQTT: the unit is inferred

Arc reads the **first element** of the `time` column and picks a multiplier from its magnitude:

| First value | Assumed unit |
|---|---|
| `< 1e10` | seconds |
| `< 1e13` | milliseconds |
| `< 1e16` | microseconds |
| otherwise | nanoseconds |

That multiplier is then applied to **every row in the batch**.

<Callout type="error" title="A wrong first timestamp corrupts the whole batch">
Because the unit is chosen from one value and applied to all of them, a batch whose first element falls in a different magnitude band than the rest is silently misconverted. Backfills of historical or recorded telemetry are the common trigger.

**Always send microseconds explicitly**, and make sure every batch is internally consistent in unit. There is no way to declare the unit on this path: the columnar payload has no unit field at all, and the `_time_unit` field on Arc's row-oriented record struct is never read.
</Callout>

### Line protocol: the unit is declared

Use the `precision` query parameter — `ns`, `us`, `ms`, or `s`. The default is `ns`.

<Callout type="warn" title="Nanosecond input is truncated, not rounded">
Arc converts `ns` to microseconds by integer division. Sub-microsecond precision is silently discarded. If your domain needs finer resolution than a microsecond, store it in a separate column.
</Callout>

### Other timestamp rules

- A missing `time` column means every row gets the current time, with a warning.
- An all-null `time` column is rejected.
- A null *inside* the time column is rejected — it would otherwise become `0` and route the row to a 1970 partition.
- A string `time` column is rejected at ingest, because a `VARCHAR` time column permanently wedges compaction for that partition. Floats are accepted and truncated to integer microseconds, but sending integers avoids any rounding surprise.

## Deduplication

Arc ingests append-only and de-duplicates during compaction. A duplicate is a row with the same **dedup key** and the same timestamp.

The dedup key comes from column names recorded in the Parquet footer as `arc:tags`, and the key is `(tag columns…, time)`, keeping one row per key.

**Only some write paths set that metadata:**

| Write path | Dedup key written? |
|---|---|
| Line protocol | Yes — the tag columns |
| Continuous queries | Yes — the GROUP BY dimensions |
| MessagePack | **No** |
| MQTT | **No** (decodes MessagePack/JSON) |
| WAL replay | **No** |

<Callout type="warn" title="MessagePack and MQTT data is compacted but never de-duplicated">
This includes Arc's highest-throughput write path and the standard IoT path. Data recovered from the WAL after a crash also carries no dedup key, even if it was originally written via line protocol.

If your pipeline can deliver the same point twice — at-least-once queues, MQTT redelivery, retried batches, replayed recordings — either write via line protocol, or make duplicates harmless at query time (`SELECT DISTINCT`, or an aggregate that tolerates them).
</Callout>

## Schema evolution

Arc has no schema registry. It tracks a per-buffer **column signature** — the sorted set of column names and their types — and reacts when that signature changes.

Adding a column, removing a column, or changing a column's type all produce a new signature. When that happens Arc **flushes the current buffer and starts a new one**. It is not an error, and old and new schemas are not merged into one file: you get one file under the old schema and subsequent files under the new one. At read time, files are reconciled by column name.

Within a single signature, columns missing from some batches are written as nulls, so sparse data is fine.

<Callout type="warn" title="Schema churn causes flush amplification">
Each signature change forces a flush, so alternating schemas within a stream produce many small files — with **no upper bound**. Nothing stops a writer from doing this; it simply degrades until your files are tiny and your queries slow.

There is one narrow guard, and it is not the one you might expect: if eight or more *distinct* schemas race through the same `database/measurement` buffer **concurrently**, during the window of a single flush, that write is rejected with HTTP 503 and no data loss. That is a concurrency signal. A single writer alternating between two schemas will never trigger it — it flushes once per write and keeps going, producing small files indefinitely.
</Callout>

### Cardinality behaves differently than you may expect

Write buffers are keyed by `database/measurement` only. A million distinct tag values in one measurement still produce **one** buffer and one file per flush.

<Callout type="idea" title="High tag cardinality is cheap; unstable schemas are expensive">
This inverts the instinct carried over from series-indexed databases like InfluxDB. Arc has no series index, so distinct tag *values* cost you little at write time.

What costs you is churn in tag *keys* — new column names appearing and disappearing — because that changes the schema signature and forces a flush. Stable column names with many distinct values are the shape Arc handles well.
</Callout>

High cardinality is not entirely free at read time: a high-cardinality column scattered across row groups gives Parquet statistics nothing to skip on. Sort keys are the lever for that.

## Sort keys

Rows are sorted within each hourly partition before being written. By default, sorting is by `time` alone.

Configure additional columns per measurement with `ingest.sort_keys`, using the form `measurement:col1,col2`:

```toml
[ingest]
sort_keys = ["cpu:host", "sensors:site,device_id"]
```

You configure only the **additional** columns — `time` is appended automatically, so `cpu:host` sorts by `(host, time)`.

Sorting by a low-cardinality column before `time` clusters equal values together, which improves compression and tightens per-row-group min/max statistics so the query engine can skip more row groups. Arc writes Parquet statistics by default.

Choose a column that appears in your `WHERE` clauses and has far fewer distinct values than rows — `host`, `site`, `subsystem`. Sorting by a near-unique column gains nothing.

<Callout type="warn" title="A missing sort key column is a hard error">
If a configured sort key names a column that is not present in the batch, the flush fails. Only configure sort keys on columns every write to that measurement includes.
</Callout>

<Callout type="warn" title="Known issue: compaction does not preserve the implicit time key">
The automatic `time` append currently happens at **ingest only**. When compaction rewrites those files it orders by the configured columns alone — so with `cpu:host`, compacted output is ordered by `host`, and rows within each host are no longer time-ordered.

This inverts the benefit described above for the files that matter most. Compacted files are the long-lived ones and the only ones that tier, so on a deployment with custom sort keys, time-range statistics on compacted output can end up **worse** than on the raw ingest files they replaced.

Deployments on the default (`time`) are unaffected — the list is identical either way. Until [arc#792](https://github.com/Basekick-Labs/arc/issues/792) is fixed, treat custom sort keys as an ingest-side optimization only, and measure time-range query performance before and after enabling them.
</Callout>

## Lifecycle

Data moves through three stages, and each has a modeling implication.

**Compaction** merges small files into larger ones. Hourly compaction merges within an hour directory; daily compaction merges a day into the day-level directory and re-encodes with ZSTD. Deduplication happens here, if a dedup key is present.

**Retention** deletes whole files once every row in the file is older than the cutoff. Policies are per-database, optionally narrowed to one measurement. Because deletion is file-granular and data-aware, a file straddling the cutoff is kept in full.

**Tiering** (Enterprise) migrates files from hot to cold storage. Policies are per-database, and the object key is unchanged across tiers.

<Callout type="warn" title="Only daily-compacted files ever migrate to cold storage">
Tiering skips any file whose name does not end in `_daily.parquet`. Raw ingest files and hourly-compacted output stay on hot storage indefinitely.

If daily compaction is disabled, or never reaches its file threshold for a low-volume measurement, that measurement's data never tiers — it accumulates on hot storage silently. Verify daily compaction is running for every measurement you expect to tier.
</Callout>

## A modeling checklist

Before your first production write:

1. **Database names** — underscores only; chosen so RBAC wildcards can express your access policy.
2. **Measurement split** — by kind and lifecycle, never by instance value.
3. **Column names** — stable set per measurement; no name reused across a tag and a field.
4. **Column types** — one type per column, held stable across batches; decimals declared.
5. **Timestamps** — microseconds, UTC, consistent within every batch.
6. **Dedup** — if duplicates are possible, use line protocol or tolerate them at query time.
7. **Sort keys** — a low-cardinality filter column ahead of `time`, present in every write.
8. **Lifecycle** — retention policy set; daily compaction confirmed running if you rely on tiering.

## Related guides

- [Writing Data](/arc/guides/writing-data/)
- [SQL Querying Guide](/arc/guides/querying/)
- [Decimal Precision](/arc/guides/decimal-precision/)
- [Retention Policies](/arc/data-lifecycle/retention-policies/)
- [Continuous Queries](/arc/data-lifecycle/continuous-queries/)
