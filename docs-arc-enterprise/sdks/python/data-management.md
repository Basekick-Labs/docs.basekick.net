---
sidebar_position: 5
---

# Data Management

How to manage data lifecycle, authentication, and administrative tasks using the Python SDK.

## Overview

The SDK provides clients for managing Arc's data lifecycle features:

| Client | Purpose | Use Case |
|--------|---------|----------|
| `client.retention` | Retention policies | Delete old data on a schedule |
| `client.continuous_queries` | Continuous queries | Downsample and aggregate data |
| `client.delete` | Delete operations | Remove data matching conditions |
| `client.auth` | Authentication | Manage API tokens |

:::caution Manual Execution Required

**Important:** In Arc OSS, retention policies and continuous queries do **not** run automatically. You must execute them manually or set up an external scheduler (cron, Airflow, etc.).

Automatic scheduling is planned for **Arc Cloud** and **Arc Enterprise** (2026).

See [Scheduling with External Tools](#scheduling-with-external-tools) for how to automate execution.

:::

## Retention Policies

Retention policies define rules for deleting data older than a specified age. Use them to:
- Control storage costs
- Comply with data retention regulations
- Remove stale data on a schedule

### Create a Policy

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    policy = client.retention.create(
        name="logs-30d",
        database="default",
        retention_days=30,
        measurement="logs",    # Optional: applies to specific measurement
        buffer_days=7,         # Optional: keep extra days as safety buffer
    )

    print(f"Created policy: {policy.name} (id={policy.id})")
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `str` | Yes | Unique name for the policy |
| `database` | `str` | Yes | Target database |
| `retention_days` | `int` | Yes | Delete data older than N days |
| `measurement` | `str` | No | Limit to specific measurement (all if omitted) |
| `buffer_days` | `int` | No | Extra buffer days before deletion |

### List Policies

```python
policies = client.retention.list()

for p in policies:
    status = "active" if p.is_active else "inactive"
    measurement = p.measurement or "all measurements"
    print(f"{p.name}: {p.retention_days} days on {measurement} ({status})")
```

### Execute a Policy

Always use `dry_run=True` first to preview what will be deleted:

```python
# Preview deletion
result = client.retention.execute(policy.id, dry_run=True)
print(f"Would delete {result.deleted_count} rows")

# Execute for real (requires confirm=True for large deletes)
result = client.retention.execute(policy.id, dry_run=False, confirm=True)
print(f"Deleted {result.deleted_count} rows")
```

### Update a Policy

```python
client.retention.update(
    policy.id,
    retention_days=60,      # Change retention period
    is_active=False,        # Disable the policy
)
```

### Delete a Policy

```python
client.retention.delete(policy.id)
```

### Full Example

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # Create policy for logs
    policy = client.retention.create(
        name="logs-retention",
        database="default",
        retention_days=30,
        measurement="logs",
    )

    # Create policy for metrics (keep longer)
    metrics_policy = client.retention.create(
        name="metrics-retention",
        database="default",
        retention_days=90,
        measurement="metrics",
    )

    # List all policies
    for p in client.retention.list():
        print(f"  - {p.name}: {p.retention_days} days")

    # Dry run to see what would be deleted
    result = client.retention.execute(policy.id, dry_run=True)
    print(f"\nDry run: would delete {result.deleted_count} rows")
```

See [Retention Policies](/arc-enterprise/data-lifecycle/retention-policies) for more details on how retention works in Arc.

## Continuous Queries

Continuous queries (CQs) define aggregation rules that transform data from one measurement to another. Use them to:
- Downsample high-resolution data to save storage
- Pre-compute aggregations for faster dashboard queries
- Create materialized views of your data

:::note Execution Required
CQs define *what* to aggregate and *where* to store results. The `interval` parameter documents the intended frequency, but you must trigger execution manually or via an external scheduler. See [Scheduling with External Tools](#scheduling-with-external-tools).
:::

### Create a Continuous Query

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    cq = client.continuous_queries.create(
        name="cpu-hourly-avg",
        database="default",
        source_measurement="cpu",
        destination_measurement="cpu_1h",
        query="""
            SELECT
                time_bucket('1 hour', time) as time,
                host,
                avg(usage_idle) as usage_idle,
                avg(usage_system) as usage_system,
                max(usage_user) as max_usage_user
            FROM default.cpu
            GROUP BY 1, 2
        """,
        interval="1h",
        description="Hourly CPU averages per host",
    )

    print(f"Created CQ: {cq.name} (id={cq.id})")
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `str` | Yes | Unique name for the CQ |
| `database` | `str` | Yes | Target database |
| `source_measurement` | `str` | Yes | Measurement to read from |
| `destination_measurement` | `str` | Yes | Measurement to write results to |
| `query` | `str` | Yes | SQL aggregation query |
| `interval` | `str` | Yes | Execution interval (e.g., `1h`, `15m`, `1d`) |
| `description` | `str` | No | Human-readable description |

### Query Guidelines

Your CQ query should:
- Use `time_bucket()` to aggregate time into intervals
- Include `time` as the first column in SELECT and GROUP BY
- Use aggregate functions (`avg`, `sum`, `count`, `min`, `max`, etc.)
- Reference the source measurement with `database.measurement` syntax

### List Continuous Queries

```python
cqs = client.continuous_queries.list(database="default")

for cq in cqs:
    status = "active" if cq.is_active else "inactive"
    print(f"{cq.name}: {cq.source_measurement} → {cq.destination_measurement}")
    print(f"  Interval: {cq.interval} ({status})")
```

### Manual Execution

Execute a CQ manually for a specific time range:

```python
# Dry run first
result = client.continuous_queries.execute(
    cq.id,
    start_time="2024-01-01T00:00:00Z",
    end_time="2024-01-02T00:00:00Z",
    dry_run=True,
)
print(f"Would process {result.records_read or 0} records")
print(f"Would write {result.records_written or 0} records")

# Execute for real
result = client.continuous_queries.execute(
    cq.id,
    start_time="2024-01-01T00:00:00Z",
    end_time="2024-01-02T00:00:00Z",
    dry_run=False,
)
```

### Update a CQ

```python
client.continuous_queries.update(
    cq.id,
    interval="30m",       # Change interval
    is_active=False,      # Pause the CQ
)
```

### Delete a CQ

```python
client.continuous_queries.delete(cq.id)
```

### Full Example

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # Create hourly rollup
    hourly_cq = client.continuous_queries.create(
        name="cpu-hourly",
        database="default",
        source_measurement="cpu",
        destination_measurement="cpu_1h",
        query="""
            SELECT
                time_bucket('1 hour', time) as time,
                host,
                avg(usage_idle) as avg_idle,
                min(usage_idle) as min_idle,
                max(usage_idle) as max_idle
            FROM default.cpu
            GROUP BY 1, 2
        """,
        interval="1h",
    )

    # Create daily rollup from hourly data
    daily_cq = client.continuous_queries.create(
        name="cpu-daily",
        database="default",
        source_measurement="cpu_1h",
        destination_measurement="cpu_1d",
        query="""
            SELECT
                time_bucket('1 day', time) as time,
                host,
                avg(avg_idle) as avg_idle,
                min(min_idle) as min_idle,
                max(max_idle) as max_idle
            FROM default.cpu_1h
            GROUP BY 1, 2
        """,
        interval="1d",
    )

    print("Created CQ hierarchy: cpu → cpu_1h → cpu_1d")
```

See [Continuous Queries](/arc-enterprise/data-lifecycle/continuous-queries) for more details.

## Delete Operations

Delete data matching specific conditions. Use this for:
- Removing erroneous data
- Deleting data for specific hosts or time ranges
- GDPR/compliance data removal

### Delete with Conditions

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    # ALWAYS dry_run first!
    result = client.delete.delete(
        database="default",
        measurement="logs",
        where="time < '2024-01-01' AND level = 'debug'",
        dry_run=True,
    )
    print(f"Would delete {result.deleted_count} rows")
    print(f"Affected files: {result.affected_files}")

    # Execute deletion (requires confirm=True)
    result = client.delete.delete(
        database="default",
        measurement="logs",
        where="time < '2024-01-01' AND level = 'debug'",
        dry_run=False,
        confirm=True,
    )
    print(f"Deleted {result.deleted_count} rows")
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `database` | `str` | Yes | Target database |
| `measurement` | `str` | Yes | Target measurement |
| `where` | `str` | Yes | SQL WHERE clause (without "WHERE" keyword) |
| `dry_run` | `bool` | No | Preview only, don't delete (default: `True`) |
| `confirm` | `bool` | No | Required for large deletes |

### Common Delete Patterns

```python
# Delete old data
client.delete.delete(
    database="default",
    measurement="logs",
    where="time < '2024-01-01'",
    dry_run=False,
    confirm=True,
)

# Delete data for a specific host
client.delete.delete(
    database="default",
    measurement="metrics",
    where="host = 'decommissioned-server'",
    dry_run=False,
    confirm=True,
)

# Delete data in a time range
client.delete.delete(
    database="default",
    measurement="events",
    where="time BETWEEN '2024-01-15' AND '2024-01-16'",
    dry_run=False,
    confirm=True,
)
```

See [Delete Operations](/arc-enterprise/data-lifecycle/delete-operations) for more details.

## Authentication

Manage API tokens for accessing Arc.

### Verify Current Token

```python
from arc_client import ArcClient

with ArcClient(host="localhost", token="your-token") as client:
    result = client.auth.verify()

    if result.valid:
        print(f"Token name: {result.token_info.name}")
        print(f"Permissions: {result.permissions}")
        print(f"Created: {result.token_info.created_at}")
    else:
        print("Token is invalid or expired")
```

### Create a New Token

```python
result = client.auth.create_token(
    name="my-app-token",
    description="Token for my application",
    permissions=["read", "write"],
)

# IMPORTANT: Save this token - it's only shown once!
print(f"New token: {result.token}")
print(f"Token ID: {result.token_id}")
```

### Available Permissions

| Permission | Description |
|------------|-------------|
| `read` | Query data |
| `write` | Write/ingest data |
| `admin` | Manage tokens, retention policies, CQs |

### List Tokens

```python
tokens = client.auth.list_tokens()

for t in tokens:
    print(f"{t.name} (id={t.id})")
    print(f"  Created: {t.created_at}")
    print(f"  Last used: {t.last_used_at or 'never'}")
```

### Rotate a Token

Generate a new token value while keeping the same token ID and permissions:

```python
result = client.auth.rotate_token(token_id=123)

# IMPORTANT: Save the new token - the old one is now invalid!
print(f"New token: {result.new_token}")
```

### Revoke a Token

```python
client.auth.revoke_token(token_id=123)
print("Token revoked")
```

## Error Handling

All data management operations can raise specific exceptions:

```python
from arc_client import ArcClient
from arc_client.exceptions import (
    ArcError,
    ArcNotFoundError,
    ArcValidationError,
    ArcAuthenticationError,
)

with ArcClient(host="localhost", token="your-token") as client:
    try:
        client.retention.delete(999)  # Non-existent policy
    except ArcNotFoundError:
        print("Policy not found")

    try:
        client.retention.create(
            name="",  # Invalid name
            database="default",
            retention_days=-1,  # Invalid days
        )
    except ArcValidationError as e:
        print(f"Validation error: {e}")

    try:
        client.auth.create_token(name="test", permissions=["admin"])
    except ArcAuthenticationError:
        print("Current token doesn't have permission to create tokens")
```

## Async Support

All data management operations have async equivalents:

```python
import asyncio
from arc_client import AsyncArcClient

async def main():
    async with AsyncArcClient(host="localhost", token="your-token") as client:
        # Retention
        policy = await client.retention.create(
            name="async-policy",
            database="default",
            retention_days=30,
        )

        # CQs
        cq = await client.continuous_queries.create(
            name="async-cq",
            database="default",
            source_measurement="cpu",
            destination_measurement="cpu_1h",
            query="SELECT time_bucket('1 hour', time) as time, avg(usage) as usage FROM default.cpu GROUP BY 1",
            interval="1h",
        )

        # Delete
        result = await client.delete.delete(
            database="default",
            measurement="logs",
            where="time < '2024-01-01'",
            dry_run=True,
        )

        # Auth
        verify = await client.auth.verify()

asyncio.run(main())
```

## Best Practices

### 1. Always Dry Run First

For any destructive operation (delete, retention execution), always preview first:

```python
# ✅ Good: Preview before executing
result = client.delete.delete(..., dry_run=True)
print(f"Would delete {result.deleted_count} rows")
# Review the count, then execute

# ❌ Bad: Delete without preview
result = client.delete.delete(..., dry_run=False, confirm=True)
```

### 2. Use Descriptive Names

```python
# ✅ Good: Descriptive names
client.retention.create(name="logs-30d-cleanup", ...)
client.continuous_queries.create(name="cpu-hourly-avg-by-host", ...)

# ❌ Bad: Generic names
client.retention.create(name="policy1", ...)
```

### 3. Document Your CQ Queries

```python
# ✅ Good: Include description
cq = client.continuous_queries.create(
    name="cpu-hourly",
    description="Hourly CPU averages per host. Used by main dashboard.",
    ...
)
```

### 4. Secure Token Management

```python
# ✅ Good: Use environment variables
import os
token = os.getenv("ARC_TOKEN")
client = ArcClient(host="localhost", token=token)

# ❌ Bad: Hardcode tokens
client = ArcClient(host="localhost", token="arc_abc123...")
```

## Scheduling with External Tools

Since Arc OSS doesn't include a built-in scheduler, you need to trigger retention policies and continuous queries externally. Here are several approaches:

### Simple Python Script with Cron

Create a script that executes your policies and CQs:

```python title="arc_scheduler.py"
#!/usr/bin/env python3
"""Execute Arc retention policies and continuous queries."""

import logging
from datetime import datetime, timedelta
from arc_client import ArcClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_retention_policies(client: ArcClient):
    """Execute all active retention policies."""
    policies = client.retention.list()

    for policy in policies:
        if not policy.is_active:
            continue

        logger.info(f"Executing retention policy: {policy.name}")
        try:
            result = client.retention.execute(policy.id, dry_run=False, confirm=True)
            logger.info(f"  Deleted {result.deleted_count} rows")
        except Exception as e:
            logger.error(f"  Failed: {e}")

def run_continuous_queries(client: ArcClient):
    """Execute all active continuous queries for the last interval."""
    cqs = client.continuous_queries.list()

    for cq in cqs:
        if not cq.is_active:
            continue

        # Calculate time range based on CQ interval
        end_time = datetime.utcnow()
        # Parse interval (e.g., "1h" -> 1 hour)
        interval_hours = parse_interval_hours(cq.interval)
        start_time = end_time - timedelta(hours=interval_hours)

        logger.info(f"Executing CQ: {cq.name} ({start_time} to {end_time})")
        try:
            result = client.continuous_queries.execute(
                cq.id,
                start_time=start_time.isoformat() + "Z",
                end_time=end_time.isoformat() + "Z",
                dry_run=False,
            )
            logger.info(f"  Processed {result.records_read or 0} records")
        except Exception as e:
            logger.error(f"  Failed: {e}")

def parse_interval_hours(interval: str) -> int:
    """Parse interval string to hours (e.g., '1h' -> 1, '1d' -> 24)."""
    if interval.endswith("h"):
        return int(interval[:-1])
    elif interval.endswith("d"):
        return int(interval[:-1]) * 24
    elif interval.endswith("m"):
        return max(1, int(interval[:-1]) // 60)
    return 1

def main():
    import os

    with ArcClient(
        host=os.getenv("ARC_HOST", "localhost"),
        port=int(os.getenv("ARC_PORT", "8000")),
        token=os.getenv("ARC_TOKEN"),
    ) as client:
        logger.info("Starting scheduled Arc maintenance...")

        run_retention_policies(client)
        run_continuous_queries(client)

        logger.info("Scheduled maintenance complete")

if __name__ == "__main__":
    main()
```

Schedule with cron (run hourly):

```bash
# Edit crontab
crontab -e

# Add entry to run every hour
0 * * * * cd /path/to/project && ARC_TOKEN=your-token python arc_scheduler.py >> /var/log/arc_scheduler.log 2>&1
```

### Using APScheduler

For more control, use [APScheduler](https://apscheduler.readthedocs.io/) to run different tasks at different intervals:

```python title="arc_scheduler_advanced.py"
#!/usr/bin/env python3
"""Advanced Arc scheduler with APScheduler."""

import os
import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from arc_client import ArcClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_client():
    return ArcClient(
        host=os.getenv("ARC_HOST", "localhost"),
        token=os.getenv("ARC_TOKEN"),
    )

def execute_hourly_cqs():
    """Run CQs with 1h interval."""
    logger.info("Running hourly CQs...")
    with get_client() as client:
        for cq in client.continuous_queries.list():
            if cq.is_active and cq.interval == "1h":
                try:
                    client.continuous_queries.execute(cq.id, dry_run=False)
                    logger.info(f"  Executed: {cq.name}")
                except Exception as e:
                    logger.error(f"  Failed {cq.name}: {e}")

def execute_daily_retention():
    """Run retention policies once per day."""
    logger.info("Running daily retention...")
    with get_client() as client:
        for policy in client.retention.list():
            if policy.is_active:
                try:
                    result = client.retention.execute(
                        policy.id, dry_run=False, confirm=True
                    )
                    logger.info(f"  {policy.name}: deleted {result.deleted_count} rows")
                except Exception as e:
                    logger.error(f"  Failed {policy.name}: {e}")

if __name__ == "__main__":
    scheduler = BlockingScheduler()

    # Run hourly CQs every hour at :05
    scheduler.add_job(execute_hourly_cqs, "cron", minute=5)

    # Run retention policies daily at 3:00 AM
    scheduler.add_job(execute_daily_retention, "cron", hour=3, minute=0)

    logger.info("Arc scheduler started. Press Ctrl+C to exit.")
    scheduler.start()
```

Install and run:

```bash
pip install apscheduler
python arc_scheduler_advanced.py
```

### Docker Deployment

Run the scheduler as a Docker container alongside Arc:

```yaml title="docker-compose.yml"
services:
  arc:
    image: ghcr.io/basekick-labs/arc:latest
    ports:
      - "8000:8000"
    volumes:
      - arc-data:/app/data

  arc-scheduler:
    build:
      context: .
      dockerfile: Dockerfile.scheduler
    environment:
      - ARC_HOST=arc
      - ARC_PORT=8000
      - ARC_TOKEN=${ARC_TOKEN}
    depends_on:
      - arc
    restart: unless-stopped

volumes:
  arc-data:
```

```dockerfile title="Dockerfile.scheduler"
FROM python:3.11-slim
WORKDIR /app
RUN pip install arc-tsdb-client apscheduler
COPY arc_scheduler_advanced.py .
CMD ["python", "arc_scheduler_advanced.py"]
```

### Kubernetes CronJob

For Kubernetes deployments, use a CronJob:

```yaml title="arc-scheduler-cronjob.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: arc-maintenance
spec:
  schedule: "0 * * * *"  # Every hour
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: arc-scheduler
            image: python:3.11-slim
            command:
            - /bin/sh
            - -c
            - |
              pip install -q arc-tsdb-client
              python -c "
              from arc_client import ArcClient
              import os

              with ArcClient(
                  host=os.environ['ARC_HOST'],
                  token=os.environ['ARC_TOKEN']
              ) as client:
                  # Execute retention policies
                  for p in client.retention.list():
                      if p.is_active:
                          client.retention.execute(p.id, dry_run=False, confirm=True)

                  # Execute continuous queries
                  for cq in client.continuous_queries.list():
                      if cq.is_active:
                          client.continuous_queries.execute(cq.id, dry_run=False)
              "
            env:
            - name: ARC_HOST
              value: "arc-service"
            - name: ARC_TOKEN
              valueFrom:
                secretKeyRef:
                  name: arc-secrets
                  key: token
          restartPolicy: OnFailure
```

### Apache Airflow

For complex workflows, use Airflow:

```python title="dags/arc_maintenance.py"
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "data-team",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
}

def run_retention():
    from arc_client import ArcClient
    import os

    with ArcClient(host=os.getenv("ARC_HOST"), token=os.getenv("ARC_TOKEN")) as client:
        for policy in client.retention.list():
            if policy.is_active:
                client.retention.execute(policy.id, dry_run=False, confirm=True)

def run_hourly_cqs():
    from arc_client import ArcClient
    import os

    with ArcClient(host=os.getenv("ARC_HOST"), token=os.getenv("ARC_TOKEN")) as client:
        for cq in client.continuous_queries.list():
            if cq.is_active and cq.interval == "1h":
                client.continuous_queries.execute(cq.id, dry_run=False)

with DAG(
    "arc_maintenance",
    default_args=default_args,
    schedule_interval="@hourly",
    start_date=datetime(2024, 1, 1),
    catchup=False,
) as dag:

    retention_task = PythonOperator(
        task_id="run_retention",
        python_callable=run_retention,
    )

    cq_task = PythonOperator(
        task_id="run_hourly_cqs",
        python_callable=run_hourly_cqs,
    )

    retention_task >> cq_task
```

## Next Steps

- **[Data Ingestion](/arc-enterprise/sdks/python/ingestion)** - Write data to Arc
- **[Querying](/arc-enterprise/sdks/python/querying)** - Query data with DataFrames
- **[Retention Policies](/arc-enterprise/data-lifecycle/retention-policies)** - Deep dive on retention
- **[Continuous Queries](/arc-enterprise/data-lifecycle/continuous-queries)** - Deep dive on CQs
