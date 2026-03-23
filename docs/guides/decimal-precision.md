---
sidebar_position: 2
---

# Decimal Precision

:::info Available since v26.04.1
Native Decimal128 type support requires Arc v26.04.1 or later.
:::

Arc supports native Decimal128 columns for precision-sensitive use cases such as financial data, scientific measurements, and cryptocurrency trading. Declare decimal columns via per-measurement configuration, and Arc stores them as native Parquet DECIMAL type — preserving exact precision instead of coercing to float64.

## Why Decimal128?

IEEE 754 float64 has ~15-17 significant digits of precision. For financial data, this causes silent rounding:

```
float64(0.1 + 0.2) = 0.30000000000000004  // not 0.3
float64(9007199254740993) = 9007199254740992  // off by 1
```

Decimal128 provides up to 38 significant digits with exact precision — no rounding, no surprises.

## Configuration

Declare which columns should be stored as DECIMAL using the `[ingest]` configuration:

```toml
[ingest]
# Per-measurement decimal columns: "measurement:col=precision,scale;col2=p,s"
decimal_columns = [
  "trades:price=18,8;amount=18,8",
  "balances:balance=38,18"
]

# Default decimal columns for measurements not listed above (optional)
default_decimal_columns = "value=18,6"
```

**Environment variables:**

```bash
ARC_INGEST_DECIMAL_COLUMNS="trades:price=18,8;amount=18,8 balances:balance=38,18"
ARC_INGEST_DEFAULT_DECIMAL_COLUMNS="value=18,6"
```

### Format

Each entry follows the pattern `measurement:column=precision,scale;column2=precision,scale`:

| Component | Description | Range |
|-----------|-------------|-------|
| `measurement` | Target measurement name | Non-empty string |
| `column` | Column name to store as DECIMAL | Non-empty string |
| `precision` | Total significant digits | 1-38 |
| `scale` | Digits after decimal point | 0-precision |

**Common configurations:**

| Use Case | Config | Example Value |
|----------|--------|---------------|
| Cryptocurrency prices | `price=18,8` | `99999.12345678` |
| USD amounts | `amount=18,2` | `1234567890123456.78` |
| Scientific measurements | `reading=38,18` | `3.141592653589793238` |
| Integer counters (exact) | `count=38,0` | `99999999999999999999` |

## Ingestion

Decimal conversion happens automatically at ingestion time for configured columns. All ingestion paths are supported:

### MessagePack (Recommended)

**Float values** — converted via `decimal128.FromFloat64`:

```python
import msgpack
import urllib.request

payload = {
    "m": "trades",
    "t": 1711152000000000,
    "fields": {
        "price": 123.45678901,      # float64 → DECIMAL(18,8)
        "amount": 999.12345678,     # float64 → DECIMAL(18,8)
        "volume": 42,               # not configured → stays BIGINT
    },
    "tags": {"symbol": "BTC-USD"}
}

data = msgpack.packb(payload)
req = urllib.request.Request(
    "http://localhost:8000/api/v1/write/msgpack",
    data=data,
    headers={
        "Content-Type": "application/msgpack",
        "x-arc-database": "mydb",
    }
)
urllib.request.urlopen(req)
```

**String values** — for highest precision, send values as strings over MessagePack. String-to-decimal conversion is exact with no float64 intermediate:

```python
payload = {
    "m": "trades",
    "t": 1711152000000000,
    "fields": {
        "price": "99999.12345678",           # string → exact DECIMAL(18,8)
        "amount": "0.00000001",              # smallest representable at scale 8
    },
    "tags": {"symbol": "ETH-USD"}
}
```

:::tip Maximum Precision
For values requiring more than 15-17 significant digits, always send as strings over MessagePack. Float64 values lose precision beyond ~15 digits before they even reach Arc.
:::

### Line Protocol

Float values in Line Protocol are converted to the configured decimal type:

```bash
curl -X POST "http://localhost:8000/write?db=mydb" \
  -d 'trades,symbol=BTC-USD price=123.45678901,amount=999.12345678,volume=42i'
```

:::note
Line Protocol transmits all float values as text, so precision is preserved through the wire format. However, Arc's LP parser converts to float64 internally before decimal conversion — for maximum precision beyond 15 digits, use MessagePack with string values.
:::

## Querying

DuckDB reads Parquet DECIMAL type natively — no query changes needed:

```sql
SELECT price, amount, typeof(price) as price_type
FROM trades
LIMIT 5
```

Response:

```json
{
  "columns": ["price", "amount", "price_type"],
  "data": [
    ["123.45678901", "999.12345678", "DECIMAL(18,8)"],
    ["99999.12345678", "0.00000001", "DECIMAL(18,8)"]
  ]
}
```

All SQL operations work with decimal columns — aggregation, filtering, ordering, window functions:

```sql
-- Aggregation preserves decimal precision
SELECT symbol,
       AVG(price) as avg_price,
       SUM(amount) as total_amount,
       COUNT(*) as trade_count
FROM trades
GROUP BY symbol

-- Filtering works as expected
SELECT * FROM trades WHERE price > 50000.00

-- Arithmetic on decimal columns
SELECT price * amount as notional_value FROM trades
```

## How It Works

1. **Ingestion**: Float64, int64, or string values arriving for declared decimal columns are converted to Arrow Decimal128 at buffer time
2. **Storage**: Stored as Parquet DECIMAL logical type (16 bytes per value, exact precision)
3. **Metadata**: Decimal column specs are stored as Parquet metadata (`arc:decimals`) for self-describing files
4. **Querying**: DuckDB reads Parquet DECIMAL natively
5. **Compaction**: DuckDB preserves DECIMAL types automatically during compaction

## Performance

- **Zero overhead when not configured** — one empty map lookup per column during ingestion
- **Decimal conversion cost**: ~100ns per value. A flush batch of 50K rows with 2 decimal columns adds ~10ms (flush runs in background)
- **Storage**: 16 bytes per value (vs 8 bytes for float64) — 2x for decimal columns only
- **Query performance**: Identical to float64 — DuckDB handles DECIMAL natively

## Best Practices

1. **Use string values for maximum precision** — Send values as strings over MessagePack when precision beyond 15 significant digits is required.

2. **Choose precision and scale carefully** — Use the smallest precision/scale that fits your data. `price=18,8` handles up to 10 billion with 8 decimal places. Over-specifying (e.g., `38,18`) wastes no storage but may affect sort performance.

3. **Use default decimal columns sparingly** — Per-measurement config is preferred. Defaults apply to all measurements not explicitly listed, which may cause unexpected type conversions.

4. **Non-decimal columns are unaffected** — Columns not listed in the config continue to use automatic type detection (float64, int64, string, bool).

5. **Backwards compatible** — Files written before enabling decimal config have no decimal metadata and are read normally. You can enable decimal config on existing deployments without any migration.

## Troubleshooting

### Decimal config not taking effect

Check the Arc startup logs for:

```
WRN Invalid decimal columns config, decimal support disabled error="..."
```

This means the configuration format is invalid. Verify the format: `"measurement:col=precision,scale"`.

### Values still showing as float64

- Verify the column name in config matches exactly (case-sensitive)
- Check that the measurement name matches
- Use `typeof(column)` in SQL to verify: `SELECT typeof(price) FROM trades LIMIT 1`

### Scientific notation in query results

DuckDB may serialize very small decimals using scientific notation (e.g., `1e-08` instead of `0.00000001`). The underlying precision is preserved — this is a display format choice. Use `CAST(column AS VARCHAR)` for explicit string formatting.
