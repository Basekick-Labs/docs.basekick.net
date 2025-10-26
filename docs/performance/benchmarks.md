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

### Detailed Query Performance

| Query | Run 1 (Cold) | Run 2 | Run 3 (Best) | Speedup |
|-------|--------------|-------|--------------|---------|
| Q0 | 0.0656s | 0.0493s | 0.0372s | 1.76x |
| Q1 | 0.0788s | 0.0593s | 0.0628s | 1.25x |
| Q2 | 0.1617s | 0.1006s | 0.0838s | 1.93x |
| Q3 | 0.3933s | 0.1135s | 0.0866s | 4.54x |
| Q4 | 1.0929s | 0.3696s | 0.3703s | 2.95x |
| Q5 | 0.8540s | 0.5941s | 0.5854s | 1.46x |
| Q6 | 0.0879s | 0.0671s | 0.0615s | 1.43x |
| Q7 | 0.0788s | 0.0552s | 0.0541s | 1.46x |
| Q8 | 0.7678s | 0.4970s | 0.4792s | 1.60x |
| Q9 | 1.0952s | 0.6155s | 0.6306s | 1.74x |
| Q10 | 0.4700s | 0.1503s | 0.1474s | 3.19x |
| Q11 | 0.9684s | 0.1770s | 0.1728s | 5.60x |
| Q12 | 1.2749s | 0.5886s | 0.6159s | 2.07x |
| Q13 | 2.3860s | 0.9282s | 0.9208s | 2.59x |
| Q14 | 0.8984s | 0.6517s | 0.6543s | 1.37x |
| Q15 | 0.5124s | 0.4124s | 0.4730s | 1.08x |
| Q16 | 2.3555s | 1.0933s | 1.0951s | 2.15x |
| Q17 | 2.1292s | 0.8934s | 0.8398s | 2.53x |
| Q18 | 4.6631s | 3.4164s | 3.4285s | 1.36x |
| Q19 | 0.1524s | 0.0772s | 0.1082s | 1.41x |
| Q20 | 9.9547s | 0.9998s | 0.9473s | 10.51x |
| Q21 | 11.0860s | 0.8748s | 0.8802s | 12.59x |
| Q22 | 19.7547s | 1.8000s | 1.7505s | 11.28x |
| Q23 | 2.7057s | 0.5379s | 0.5494s | 4.92x |
| Q24 | 0.2626s | 0.2049s | 0.1994s | 1.32x |
| Q25 | 0.8849s | 0.2944s | 0.3036s | 2.91x |
| Q26 | 0.2066s | 0.1594s | 0.1401s | 1.47x |
| Q27 | 9.9505s | 1.0231s | 1.0203s | 9.75x |
| Q28 | 9.2788s | 9.1560s | 9.1802s | 1.01x |
| Q29 | 0.1760s | 0.1097s | 0.0841s | 2.09x |
| Q30 | 2.1781s | 0.6090s | 0.5798s | 3.76x |
| Q31 | 5.7843s | 0.7077s | 0.6909s | 8.37x |
| Q32 | 5.2046s | 1.9184s | 1.9551s | 2.66x |
| Q33 | 10.0333s | 2.3399s | 2.3769s | 4.22x |
| Q34 | 10.0738s | 2.4322s | 2.4425s | 4.12x |
| Q35 | 0.7966s | 0.6222s | 0.5954s | 1.34x |
| Q36 | 0.1953s | 0.1682s | 0.1607s | 1.22x |
| Q37 | 0.1525s | 0.1305s | 0.1353s | 1.13x |
| Q38 | 0.1535s | 0.1001s | 0.1093s | 1.40x |
| Q39 | 0.4413s | 0.2626s | 0.2776s | 1.59x |
| Q40 | 0.0965s | 0.0908s | 0.0673s | 1.43x |
| Q41 | 0.1103s | 0.0613s | 0.0625s | 1.76x |
| Q42 | 0.2814s | 0.2526s | 0.2264s | 1.24x |

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
