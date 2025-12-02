---
sidebar_position: 2
---

# Installation

How to install the Arc Python SDK and its optional dependencies.

## Requirements

- **Python 3.9+** (3.10+ recommended for best performance)
- **Arc server** running and accessible

## Basic Installation

Install the core SDK with pip:

```bash
pip install arc-tsdb-client
```

This installs the minimal dependencies needed to connect to Arc and write/query data using JSON responses.

**Core dependencies:**
- `httpx` - HTTP client with connection pooling
- `msgpack` - Binary serialization for high-performance writes

## Optional Dependencies

The SDK supports optional extras for DataFrame integration:

### pandas Support

For `query_pandas()` and `write_dataframe()` with pandas:

```bash
pip install arc-tsdb-client[pandas]
```

**What it adds:**
- `pandas` - DataFrame library
- `pyarrow` - Required for efficient Arrow-to-pandas conversion

**Use when:** You're working in Jupyter notebooks, data science workflows, or need pandas DataFrames.

### Polars Support

For `query_polars()` with the high-performance Polars library:

```bash
pip install arc-tsdb-client[polars]
```

**What it adds:**
- `polars` - Fast DataFrame library written in Rust
- `pyarrow` - Required for Arrow IPC parsing

**Use when:** You need maximum query performance, are processing large datasets, or prefer Polars' API.

### All Dependencies

Install everything for full functionality:

```bash
pip install arc-tsdb-client[all]
```

**What it adds:**
- `pandas`
- `polars`
- `pyarrow`

**Use when:** You want access to all features without worrying about which extras you need.

## Using uv (Recommended)

[uv](https://github.com/astral-sh/uv) is a fast Python package manager. Install the SDK with:

```bash
# Core only
uv add arc-tsdb-client

# With pandas
uv add arc-tsdb-client --extra pandas

# With all extras
uv add arc-tsdb-client --extra all
```

## Verifying Installation

Test that the SDK is installed correctly:

```python
from arc_client import ArcClient, AsyncArcClient

# Check version
import arc_client
print(f"arc-tsdb-client version: {arc_client.__version__}")

# Test connection
with ArcClient(host="localhost", token="your-token") as client:
    health = client.health()
    print(f"Server status: {health.status}")
```

## Configuration

### Basic Client Setup

```python
from arc_client import ArcClient

client = ArcClient(
    host="localhost",       # Arc server hostname
    port=8000,              # Arc server port (default: 8000)
    token="your-token",     # API token (required)
    database="default",     # Default database for queries
    timeout=30.0,           # Request timeout in seconds
    compression=True,       # Enable gzip compression for writes
    ssl=False,              # Use HTTPS instead of HTTP
    verify_ssl=True,        # Verify SSL certificates
)
```

### Environment Variables

You can also configure the client using environment variables:

```bash
export ARC_HOST="localhost"
export ARC_PORT="8000"
export ARC_TOKEN="your-token"
export ARC_DATABASE="default"
```

```python
import os
from arc_client import ArcClient

client = ArcClient(
    host=os.getenv("ARC_HOST", "localhost"),
    port=int(os.getenv("ARC_PORT", "8000")),
    token=os.getenv("ARC_TOKEN"),
    database=os.getenv("ARC_DATABASE", "default"),
)
```

### Context Manager (Recommended)

Always use the client as a context manager to ensure proper connection cleanup:

```python
# Sync client
with ArcClient(host="localhost", token="your-token") as client:
    # Use client...
    pass
# Connection automatically closed

# Async client
async with AsyncArcClient(host="localhost", token="your-token") as client:
    # Use client...
    pass
# Connection automatically closed
```

### Manual Connection Management

If you can't use a context manager:

```python
client = ArcClient(host="localhost", token="your-token")
try:
    # Use client...
    pass
finally:
    client.close()
```

## Troubleshooting

### ImportError: No module named 'pandas'

You need to install the pandas extra:

```bash
pip install arc-tsdb-client[pandas]
```

### ImportError: No module named 'polars'

You need to install the polars extra:

```bash
pip install arc-tsdb-client[polars]
```

### Connection Refused

Make sure Arc is running and accessible:

```bash
curl http://localhost:8000/health
```

### Authentication Failed

Verify your token is correct:

```python
with ArcClient(host="localhost", token="your-token") as client:
    result = client.auth.verify()
    if result.valid:
        print(f"Token is valid: {result.token_info.name}")
    else:
        print("Token is invalid")
```

## Next Steps

- **[Data Ingestion](/arc/sdks/python/ingestion)** - Learn how to write data to Arc
- **[Querying](/arc/sdks/python/querying)** - Query data and work with DataFrames
- **[Data Management](/arc/sdks/python/data-management)** - Manage retention, CQs, and more
