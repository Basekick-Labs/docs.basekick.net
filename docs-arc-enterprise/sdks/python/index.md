---
sidebar_position: 1
---

# Python SDK

Official Python SDK for Arc time-series database.

[![PyPI version](https://badge.fury.io/py/arc-tsdb-client.svg)](https://badge.fury.io/py/arc-tsdb-client)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)

## What is it?

The `arc-tsdb-client` package is the official Python client for [Arc](https://github.com/basekick-labs/arc), a high-performance time-series database. It provides a high-level, Pythonic interface for:

- **Writing time-series data** at scale (9M+ records/sec)
- **Querying with SQL** and getting results as DataFrames
- **Managing data lifecycle** (retention, aggregation, deletion)
- **Handling authentication** (tokens, permissions)

## Why use the SDK?

While you can interact with Arc's REST API directly, the SDK provides significant advantages:

| Feature | Raw API | Python SDK |
|---------|---------|------------|
| Connection management | Manual | Automatic (context managers) |
| Data serialization | Manual MessagePack | Automatic |
| DataFrame support | Convert manually | Native pandas/polars/arrow |
| Buffered writes | Implement yourself | Built-in with auto-batching |
| Error handling | Parse HTTP responses | Typed exceptions |
| Async support | Manual httpx/aiohttp | Built-in `AsyncArcClient` |
| Compression | Configure headers | Automatic gzip |

## Quick Example

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # Write metrics
    client.write.write_columnar(
        measurement="cpu",
        columns={
            "time": [1704067200000000, 1704067260000000],
            "host": ["server01", "server01"],
            "usage_idle": [95.2, 94.8],
        },
    )

    # Query to pandas
    df = client.query.query_pandas(
        "SELECT * FROM default.cpu WHERE host = 'server01'"
    )
    print(df)
```

## Architecture

The SDK is organized into specialized clients for different operations:

```
ArcClient
├── .write          # Data ingestion (WriteClient)
│   ├── write_columnar()
│   ├── write_dataframe()
│   ├── write_line_protocol()
│   └── buffered()
│
├── .query          # Data querying (QueryClient)
│   ├── query()
│   ├── query_pandas()
│   ├── query_polars()
│   ├── query_arrow()
│   └── estimate()
│
├── .retention      # Retention policies (RetentionClient)
├── .continuous_queries  # CQs (ContinuousQueryClient)
├── .delete         # Delete operations (DeleteClient)
├── .auth           # Authentication (AuthClient)
└── .health()       # Health check
```

## Documentation

<div className="row">
  <div className="col col--6 margin-bottom--lg">
    <div className="card">
      <div className="card__header">
        <h3>📦 Installation</h3>
      </div>
      <div className="card__body">
        <p>Install the SDK and optional dependencies for pandas, polars, or all features.</p>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="/arc-enterprise/sdks/python/installation">Get Started</a>
      </div>
    </div>
  </div>
  <div className="col col--6 margin-bottom--lg">
    <div className="card">
      <div className="card__header">
        <h3>📥 Data Ingestion</h3>
      </div>
      <div className="card__body">
        <p>Write data using columnar format, DataFrames, buffered writes, or line protocol.</p>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="/arc-enterprise/sdks/python/ingestion">Learn More</a>
      </div>
    </div>
  </div>
  <div className="col col--6 margin-bottom--lg">
    <div className="card">
      <div className="card__header">
        <h3>🔍 Querying</h3>
      </div>
      <div className="card__body">
        <p>Run SQL queries and get results as JSON, pandas, polars, or PyArrow tables.</p>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="/arc-enterprise/sdks/python/querying">Learn More</a>
      </div>
    </div>
  </div>
  <div className="col col--6 margin-bottom--lg">
    <div className="card">
      <div className="card__header">
        <h3>🔄 Data Management</h3>
      </div>
      <div className="card__body">
        <p>Manage retention policies, continuous queries, delete operations, and authentication.</p>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="/arc-enterprise/sdks/python/data-management">Learn More</a>
      </div>
    </div>
  </div>
</div>

## Source Code

- **Repository**: [github.com/basekick-labs/arc-client-python](https://github.com/basekick-labs/arc-client-python)
- **PyPI**: [pypi.org/project/arc-tsdb-client](https://pypi.org/project/arc-tsdb-client/)
