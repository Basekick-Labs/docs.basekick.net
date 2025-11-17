---
sidebar_position: 3
---

# VS Code Extension

Complete development toolkit for Arc Database directly in Visual Studio Code.

## Overview

The Arc Database Manager extension provides a full-featured IDE for working with Arc:

- **Connection Management**: Multiple saved connections with secure token storage
- **SQL IntelliSense**: Auto-completion for tables, columns, and DuckDB functions
- **Interactive Results**: Export to CSV/JSON/Markdown with automatic chart visualization
- **Arc Notebooks**: Mix SQL and Markdown in `.arcnb` files with parameterized queries
- **Schema Explorer**: Browse databases and tables with context menus
- **Data Ingestion**: CSV import wizard and bulk data generator
- **Alerting**: Create query-based alerts with desktop notifications
- **Query Management**: Automatic history and saved queries
- **Dark Mode**: Automatic theme detection and adaptation

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Click **Extensions** (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for **"Arc Database Manager"**
4. Click **Install**

Or install directly from the marketplace:
- **[Arc Database Manager on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=basekick-labs.arc-db-manager)**

### From Command Line

```bash
code --install-extension basekick-labs.arc-db-manager
```

## Quick Start

### 1. Connect to Arc Server

**Option A: From Status Bar**
1. Click **"Arc: Not Connected"** in the status bar
2. Enter connection details:
   - Name: `My Arc Server`
   - Host: `localhost`
   - Port: `8000`
   - Protocol: `http` or `https`
3. Enter your authentication token

**Option B: From Command Palette**
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type `Arc: Connect to Server`
3. Follow the prompts

### 2. Get Your API Token

```bash
# Docker - check logs for admin token
docker logs <container-id> 2>&1 | grep "Admin token"

# Or create a new token
curl -X POST http://localhost:8000/api/v1/auth/tokens \
  -H "Authorization: Bearer $ARC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vscode-extension",
    "description": "VS Code extension access"
  }'
```

### 3. Start Querying

1. Press `Ctrl+Shift+P` → `Arc: New Query`
2. Write your SQL query
3. Press `Ctrl+Enter` / `Cmd+Enter` to execute

**Example Query:**
```sql
SELECT
  time_bucket(INTERVAL '5 minutes', time) as bucket,
  AVG(usage_idle) * -1 + 100 AS cpu_usage,
  host
FROM prod.cpu
WHERE cpu = 'cpu-total'
  AND time > NOW() - INTERVAL '1 hour'
GROUP BY bucket, host
ORDER BY bucket ASC;
```

## Features

### SQL IntelliSense

Get auto-completion for:
- Database names
- Table names
- Column names
- DuckDB functions
- SQL keywords

**How to use:**
- Start typing and IntelliSense will suggest completions
- Press `Ctrl+Space` to manually trigger suggestions
- Navigate with arrow keys, press `Enter` to accept

### Interactive Results View

After executing a query, results are displayed with:

**Export Options:**
- CSV format
- JSON format
- Markdown tables

**Automatic Visualizations:**
- Time-series data is automatically charted
- Line charts for temporal data
- Theme-aware (adapts to VS Code theme)

**Table Features:**
- Sort by clicking column headers
- Filter rows with search
- View execution time and row count

### Arc Notebooks

Create analysis documents mixing SQL and Markdown in `.arcnb` files.

**Create a Notebook:**
1. Press `Ctrl+Shift+P` → `Arc: New Notebook`
2. Save with `.arcnb` extension

**Notebook Features:**
- Mix Markdown documentation with SQL queries
- Parameterized queries with variable substitution
- Execute cells individually or all at once
- Export to Markdown with results
- Auto-save functionality

**Example Notebook:**
```markdown
# CPU Performance Analysis

This notebook analyzes CPU usage patterns over time.

Variables:
- interval = 1 HOUR
- threshold = 80
- database = prod

## Average CPU Usage

SELECT
  time_bucket(INTERVAL '5 minutes', time) as bucket,
  AVG(usage_user) as avg_cpu,
  host
FROM ${database}.cpu
WHERE time > NOW() - INTERVAL ${interval}
  AND usage_user > ${threshold}
GROUP BY bucket, host
ORDER BY bucket DESC;

## Results

The query shows periods where CPU exceeded ${threshold}% in the last ${interval}.
```

**Variable Syntax:**
- Define variables in YAML frontmatter
- Reference with `${variable_name}`
- Variables are replaced before execution

### Schema Explorer

Browse your Arc databases and tables in the sidebar.

**Features:**
- Hierarchical view of databases and tables
- Connection status indicator
- Visual refresh button

**Right-Click Context Menus:**

**On Tables:**
- **Show Table Schema** - View column names and types
- **Preview Data** - Show first 100 rows
- **Show Table Statistics** - Row count and size
- **Generate SELECT Query** - Create basic query
- **Query Last Hour** - Filter to recent data
- **Query Today** - Filter to today's data

**Example: Show Table Schema**
```
Right-click table → Show Table Schema

Result:
┌────────────┬──────────┐
│ Column     │ Type     │
├────────────┼──────────┤
│ time       │ TIMESTAMP│
│ host       │ VARCHAR  │
│ usage_idle │ DOUBLE   │
│ usage_user │ DOUBLE   │
└────────────┴──────────┘
```

### Data Ingestion

#### CSV Import Wizard

Import CSV files directly into Arc with guided setup.

**Steps:**
1. Press `Ctrl+Shift+P` → `Arc: Import CSV`
2. Select your CSV file
3. Configure import settings:
   - Auto-detect delimiter and headers
   - Select timestamp column
   - Choose target database
   - Set batch size

**Performance:**
- ~50,000-100,000 rows/second
- Uses MessagePack columnar format
- Progress tracking for large files
- Batch processing support

**Example:**
```
Import Settings:
- File: metrics.csv
- Delimiter: , (auto-detected)
- Timestamp Column: time
- Database: prod
- Measurement: custom_metrics
- Batch Size: 10,000

Result: 250,000 rows imported in 3.2 seconds
```

#### Bulk Data Generator

Generate test data for development and testing.

**Presets:**
1. **CPU Metrics** - System CPU usage data
2. **Memory Metrics** - Memory usage statistics
3. **Network Metrics** - Network traffic data
4. **IoT Sensor Data** - Temperature, humidity sensors
5. **Custom Schema** - Define your own fields

**Steps:**
1. Press `Ctrl+Shift+P` → `Arc: Generate Test Data`
2. Select preset
3. Configure:
   - Number of rows
   - Target database
   - Time range

**Performance:**
- ~100,000-200,000 rows/second
- Realistic sample data
- Configurable patterns

### Alerting & Monitoring

Create alerts based on query results with desktop notifications.

**Create an Alert:**
1. Press `Ctrl+Shift+P` → `Arc: Create Alert`
2. Configure alert:
   - Name
   - SQL query
   - Condition type
   - Threshold value
   - Check interval

**Condition Types:**
- Greater than
- Less than
- Equals
- Not equals
- Contains

**Example Alert:**
```
Name: High CPU Usage
Query: SELECT AVG(usage_user) as cpu FROM prod.cpu WHERE time > NOW() - INTERVAL '5 minutes'
Condition: greater_than
Threshold: 80
Interval: 60s
```

**Alert Features:**
- Desktop notifications when triggered
- Alert history tracking
- Enable/disable without deletion
- Minimum check interval: 10 seconds

### Query Management

**Query History:**
- Every executed query is automatically saved
- View execution time and row counts
- Quick re-run from history
- Search through past queries

**Saved Queries:**
- Bookmark frequently used queries
- Organize by tags or folders
- Quick access from sidebar

**Access:**
1. Open Arc sidebar
2. Navigate to **Query History** or **Saved Queries**
3. Click query to view or re-run

### Token Management

Manage Arc authentication tokens directly from VS Code.

**Features:**
- Create new tokens
- Rotate existing tokens
- Delete tokens
- Verify token validity
- Secure storage in system keychain

**Access:**
1. Press `Ctrl+Shift+P`
2. Type `Arc: Manage Tokens`
3. Select action

## Commands

Access all commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### Connection
- `Arc: Connect to Server`
- `Arc: Disconnect`
- `Arc: Verify Token`
- `Arc: Manage Tokens`

### Queries
- `Arc: New Query`
- `Arc: Execute Query` (Ctrl+Enter / Cmd+Enter)
- `Arc: Save Current Query`
- `Arc: Open Query History`

### Notebooks
- `Arc: New Notebook`
- `Arc: Execute Notebook Cell`
- `Arc: Execute All Cells`
- `Arc: Export Notebook to Markdown`

### Data
- `Arc: Import CSV`
- `Arc: Generate Test Data`

### Alerts
- `Arc: Create Alert`
- `Arc: View Alerts`
- `Arc: Enable/Disable Alert`

### Explorer
- `Arc: Refresh Explorer`
- `Arc: Show Table Schema`
- `Arc: Preview Table Data`
- `Arc: Show Table Statistics`

## Keyboard Shortcuts

| Command | Windows/Linux | macOS |
|---------|--------------|-------|
| Execute Query | `Ctrl+Enter` | `Cmd+Enter` |
| New Query | `Ctrl+Shift+P` → Arc: New Query | `Cmd+Shift+P` → Arc: New Query |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Toggle Sidebar | `Ctrl+B` | `Cmd+B` |

## Extension Settings

Configure extension defaults in VS Code settings:

```json
{
  "arc.defaultHost": "localhost",
  "arc.defaultPort": 8000,
  "arc.defaultProtocol": "http"
}
```

**Available Settings:**

| Setting | Description | Default |
|---------|-------------|---------|
| `arc.defaultHost` | Default Arc server host | `localhost` |
| `arc.defaultPort` | Default Arc server port | `8000` |
| `arc.defaultProtocol` | Default protocol | `http` |

## Use Cases

### Development & Testing

**Generate Test Data:**
```
1. Arc: Generate Test Data
2. Select: CPU Metrics
3. Rows: 100,000
4. Database: dev
5. Time Range: Last 24 hours

Result: Realistic CPU metrics for testing
```

**Query the Data:**
```sql
SELECT
  time_bucket(INTERVAL '5 minutes', time) as bucket,
  AVG(usage_user) as avg_cpu
FROM dev.cpu
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket DESC;
```

### Data Analysis

Create analysis notebooks (`.arcnb`) with:
- Documentation in Markdown
- Parameterized SQL queries
- Inline results and charts
- Export to Markdown reports

**Example Use Case:**
```markdown
# Weekly Performance Report

Variables:
- week_start = 2025-01-10
- database = prod

## CPU Trends

SELECT
  DATE_TRUNC('day', time) as day,
  AVG(usage_user) as avg_cpu
FROM ${database}.cpu
WHERE time >= '${week_start}'
GROUP BY day
ORDER BY day;
```

### Production Monitoring

**Create Alert:**
```
Name: High Memory Usage
Query: SELECT AVG(used_percent) FROM prod.mem WHERE time > NOW() - INTERVAL '5 minutes'
Condition: greater_than
Threshold: 90
Interval: 60s

→ Desktop notification when memory exceeds 90%
```

### Data Migration

**Import CSV Files:**
```
1. Arc: Import CSV
2. Select file: server_metrics.csv
3. Auto-detect: delimiter, headers
4. Set timestamp column: timestamp
5. Target: prod.imported_metrics
6. Batch size: 10,000

→ Import complete with progress tracking
```

## Performance

- **Query Results**: Displays up to 1,000 rows instantly
- **CSV Import**: ~50,000-100,000 rows/second
- **Data Generator**: ~100,000-200,000 rows/second
- **Batch Processing**: Handles millions of rows with progress tracking

## Troubleshooting

### Cannot Connect to Arc Server

```bash
# 1. Verify Arc is running
curl http://localhost:8000/health

# 2. Check connection details
- Host: localhost
- Port: 8000
- Protocol: http

# 3. Verify token
Arc: Verify Token (from Command Palette)
```

### Query Timeout

**Solutions:**
1. Add time filters:
```sql
WHERE time > NOW() - INTERVAL '1 hour'
```

2. Add `LIMIT` clause:
```sql
LIMIT 1000
```

3. Check Arc server performance:
```bash
curl http://localhost:8000/api/v1/compaction/trigger \
  -H "Authorization: Bearer $ARC_TOKEN"
```

### CSV Import Fails

**Common Issues:**
1. **Encoding**: Ensure UTF-8 encoding
2. **Delimiter**: Verify delimiter is correct (auto-detect usually works)
3. **File Size**: Try smaller file first to test
4. **Timestamp Format**: Ensure timestamp column is recognized

**Check Import Settings:**
```
File encoding: UTF-8
Delimiter: , (comma)
Headers: First row
Timestamp column: time
Format: ISO 8601 or Unix timestamp
```

### Extension Not Activating

1. **Check VS Code version**: Requires 1.85.0 or higher
2. **View Output**: View → Output → Arc Database Manager
3. **Reload Window**: Ctrl+Shift+P → Reload Window
4. **Reinstall**: Uninstall and reinstall extension

### IntelliSense Not Working

1. **Refresh Schema**: Right-click in Arc Explorer → Refresh
2. **Reconnect**: Disconnect and reconnect to server
3. **Check Connection**: Ensure server is connected (status bar)

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Arc Database**: Running instance (v1.0.0+)
- **Authentication Token**: Valid Arc API token

## Release Notes

### 0.2.0 - Latest

**New Features:**
- Auto-qualified table names in queries
- Right-click queries include database prefix (e.g., `prod.cpu`)

**Improvements:**
- Fixed query generation to read metadata correctly
- All context menu queries now work without manual editing

### 0.1.9

**⚠️ Breaking Changes:**
- Updated all API endpoints to `/api/v1/` prefix
- Requires Arc v1.0.0 or later
- Not compatible with pre-v1.0 Arc servers

**Migration:**
1. Upgrade Arc to v1.0.0+
2. Update extension to v0.1.9
3. Reconnect to Arc server

## Resources

- **[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=basekick-labs.arc-db-manager)**
- **[GitHub Repository](https://github.com/basekick-labs/arc-vscode-extension)**
- **[Arc Documentation](https://docs.basekick.net)**
- **[Report Issues](https://github.com/basekick-labs/arc-vscode-extension/issues)**

## Next Steps

- **[Getting Started with Arc](/arc/getting-started)** - Install and configure Arc
- **[Query API Reference](/arc/api-reference/overview)** - Learn Arc SQL
- **[Grafana Integration](/arc/integrations/grafana)** - Build dashboards
- **[Telegraf Integration](/arc/integrations/telegraf)** - Collect system metrics

---

**Enjoy using Arc Database Manager!**

Made with ❤️ by [Basekick Labs](https://github.com/basekick-labs)
