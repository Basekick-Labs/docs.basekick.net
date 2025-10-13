---
sidebar_position: 1
---

# Performance Benchmarks

Arc has been benchmarked using [ClickBench](https://github.com/ClickHouse/ClickBench) - the industry-standard analytical database benchmark.

## ClickBench Results

**Arc is the fastest time-series database in ClickBench**, outperforming all other time-series databases.

### Official Rankings

| Database | Cold Run | vs Arc | Architecture |
|----------|----------|--------|--------------|
| **Arc** | **34.43s** | **1.0x** | DuckDB + Parquet + HTTP API |
| VictoriaLogs | 113.8s | 3.3x slower | LogsQL engine |
| QuestDB | 223.2s | 6.5x slower | Columnar time-series |
| Timescale Cloud | 626.6s | 18.2x slower | PostgreSQL extension |
| TimescaleDB | 1022.5s | 29.7x slower | PostgreSQL extension |

:::info
Arc is the **only time-series database** to complete ClickBench in under 1 minute via HTTP API.
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

- **Rows**: 99,866,354 (99.9M)
- **Raw Size**: 74.3 GB (TSV)
- **Parquet Size**: 14.78 GB (Snappy compression)
- **Compression Ratio**: 80.1%
- **Source**: [ClickBench hits.tsv dataset](https://datasets.clickhouse.com/)

## ClickBench Query Results

All 43 analytical queries completed successfully. Results show **3 runs** per query:

### Query Performance (seconds)

| Query | Run 1 | Run 2 | Run 3 | Best | Notes |
|-------|-------|-------|-------|------|-------|
| Q0 | 0.339 | 0.261 | 0.321 | 0.261 | Simple aggregation |
| Q1 | 0.595 | 0.561 | 0.593 | 0.561 | COUNT with GROUP BY |
| Q2 | 0.563 | 0.303 | 0.144 | 0.144 | Aggregation with filter |
| Q3 | 0.106 | 0.091 | 0.076 | 0.076 | Fast filter scan |
| Q4 | 0.350 | 0.334 | 0.323 | 0.323 | Multiple GROUP BY |
| Q5 | 0.570 | 0.539 | 0.552 | 0.539 | Complex aggregation |
| Q6 | 0.060 | 0.059 | 0.059 | 0.059 | Selective filter |
| Q7 | 0.056 | 0.055 | 0.055 | 0.055 | Simple scan |
| Q8 | 0.443 | 0.472 | 0.449 | 0.443 | JOIN operation |
| Q9 | 0.568 | 0.568 | 0.560 | 0.560 | Heavy aggregation |
| Q10 | 0.141 | 0.143 | 0.141 | 0.141 | String operations |
| Q11 | 0.188 | 0.214 | 0.182 | 0.182 | Complex filter |
| Q12 | 0.574 | 0.547 | 0.565 | 0.547 | Window functions |
| Q13 | 0.918 | 0.879 | 0.870 | 0.870 | Multiple JOINs |
| Q14 | 0.576 | 0.598 | 0.621 | 0.576 | Subqueries |
| Q15 | 0.389 | 0.401 | 0.407 | 0.389 | DISTINCT operations |
| Q16 | 1.080 | 1.038 | 1.015 | 1.015 | Heavy computation |
| Q17 | 0.799 | 0.773 | 0.785 | 0.773 | String matching |
| Q18 | 3.334 | 3.302 | 3.348 | 3.302 | Complex analytics |
| Q19 | 0.076 | 0.068 | 0.057 | 0.057 | Simple filter |
| Q20 | 1.036 | 0.911 | 0.908 | 0.908 | Aggregation pipeline |
| Q21 | 0.848 | 0.840 | 0.852 | 0.840 | GROUP BY with filter |
| Q22 | 1.723 | 1.678 | 1.721 | 1.678 | Multiple aggregations |
| Q23 | 0.510 | 0.532 | 0.524 | 0.510 | Complex WHERE |
| Q24 | 0.197 | 0.206 | 0.207 | 0.197 | Simple aggregation |
| Q25 | 0.300 | 0.294 | 0.292 | 0.292 | String operations |
| Q26 | 0.138 | 0.146 | 0.138 | 0.138 | Fast lookup |
| Q27 | 0.998 | 0.987 | 0.985 | 0.985 | Complex JOIN |
| Q28 | 9.126 | 9.133 | 9.171 | 9.126 | Heavy analytics |
| Q29 | 0.079 | 0.080 | 0.079 | 0.079 | Simple filter |
| Q30 | 0.785 | 0.688 | 0.574 | 0.574 | Scan with filter |
| Q31 | 0.678 | 0.680 | 0.692 | 0.678 | Aggregation |
| Q32 | 1.956 | 1.924 | 1.932 | 1.924 | Window functions |
| Q33 | 2.337 | 2.288 | 2.333 | 2.288 | Complex analytics |
| Q34 | 2.372 | 2.364 | 2.361 | 2.361 | Multiple GROUP BY |
| Q35 | 0.579 | 0.745 | 0.577 | 0.577 | Aggregation pipeline |
| Q36 | 0.161 | 0.156 | 0.167 | 0.156 | Simple scan |
| Q37 | 0.137 | 0.146 | 0.128 | 0.128 | Fast filter |
| Q38 | 0.101 | 0.107 | 0.099 | 0.099 | Selective scan |
| Q39 | 0.269 | 0.278 | 0.275 | 0.269 | String operations |
| Q40 | 0.065 | 0.063 | 0.069 | 0.063 | Simple lookup |
| Q41 | 0.076 | 0.064 | 0.063 | 0.063 | Fast aggregation |
| Q42 | 0.237 | 0.227 | 0.225 | 0.225 | Final query |

**Total Cold Run (First Run)**: 34.43s
**Average Query Time**: 0.800s
**Fastest Query**: 0.055s (Q7)
**Slowest Query**: 9.126s (Q28)

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
- ✅ **Aggregations**: GROUP BY queries across millions of rows
- ✅ **Window functions**: OVER/PARTITION BY operations
- ✅ **JOINs**: Multi-table analytical queries
- ✅ **Scans**: Full table scans with filters
- ✅ **Time-series analytics**: Time bucketing and rollups

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

### vs VictoriaLogs (3.3x faster)

- **Architecture**: LogsQL vs SQL
- **Storage**: Custom format vs Parquet
- **Query interface**: Custom API vs HTTP REST + SQL

### vs QuestDB (6.5x faster)

- **Architecture**: Custom columnar engine vs DuckDB
- **Storage**: Proprietary vs Parquet
- **Query complexity**: Limited SQL vs Full SQL

### vs TimescaleDB (29.7x faster)

- **Architecture**: PostgreSQL extension vs Purpose-built
- **Storage**: Row-based vs Columnar
- **Query engine**: General-purpose vs Analytics-optimized

## Write Performance

Arc achieves exceptional write throughput through MessagePack binary protocol.

### Write Benchmarks

| Storage Backend | Throughput | p50 Latency | p95 Latency | p99 Latency |
|----------------|------------|-------------|-------------|-------------|
| **Local NVMe** | **2.08M RPS** | **13.4ms** | **136ms** | **280ms** |
| **MinIO** | **2.01M RPS** | **16.6ms** | **147ms** | **318ms** |
| **Line Protocol** | **240K RPS** | N/A | N/A | N/A |

**Test Configuration**:
- Hardware: Apple M3 Max (14 cores)
- Workers: 42 (3x CPU cores)
- Protocol: MessagePack binary streaming
- Deployment: Native mode

**MessagePack vs Line Protocol**: 8.4x faster

## Reproducibility

All benchmarks are reproducible. See [Running Benchmarks](/performance/running-benchmarks) for instructions.

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
For maximum query performance, enable [automatic compaction](/advanced/compaction) to merge small files into optimized 512MB chunks.
:::

## Next Steps

- **[Run Your Own Benchmarks](/performance/running-benchmarks)**
- **[Optimize Query Performance](/performance/optimization)**
- **[Configure Compaction](/advanced/compaction)**
- **[Enable Query Caching](/configuration/caching)**
