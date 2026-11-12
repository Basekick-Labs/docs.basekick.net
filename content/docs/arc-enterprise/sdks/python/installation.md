---
title: "Install the Python SDK"
description: "Install arc-tsdb-client with pip and pick the pandas, polars, or full extras, then verify the connection against an Arc Enterprise endpoint using an RBAC-scoped API token."
---

How to install the Arc Python SDK and its optional dependencies.

## Requirements

- **Python 3.9+** (3.10+ recommended for best performance)
- **Arc server** running and accessible

## Basic installation

Install the core SDK with pip:

```bash
pip install arc-tsdb-client
```

This installs the minimal dependencies needed to connect to Arc and write/query data using JSON responses.

**Core dependencies:**
- `httpx` - HTTP client with connection pooling
- `msgpack` - Binary serialization for high-performance writes

## Optional dependencies

The SDK supports optional extras for DataFrame integration:

### pandas support

For `query_pandas()` and `write_dataframe()` with pandas:

```bash
pip install arc-tsdb-client[pandas]
```

**What it adds:**
- `pandas` - DataFrame library
- `pyarrow` - Required for efficient Arrow-to-pandas conversion

**Use when:** You're working in Jupyter notebooks, data science workflows, or need pandas DataFrames.

### Polars support

For `query_polars()` with the high-performance Polars library:

```bash
pip install arc-tsdb-client[polars]
```

**What it adds:**
- `polars` - Fast DataFrame library written in Rust
- `pyarrow` - Required for Arrow IPC parsing

**Use when:** You need maximum query performance, are processing large datasets, or prefer Polars' API.

### All dependencies

Install everything for full functionality:

```bash
pip install arc-tsdb-client[all]
```

**What it adds:**
- `pandas`
- `polars`
- `pyarrow`

**Use when:** You want access to all features without worrying about which extras you need.

## Using uv (recommended)

[uv](https://github.com/astral-sh/uv) is a fast Python package manager. Install the SDK with:

```bash
# Core only
uv add arc-tsdb-client

# With pandas
uv add arc-tsdb-client --extra pandas

# With all extras
uv add arc-tsdb-client --extra all
```

## Verifying installation

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

### Basic client setup

```python
from arc_client import ArcClient

client = ArcClient(
    host="localhost",       # Arc server hostname
    port=8000,              # Arc server port (default: 8000)
    token="your-token",     # API token (required)
    database=None,          # Optional; see "The database setting" below
    timeout=30.0,           # Request timeout in seconds
    compression=True,       # Enable gzip compression for writes
    ssl=False,              # Use HTTPS instead of HTTP
    verify_ssl=True,        # Verify SSL certificates
)
```

### Environment variables

You can also configure the client using environment variables:

```bash
export ARC_HOST="localhost"
export ARC_PORT="8000"
export ARC_TOKEN="your-token"
export ARC_DATABASE="iot"   # optional
```

```python
import os

ARC_TOKEN = os.environ["ARC_TOKEN"]
from arc_client import ArcClient

client = ArcClient(
    host=os.getenv("ARC_HOST", "localhost"),
    port=int(os.getenv("ARC_PORT", "8000")),
    token=os.getenv("ARC_TOKEN"),
    database=os.getenv("ARC_DATABASE"),  # None when unset
)
```

### The database setting

`database` is optional. Writes and imports go to `default` when it is unset.
From `arc-tsdb-client` 0.2.1, queries send it as `x-arc-database` only when it
is set: leave it unset to query any database by full name (`FROM iot.mem`),
or set it to query bare names in that database. A `database=` argument on a
call always wins. See [SQL syntax](/arc-enterprise/sdks/python/querying/#sql-syntax).

### Context manager (recommended)

Always use the client as a context manager to ensure proper connection cleanup:

```python
import asyncio
from arc_client import ArcClient, AsyncArcClient

# Sync client
with ArcClient(host="localhost", token="your-token") as client:
    # Use client...
    pass
# Connection automatically closed

# Async client (async with needs a coroutine)
async def main():
    async with AsyncArcClient(host="localhost", token="your-token") as client:
        # Use client...
        pass
    # Connection automatically closed

asyncio.run(main())
```

### Manual connection management

If you can't use a context manager:

```python
from arc_client import ArcClient

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

### Connection refused

Make sure Arc is running and accessible:

```bash
curl http://localhost:8000/health
```

### Authentication failed

Verify your token is correct:

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    result = client.auth.verify()
    if result.valid:
        print(f"Token is valid: {result.token_info.name}")
    else:
        print("Token is invalid")
```

## Next steps

- **[Data Ingestion](/arc-enterprise/sdks/python/ingestion/)** - Learn how to write data to Arc
- **[Querying](/arc-enterprise/sdks/python/querying/)** - Query data and work with DataFrames
- **[Data Management](/arc-enterprise/sdks/python/data-management/)** - Manage retention, CQs, and more
