---
sidebar_position: 1
---

# Performance Benchmarks

Arc has been benchmarked using [ClickBench](https://github.com/ClickHouse/ClickBench) - the industry-standard analytical database benchmark.

## ClickBench Results

**Arc is the fastest time-series database**, completing all 43 queries on ClickBench in **107.66 seconds total** (36.43s cold run).

### Official Rankings (Cold Run)

| Database | Cold Run | vs Arc | Architecture |
|----------|----------|--------|--------------|
| **Arc** | **36.43s** | **1.0x** | DuckDB + Parquet + HTTP API |
| VictoriaLogs | 113.8s | 3.1x slower | LogsQL engine |
| QuestDB | 223.2s | 6.1x slower | Columnar time-series |
| Timescale Cloud | 626.6s | 17.2x slower | PostgreSQL extension |
| TimescaleDB | 1022.5s | 28.1x slower | PostgreSQL extension |

:::tip Key Achievements
- **Cold Run**: 36.43s (fastest cold start among time-series databases)
- **Complete Benchmark**: 107.66s total for all 43 queries (3 runs each)
- **Arc is the only time-series database to complete ClickBench in under 2 minutes via HTTP API**
:::

## Test Environment

### Hardware: AWS c6a.4xlarge

- **CPU**: 16 vCPU AMD EPYC 7R13 Processor
- **RAM**: 32GB
- **Storage**: EBS gp2 (500GB, 1500 baseline IOPS)
- **Network**: Up to 12.5 Gbps
- **Cost**: ~$0.62/hour

### Configuration

- **Workers**: 32 (cores × 2)
- **Query Cache**: Disabled (per ClickBench rules)
- **Storage**: Local Parquet files on EBS gp2
- **Query Method**: HTTP REST API (`POST /query` with JSON)
- **DuckDB**: Default settings (no tuning)

### Dataset

- **File**: hits.parquet (Snappy compression)
- **Rows**: 99,866,354 (99.9M)
- **Size**: 14.78 GB
- **Source**: [ClickBench hits.parquet dataset](https://datasets.clickhouse.com/)

## ClickBench Query Results

All 43 analytical queries completed successfully. Results show **3 runs** per query:

### Query Performance (seconds)

| Query | Run 1 | Run 2 | Run 3 | Best | Notes |
|-------|-------|-------|-------|------|-------|
| Q0 | 0.3385 | 0.2606 | 0.3211 | 0.2606 | Simple aggregation |
| Q1 | 0.5951 | 0.5608 | 0.5928 | 0.5608 | COUNT with GROUP BY |
| Q2 | 0.5631 | 0.3030 | 0.1436 | 0.1436 | Aggregation with filter |
| Q3 | 0.1057 | 0.0905 | 0.0764 | 0.0764 | Fast filter scan |
| Q4 | 0.3500 | 0.3335 | 0.3234 | 0.3234 | Multiple GROUP BY |
| Q5 | 0.5696 | 0.5386 | 0.5515 | 0.5386 | Complex aggregation |
| Q6 | 0.0598 | 0.0590 | 0.0593 | 0.0590 | Selective filter |
| Q7 | 0.0564 | 0.0548 | 0.0550 | 0.0548 | Simple scan |
| Q8 | 0.4429 | 0.4716 | 0.4487 | 0.4429 | JOIN operation |
| Q9 | 0.5682 | 0.5676 | 0.5602 | 0.5602 | Heavy aggregation |
| Q10 | 0.1413 | 0.1428 | 0.1408 | 0.1408 | String operations |
| Q11 | 0.1875 | 0.2139 | 0.1815 | 0.1815 | Complex filter |
| Q12 | 0.5742 | 0.5466 | 0.5648 | 0.5466 | Window functions |
| Q13 | 0.9176 | 0.8787 | 0.8699 | 0.8699 | Multiple JOINs |
| Q14 | 0.5764 | 0.5977 | 0.6207 | 0.5764 | Subqueries |
| Q15 | 0.3892 | 0.4011 | 0.4074 | 0.3892 | DISTINCT operations |
| Q16 | 1.0798 | 1.0383 | 1.0153 | 1.0153 | Heavy computation |
| Q17 | 0.7985 | 0.7727 | 0.7853 | 0.7727 | String matching |
| Q18 | 3.3340 | 3.3020 | 3.3478 | 3.3020 | Complex analytics |
| Q19 | 0.0757 | 0.0683 | 0.0570 | 0.0570 | Simple filter |
| Q20 | 1.0360 | 0.9106 | 0.9079 | 0.9079 | Aggregation pipeline |
| Q21 | 0.8482 | 0.8400 | 0.8520 | 0.8400 | GROUP BY with filter |
| Q22 | 1.7228 | 1.6782 | 1.7208 | 1.6782 | Multiple aggregations |
| Q23 | 0.5097 | 0.5317 | 0.5237 | 0.5097 | Complex WHERE |
| Q24 | 0.1973 | 0.2058 | 0.2073 | 0.1973 | Simple aggregation |
| Q25 | 0.3004 | 0.2941 | 0.2923 | 0.2923 | String operations |
| Q26 | 0.1375 | 0.1461 | 0.1384 | 0.1375 | Fast lookup |
| Q27 | 0.9975 | 0.9866 | 0.9847 | 0.9847 | Complex JOIN |
| Q28 | 9.1263 | 9.1334 | 9.1713 | 9.1263 | Heavy analytics |
| Q29 | 0.0787 | 0.0802 | 0.0787 | 0.0787 | Simple filter |
| Q30 | 0.7854 | 0.6878 | 0.5742 | 0.5742 | Scan with filter |
| Q31 | 0.6781 | 0.6799 | 0.6920 | 0.6781 | Aggregation |
| Q32 | 1.9562 | 1.9239 | 1.9322 | 1.9239 | Window functions |
| Q33 | 2.3368 | 2.2877 | 2.3325 | 2.2877 | Complex analytics |
| Q34 | 2.3724 | 2.3640 | 2.3611 | 2.3611 | Multiple GROUP BY |
| Q35 | 0.5792 | 0.7450 | 0.5765 | 0.5765 | Aggregation pipeline |
| Q36 | 0.1609 | 0.1560 | 0.1666 | 0.1560 | Simple scan |
| Q37 | 0.1366 | 0.1455 | 0.1282 | 0.1282 | Fast filter |
| Q38 | 0.1007 | 0.1072 | 0.0992 | 0.0992 | Selective scan |
| Q39 | 0.2687 | 0.2780 | 0.2750 | 0.2687 | String operations |
| Q40 | 0.0651 | 0.0633 | 0.0686 | 0.0633 | Simple lookup |
| Q41 | 0.0757 | 0.0642 | 0.0626 | 0.0626 | Fast aggregation |
| Q42 | 0.2365 | 0.2269 | 0.2251 | 0.2251 | Final query |

**Total Cold Run (First Run)**: 36.43s
**Average Query Time**: 0.847s
**Fastest Query**: 0.0548s (Q7)
**Slowest Query**: 9.1263s (Q28)

## Why Arc is Fast

### 1. DuckDB Query Engine

Arc leverages DuckDB's columnar execution engine, providing:
- **Vectorized execution**: Process thousands of values per CPU instruction
- **Parallel query execution**: Utilize all CPU cores automatically
- **Advanced optimizations**: Join reordering, predicate pushdown, filter pushdown
- **SIMD instructions**: Use modern CPU features (AVX2, AVX-512)

### 2. Parquet Columnar Storage

- **Columnar format**: Read only columns needed for queries
- **Compression**: 80% smaller than raw data (Snappy/ZSTD)
- **Predicate pushdown**: Skip entire row groups based on statistics
- **Efficient scans**: DuckDB reads Parquet natively

### 3. Stateless Architecture

- **No warm-up needed**: Query engine starts fresh for each query
- **Direct Parquet access**: No intermediate indexes or caches
- **HTTP API overhead included**: Real-world performance with full stack

### 4. Query Optimization

Arc uses DuckDB's query optimizer which includes:
- Column pruning (only read needed columns)
- Row group filtering (skip irrelevant data)
- Join optimization (intelligent join ordering)
- Parallel execution (use all CPU cores)

## Performance Characteristics

### Analytical Workload Strengths

Arc excels at:
- **Aggregations**: GROUP BY queries across millions of rows
- **Window functions**: OVER/PARTITION BY operations
- **JOINs**: Multi-table analytical queries
- **Scans**: Full table scans with filters
- **Time-series analytics**: Time bucketing and rollups

### Query Patterns

**Best Performance**:
- Aggregations on few columns (0.05-0.5s)
- Selective filters (0.05-0.1s)
- Time-series rollups (0.1-0.5s)

**Good Performance**:
- Multi-table JOINs (0.5-1.0s)
- Complex GROUP BY (0.5-1.5s)
- Window functions (1.0-2.0s)

**Acceptable Performance**:
- Heavy analytics on full dataset (2.0-10.0s)

## Comparison with Other Databases

### vs VictoriaLogs (3.1x faster)

- **Architecture**: LogsQL vs SQL
- **Storage**: Custom format vs Parquet
- **Query interface**: Custom API vs HTTP REST + SQL

### vs QuestDB (6.1x faster)

- **Architecture**: Custom columnar engine vs DuckDB
- **Storage**: Proprietary vs Parquet
- **Query complexity**: Limited SQL vs Full SQL

### vs TimescaleDB (28.1x faster)

- **Architecture**: PostgreSQL extension vs Purpose-built
- **Storage**: Row-based vs Columnar
- **Query engine**: General-purpose vs Analytics-optimized

## Write Performance

Arc achieves exceptional write throughput through MessagePack columnar binary protocol.

### Write Benchmarks - Format Comparison

| Wire Format | Throughput | p50 Latency | p95 Latency | p99 Latency | Notes |
|-------------|------------|-------------|-------------|-------------|-------|
| **MessagePack Columnar** | **2.32M RPS** | **6.75ms** | **39.46ms** | **59.09ms** | Zero-copy passthrough (RECOMMENDED) |
| **MessagePack Row** | **908K RPS** | **136.86ms** | **851.71ms** | **1542ms** | Legacy format with conversion overhead |
| **Line Protocol** | **240K RPS** | N/A | N/A | N/A | InfluxDB compatibility mode |

**Columnar Format Advantages:**
- **2.55x faster throughput** vs row format (2.32M vs 908K RPS)
- **20x lower p50 latency** (6.75ms vs 136.86ms)
- **21x lower p95 latency** (39.46ms vs 851.71ms)
- **26x lower p99 latency** (59.09ms vs 1542ms)
- **67x fewer errors** under load (63 vs 4,211 errors at 2.5M target RPS)

**Test Configuration**:
- Hardware: Apple M3 Max (14 cores)
- Workers: 400
- Protocol: MessagePack columnar binary streaming
- Deployment: Native mode
- Storage: MinIO

**MessagePack Columnar vs Line Protocol**: 9.7x faster

## Query Format Performance

Arc supports two query result formats: JSON and Apache Arrow.

### Apache Arrow vs JSON Benchmarks

| Result Size | JSON Time | Arrow Time | Speedup | Size Reduction |
|-------------|-----------|------------|---------|----------------|
| 1K rows | 0.0130s | 0.0099s | 1.31x | 42.8% smaller |
| 10K rows | 0.0443s | 0.0271s | 1.63x | 43.4% smaller |
| 100K rows | 0.3627s | 0.0493s | **7.36x** | 43.5% smaller |

**Test Configuration**:
- Hardware: Apple M3 Max
- Query: `SELECT * FROM cpu LIMIT N`
- Endpoints: `/query` (JSON) vs `/query/arrow` (Arrow IPC)

**Key Findings**:
- Arrow format is 7.36x faster for large result sets (100K+ rows)
- Payloads are 43% smaller with Arrow
- Zero-copy conversion to Pandas/Polars
- Columnar format stays efficient end-to-end

**When to use Arrow**:
- Large result sets (10K+ rows)
- Wide tables with many columns
- Data pipelines feeding into Pandas/Polars
- Analytics notebooks and dashboards

## Reproducibility

All benchmarks are reproducible. See [Running Benchmarks](/arc/performance/running-benchmarks) for instructions.

### Download Results

- [c6a.4xlarge_cache_disabled.json](https://github.com/basekick-labs/arc/tree/main/benchmarks/clickbench/results)
- [Full ClickBench Results](https://clickhouse.com/benchmark)

## What This Means

Arc's ClickBench performance demonstrates:

1. **Production-Ready Analytics**: Handle complex queries on 100M+ row datasets
2. **Cost-Effective**: Fast queries on commodity hardware (AWS c6a.4xlarge)
3. **No Tuning Required**: Default DuckDB settings perform excellently
4. **Stateless Efficiency**: No warm-up or pre-loading needed
5. **Real-World Performance**: HTTP API overhead included in all measurements

:::tip
For maximum query performance, enable [automatic compaction](/arc/advanced/compaction) to merge small files into optimized 512MB chunks.
:::

## Next Steps

- **[Run Your Own Benchmarks](/arc/performance/running-benchmarks)**
- **[Optimize Query Performance](/arc/performance/optimization)**
- **[Configure Compaction](/arc/advanced/compaction)**
- **[Enable Query Caching](/arc/configuration/caching)**
