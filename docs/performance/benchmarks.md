---
sidebar_position: 1
---

# Performance Benchmarks

Arc delivers industry-leading performance for time-series workloads. This page documents our benchmark methodology and results.

## Summary

| Metric | Result |
|--------|--------|
| **Ingestion (MessagePack)** | 18.6M records/sec |
| **Query (Arrow)** | 2.64M rows/sec |
| **Query (JSON)** | 2.23M rows/sec |
| **Line Protocol** | 1.92M records/sec |

## Test Hardware

**AMD Ryzen 9 5950X Workstation**
- **CPU**: AMD Ryzen 9 5950X (16 cores, 32 threads)
- **RAM**: 64 GB DDR4
- **Storage**: NVMe SSD

## Ingestion Throughput

Arc achieves **18.6 million records/second** on a single node using columnar MessagePack format.

### Test Environment
- CPU: AMD Ryzen 9 5950X (16 cores, 32 threads)
- RAM: 64 GB DDR4
- Storage: NVMe SSD
- Batch size: 10,000 records

### Results
- **Peak throughput**: 18.6M records/sec
- **Sustained throughput**: 15M+ records/sec
- **Write latency p50**: 2ms
- **Write latency p99**: Under 10ms

### MessagePack Columnar (Recommended)

The fastest ingestion method, using binary MessagePack with columnar data layout.

### Line Protocol

InfluxDB-compatible text protocol, suitable for existing tooling.

| Metric | Value |
|--------|-------|
| **Throughput** | 1.92M records/sec |
| **p50 Latency** | 49.53ms |
| **p99 Latency** | 108.53ms |

### Protocol Comparison

| Protocol | Throughput | Relative Speed |
|----------|------------|----------------|
| MessagePack Columnar | 18.6M rec/s | 100% (baseline) |
| Line Protocol | 1.92M rec/s | 10% |

**Why MessagePack is faster:**
- Binary format (no parsing overhead)
- Columnar layout matches Parquet storage
- Native gzip compression support
- Batch-optimized for high throughput

## Query Throughput

Arc delivers **2.64 million rows/second** for time-windowed aggregations.

### Test Query
```sql
SELECT
  time_bucket(INTERVAL '1 minute', time) AS bucket,
  AVG(value) AS avg_value
FROM prod.metrics
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket DESC;
```

### Results
- **Throughput**: 2.64M rows/sec
- **Latency (100K rows)**: Under 50ms
- **Latency (1M rows)**: Under 200ms

### Arrow IPC vs JSON

| Format | Throughput | Response Size (50K rows) |
|--------|------------|--------------------------|
| Arrow IPC | **2.64M rows/s** | 1.71 MB |
| JSON | 2.23M rows/s | 2.41 MB |

**Arrow advantages:**
- Zero-copy conversion to Pandas/Polars
- 29% smaller response payload
- Native columnar format
- Ideal for large result sets (10K+ rows)

## Go vs Python Implementation

Arc was rewritten from Python to Go, delivering significant improvements:

| Metric | Go | Python | Improvement |
|--------|-----|--------|-------------|
| Ingestion | 18.6M rec/s | 4.21M rec/s | **+342%** |
| Memory Stability | Stable | 372MB leak/500 queries | **Fixed** |
| Deployment | Single binary | Multi-worker processes | **Simpler** |
| Cold Start | &lt;100ms | 2-3 seconds | **20x faster** |

### Why Go is Faster

1. **Stable Memory**: Go's GC returns memory to OS. Python leaked memory under sustained load.
2. **Native Concurrency**: Goroutines handle thousands of connections with minimal overhead.
3. **Single Binary**: No Python interpreter or dependency management.
4. **Production GC**: Sub-millisecond pause times at scale.

## ClickBench Results

Industry-standard analytical query benchmark on the hits dataset.

**Test Environment:**
- **Instance**: AWS c6a.4xlarge (16 vCPU, 32GB RAM)
- **Dataset**: 100M rows (14GB Parquet)
- **Queries**: 43 analytical queries

| Run | Total Time | Queries |
|-----|------------|---------|
| Cold (cache flushed) | 120.25s | 43 |
| Warm | 35.70s | 43 |

### Comparison with Other TSDBs

| Database | Warm Run | Relative Speed |
|----------|----------|----------------|
| **Arc** | 35.70s | 1.00x (baseline) |
| QuestDB | 64.26s | 1.80x slower |
| TimescaleDB | 335.22s | 9.39x slower |

Arc is **1.80x faster than QuestDB** and **9.39x faster than TimescaleDB** in analytical workloads.

### Detailed Query Performance

All 43 analytical queries completed successfully:

| Query | Run 1 (Cold) | Run 2 | Run 3 (Best) | Speedup |
|-------|--------------|-------|--------------|---------|
| Q0 | 0.0656s | 0.0493s | 0.0372s | 1.76x |
| Q1 | 0.0788s | 0.0593s | 0.0628s | 1.25x |
| Q2 | 0.1617s | 0.1006s | 0.0838s | 1.93x |
| Q3 | 0.3933s | 0.1135s | 0.0866s | 4.54x |
| Q4 | 1.0929s | 0.3696s | 0.3703s | 2.95x |
| ... | ... | ... | ... | ... |

## Why Arc is Fast

### 1. DuckDB Query Engine

Arc leverages DuckDB's columnar execution engine:
- **Vectorized execution**: Process thousands of values per CPU instruction
- **Parallel query execution**: Utilize all CPU cores automatically
- **Advanced optimizations**: Join reordering, predicate pushdown, filter pushdown
- **SIMD instructions**: Use modern CPU features (AVX2, AVX-512)

### 2. Parquet Columnar Storage

- **Columnar format**: Read only columns needed for queries
- **Compression**: 80% smaller than raw data (Snappy/ZSTD)
- **Predicate pushdown**: Skip entire row groups based on statistics
- **Efficient scans**: DuckDB reads Parquet natively

### 3. Go Runtime Efficiency

- **Stable memory**: Go's GC returns memory to OS
- **Native concurrency**: Goroutines handle thousands of connections
- **Single binary**: No interpreter overhead
- **Sub-ms GC pauses**: Production-ready garbage collection

## Performance Tips

### Maximize Ingestion Throughput

1. **Use MessagePack columnar format**
   ```python
   data = {"m": "cpu", "columns": {...}}  # 18.6M rec/s
   # vs
   data = "cpu,host=x value=1"  # 1.92M rec/s
   ```

2. **Batch your writes** (10,000+ records per request)

3. **Enable gzip compression** for network efficiency

4. **Use multiple workers** (35 optimal for M3 Max)

### Maximize Query Throughput

1. **Use Arrow format** for large result sets (10K+ rows)
   ```python
   response = requests.post(url + "/api/v1/query/arrow", ...)
   ```

2. **Enable compaction** for query optimization
   ```toml
   [compaction]
   enabled = true
   ```

3. **Use time-range filters** (partition pruning)
   ```sql
   WHERE time > now() - INTERVAL '1 hour'
   ```

## Scaling Characteristics

### Vertical Scaling

- **CPU**: Near-linear scaling with core count
- **Memory**: Auto-configured to ~50% system RAM

### Storage Backend Impact

| Backend | Write Overhead | Query Overhead |
|---------|----------------|----------------|
| Local NVMe | Baseline | Baseline |
| MinIO (local) | +5-10% | +2-5% |
| AWS S3 | +20-30% | +10-20% |

## Reproducibility

Run benchmarks locally:

```bash
git clone https://github.com/basekick-labs/arc.git
cd arc
make bench
```

## Next Steps

- **[Getting Started](/arc/getting-started)** - Run Arc locally
- **[Configuration](/arc/configuration/overview)** - Tune for your workload
- **[Python SDK](/arc/sdks/python/)** - High-performance client
