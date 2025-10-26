---
sidebar_position: 1
---

# Performance Benchmarks

Arc has been benchmarked using [ClickBench](https://github.com/ClickHouse/ClickBench) - the industry-standard analytical database benchmark.

## ClickBench Results

**Arc is the fastest time-series database**, completing all 43 queries on ClickBench with **120.25s cold run** and **35.70s warm run**.

### Official Rankings (Cold Run)

| Database | Cold Run | vs Arc | Architecture |
|----------|----------|--------|--------------|
| **Arc** | **120.25s** | **1.0x** | DuckDB + Parquet + HTTP API |
| QuestDB | 216.30s | 1.80x slower | Columnar time-series |
| TimescaleDB | 1,128.87s | 9.39x slower | PostgreSQL extension |

:::tip Key Achievements
- **Cold Run**: 120.25s (fastest cold start among time-series databases)
- **Warm Run**: 35.70s (with proper filesystem cache)
- **1.80x faster than QuestDB**, 9.39x faster than TimescaleDB
- **5.29x less storage** than QuestDB (13.76 GB vs 72.84 GB)
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

All 43 analytical queries completed successfully with proper cache flushing compliance:

**Performance Summary:**
- **Total Cold Run**: 120.25s
- **Total Warm Run**: 35.70s
- **Cold/Warm Ratio**: 3.37x (proper cache flushing verification)
- **Storage Size**: 13.76 GB (Parquet with Snappy compression)

**Query Execution:**
- All 43 queries passed successfully
- Tested via HTTP REST API with JSON output format
- Filesystem cache properly flushed before cold runs
- Query result caches disabled per ClickBench compliance

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

### vs QuestDB (1.80x faster cold, 1.20x faster warm)

- **Architecture**: Custom columnar engine vs DuckDB
- **Storage**: Proprietary (72.84 GB) vs Parquet (13.76 GB)
- **Cold Run**: Arc 120.25s vs QuestDB 216.30s
- **Warm Run**: Arc 35.70s vs QuestDB 42.70s
- **Storage Efficiency**: Arc uses 5.29x less storage

### vs TimescaleDB (9.39x faster cold, 12.39x faster warm)

- **Architecture**: PostgreSQL extension vs Purpose-built
- **Storage**: Row-based (19.30 GB) vs Columnar (13.76 GB)
- **Cold Run**: Arc 120.25s vs TimescaleDB 1,128.87s
- **Warm Run**: Arc 35.70s vs TimescaleDB 442.34s
- **Query engine**: General-purpose vs Analytics-optimized

## Write Performance

Arc achieves exceptional write throughput through MessagePack columnar binary protocol.

### Write Benchmarks - Format Comparison

| Wire Format | Throughput | p50 Latency | p95 Latency | p99 Latency | Notes |
|-------------|------------|-------------|-------------|-------------|-------|
| **MessagePack Columnar** | **2.42M RPS** | **1.74ms** | **28.13ms** | **45.27ms** | Zero-copy passthrough + auth cache (RECOMMENDED) |
| **MessagePack Row** | **908K RPS** | **136.86ms** | **851.71ms** | **1542ms** | Legacy format with conversion overhead |
| **Line Protocol** | **240K RPS** | N/A | N/A | N/A | InfluxDB compatibility mode |

**Columnar Format Advantages:**
- **2.66x faster throughput** vs row format (2.42M vs 908K RPS)
- **78x lower p50 latency** (1.74ms vs 136.86ms)
- **30x lower p95 latency** (28.13ms vs 851.71ms)
- **34x lower p99 latency** (45.27ms vs 1542ms)
- **Near-zero authentication overhead** with 30s token cache

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

- [c6a.4xlarge.json](https://github.com/Basekick-Labs/ClickBench/blob/main/arc/results/c6a.4xlarge.json) - Corrected results with proper cache flushing
- [Full ClickBench Results](https://benchmark.clickhouse.com)

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
