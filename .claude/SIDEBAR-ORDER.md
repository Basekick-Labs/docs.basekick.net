# Sidebar order to reproduce in meta.json

Derived from the live site: directory layout + sidebar_position +
_category_.json. Reproduce this order EXACTLY in each meta.json `pages`
array. Ties below were resolved by Docusaurus's alphabetical tiebreak -
pin the order shown, do not re-sort.


## arc  (from docs/)

```json
// content/docs/arc/meta.json
{
  "title": "Arc",
  "root": true,
  "pages": [
    "index",
    "getting-started",
    "installation",
    "configuration",
    "performance",
    "api-reference",
    "data-import",
    "migration",
    "guides",
    "data-lifecycle",
    "integrations",
    "advanced",
    "cli",
    "operations",
    "sdks",
    "changelog"
  ]
}
```

     1.0  file  intro    (intro)
     2.0  file  getting-started    (getting-started)
     2.0  dir   installation    (Installation)
     3.0  dir   configuration    (Configuration)
     4.0  dir   performance    (Performance)
     5.0  dir   api-reference    (API Reference)
     6.0  dir   data-import    (Data Import)
     6.5  dir   migration    (Migration)
     7.0  dir   guides    (Guides)
     8.0  dir   data-lifecycle    (Data Lifecycle)
     9.0  dir   integrations    (Integrations)
    10.0  dir   advanced    (Advanced)
    11.0  dir   cli    (CLI (arcctl))
    11.0  dir   operations    (Operations)
    12.0  dir   sdks    (SDKs)
    13.0  file  changelog    (changelog)

  ### arc/installation
  ```json
  // content/docs/arc/installation/meta.json
  {"title": "Installation", "pages": ["docker", "native", "kubernetes", "aws-marketplace"]}
  ```

  ### arc/configuration
  ```json
  // content/docs/arc/configuration/meta.json
  {"title": "Configuration", "pages": ["overview", "authentication", "fips", "storage-file-format"]}
  ```

  ### arc/performance
  ```json
  // content/docs/arc/performance/meta.json
  {"title": "Performance", "pages": ["benchmarks"]}
  ```

  ### arc/api-reference
  ```json
  // content/docs/arc/api-reference/meta.json
  {"title": "API Reference", "pages": ["overview"]}
  ```

  ### arc/data-import
  ```json
  // content/docs/arc/data-import/meta.json
  {"title": "Data Import", "pages": ["csv", "parquet", "line-protocol"]}
  ```

  ### arc/migration
  ```json
  // content/docs/arc/migration/meta.json
  {"title": "Migration", "pages": ["questdb", "timescaledb", "clickhouse", "influxdb"]}
  ```

  ### arc/guides
  ```json
  // content/docs/arc/guides/meta.json
  {"title": "Guides", "pages": ["querying", "decimal-precision"]}
  ```

  ### arc/data-lifecycle
  ```json
  // content/docs/arc/data-lifecycle/meta.json
  {"title": "Data Lifecycle", "pages": ["retention-policies", "delete-operations", "continuous-queries"]}
  ```

  ### arc/integrations
  ```json
  // content/docs/arc/integrations/meta.json
  {"title": "Integrations", "pages": ["apache-iceberg", "superset", "grafana", "telegraf", "influxdb-clients", "mqtt", "vscode", "opentelemetry", "tle", "redpanda-connect"]}
  ```
  !! COLLISION at position 1.0: ['apache-iceberg', 'superset'] - order above is the live order
  !! COLLISION at position 2.0: ['grafana', 'telegraf'] - order above is the live order
  !! COLLISION at position 3.0: ['influxdb-clients', 'mqtt', 'vscode'] - order above is the live order

  ### arc/advanced
  ```json
  // content/docs/arc/advanced/meta.json
  {"title": "Advanced", "pages": ["data-time-partitioning", "wal", "compaction", "caching", "edge-sync"]}
  ```
  !! COLLISION at position 1.0: ['data-time-partitioning', 'wal'] - order above is the live order

  ### arc/cli
  ```json
  // content/docs/arc/cli/meta.json
  {"title": "CLI (arcctl)", "pages": ["index", "connections", "query", "write", "db", "measurement", "import"]}
  ```

  ### arc/operations
  ```json
  // content/docs/arc/operations/meta.json
  {"title": "Operations", "pages": ["telemetry", "backup-restore", "profiling"]}
  ```

  ### arc/sdks
  ```json
  // content/docs/arc/sdks/meta.json
  {"title": "SDKs", "pages": ["python"]}
  ```

## arc-enterprise  (from docs-arc-enterprise/)

```json
// content/docs/arc-enterprise/meta.json
{
  "title": "Arc Enterprise",
  "root": true,
  "pages": [
    "index",
    "getting-started",
    "installation",
    "configuration",
    "api-reference",
    "sdks",
    "integrations",
    "data-lifecycle",
    "advanced",
    "performance",
    "operations",
    "query",
    "security"
  ]
}
```

     1.0  file  overview    (overview)
     2.0  file  getting-started    (getting-started)
     2.0  dir   installation    (Installation)
     3.0  dir   configuration    (Configuration)
     4.0  dir   api-reference    (API Reference)
     5.0  dir   sdks    (SDKs)
     6.0  dir   integrations    (Integrations)
     7.0  dir   data-lifecycle    (Data Lifecycle)
     8.0  dir   advanced    (Advanced)
     9.0  dir   performance    (Performance)
    10.0  dir   operations    (Operations)
    11.0  dir   query    (Query)
    12.0  dir   security    (Security)

  ### arc-enterprise/installation
  ```json
  // content/docs/arc-enterprise/installation/meta.json
  {"title": "Installation", "pages": ["docker", "native", "kubernetes", "aws-marketplace"]}
  ```

  ### arc-enterprise/configuration
  ```json
  // content/docs/arc-enterprise/configuration/meta.json
  {"title": "Configuration", "pages": ["deployment-patterns", "overview", "clustering", "edge-sync-clustered"]}
  ```

  ### arc-enterprise/api-reference
  ```json
  // content/docs/arc-enterprise/api-reference/meta.json
  {"title": "API Reference", "pages": ["overview"]}
  ```

  ### arc-enterprise/sdks
  ```json
  // content/docs/arc-enterprise/sdks/meta.json
  {"title": "SDKs", "pages": ["python"]}
  ```

  ### arc-enterprise/integrations
  ```json
  // content/docs/arc-enterprise/integrations/meta.json
  {"title": "Integrations", "pages": ["mqtt", "grafana", "telegraf", "influxdb-clients", "opentelemetry", "superset", "vscode", "redpanda-connect"]}
  ```

  ### arc-enterprise/data-lifecycle
  ```json
  // content/docs/arc-enterprise/data-lifecycle/meta.json
  {"title": "Data Lifecycle", "pages": ["retention-policies", "continuous-queries", "delete-operations", "tiered-storage"]}
  ```

  ### arc-enterprise/advanced
  ```json
  // content/docs/arc-enterprise/advanced/meta.json
  {"title": "Advanced", "pages": ["wal", "compaction", "caching", "data-time-partitioning"]}
  ```

  ### arc-enterprise/performance
  ```json
  // content/docs/arc-enterprise/performance/meta.json
  {"title": "Performance", "pages": ["benchmarks"]}
  ```

  ### arc-enterprise/operations
  ```json
  // content/docs/arc-enterprise/operations/meta.json
  {"title": "Operations", "pages": ["telemetry", "automated-scheduling", "profiling"]}
  ```

  ### arc-enterprise/query
  ```json
  // content/docs/arc-enterprise/query/meta.json
  {"title": "Query", "pages": ["query-governance", "query-management"]}
  ```

  ### arc-enterprise/security
  ```json
  // content/docs/arc-enterprise/security/meta.json
  {"title": "Security", "pages": ["rbac", "audit-logging", "cluster-security"]}
  ```

## launchpad  (from docs-launchpad/)

```json
// content/docs/launchpad/meta.json
{
  "title": "Arc Launchpad",
  "root": true,
  "pages": [
    "index",
    "getting-started",
    "using-the-console",
    "administration"
  ]
}
```

     1.0  file  overview    (overview)
     2.0  dir   getting-started    (Getting Started)
     3.0  dir   using-the-console    (Using the Console)
     4.0  dir   administration    (Administration)

  ### launchpad/getting-started
  ```json
  // content/docs/launchpad/getting-started/meta.json
  {"title": "Getting Started", "pages": ["installation", "first-run-setup", "connecting-to-arc"]}
  ```

  ### launchpad/using-the-console
  ```json
  // content/docs/launchpad/using-the-console/meta.json
  {"title": "Using the Console", "pages": ["sql-console", "logs-and-monitoring", "retention-policies", "continuous-queries", "alerts", "mqtt-ingestion", "tokens"]}
  ```

  ### launchpad/administration
  ```json
  // content/docs/launchpad/administration/meta.json
  {"title": "Administration", "pages": ["teams-and-organizations", "configuration"]}
  ```
