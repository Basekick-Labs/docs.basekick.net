# ASCII diagrams worth replacing with real images

Compiled from the migrated content. 69 fenced blocks contain box-drawing
or arrow characters, but most are legitimately monospace: terminal output,
`arcctl` table output, directory trees and code samples. Those should stay.

What follows is the subset where a real diagram would communicate better
than characters, split by what kind of asset it needs.

## Diagrams to draw (17)

These are architecture, flow and data-model pictures. Vector (SVG) so they
stay sharp and can be themed light/dark.

### Architecture

- `content/docs/arc/advanced/wal.md:59-97` (38 lines)  
  WAL write path: request -> WAL append -> ack -> buffer -> flush -> recovery
- `content/docs/arc/installation/aws-marketplace.md:68-101` (33 lines)  
  AWS reference VPC topology: subnets, EC2, S3, security groups
- `content/docs/arc-enterprise/advanced/wal.md:53-91` (38 lines)  
  WAL write path (Enterprise)
- `content/docs/arc-enterprise/data-lifecycle/tiered-storage.mdx:16-34` (18 lines)  
  Tiered storage: hot/warm/cold tiers and migration between them
- `content/docs/arc-enterprise/installation/aws-marketplace.md:68-101` (33 lines)  
  AWS reference VPC topology (Enterprise)
- `content/docs/launchpad/index.mdx:35-45` (10 lines)  
  Browser -> Launchpad -> Arc server request path

### Process / flow

- `content/docs/arc/index.mdx:159-163` (4 lines)  
  Write path: client -> API -> buffer -> Parquet -> object storage
- `content/docs/arc/advanced/compaction.md:70-93` (23 lines)  
  Compaction scheduler lifecycle: wake -> select -> merge -> swap -> cleanup
- `content/docs/arc/data-lifecycle/continuous-queries.md:33-41` (8 lines)  
  Continuous query: source measurement -> interval -> destination
- `content/docs/arc-enterprise/operations/automated-scheduling.md:86-106` (20 lines)  
  Downsampling cascade: raw -> 1m -> 5m -> 1h rollups
- `content/docs/arc-enterprise/configuration/edge-sync-clustered.md:24-27` (3 lines)  
  Raft leader vs follower command routing

### Data model / hierarchy

- `content/docs/arc/advanced/data-time-partitioning.md:70-83` (13 lines)  
  Single-hour batch routed to one partition
- `content/docs/arc/advanced/data-time-partitioning.md:89-104` (15 lines)  
  Multi-hour batch split across partitions
- `content/docs/arc/sdks/python/index.md:61-81` (20 lines)  
  Python SDK client object model
- `content/docs/arc/integrations/opentelemetry.md:235-246` (11 lines)  
  OTel trace/span storage layout
- `content/docs/arc-enterprise/security/rbac.md:12-19` (7 lines)  
  RBAC hierarchy: organization -> team -> role -> measurement

### Annotated syntax

- `content/docs/arc/sdks/python/ingestion.md:279-286` (7 lines)  
  Line protocol anatomy: measurement, tags, fields, timestamp

## Screenshots to capture (6)

These draw a picture of someone else's UI in characters. A real screenshot
of the actual tool is both more accurate and less to maintain.

- `content/docs/arc/integrations/grafana.md:380-397` (17 lines)  
  Grafana dashboard layout mockup
- `content/docs/arc/integrations/superset.md:222-241` (19 lines)  
  Superset dashboard layout mockup
- `content/docs/arc/integrations/vscode.md:200-212` (12 lines)  
  VS Code extension context menu / schema view
- `content/docs/arc-enterprise/integrations/grafana.md:378-395` (17 lines)  
  Grafana dashboard layout mockup
- `content/docs/arc-enterprise/integrations/superset.md:220-239` (19 lines)  
  Superset dashboard layout mockup
- `content/docs/arc-enterprise/integrations/vscode.md:196-208` (12 lines)  
  VS Code extension context menu / schema view

## Duplicated between OSS and Enterprise

Several of the above exist in both trees with near-identical content, so
one asset can serve both (or the Enterprise version needs only the extra
cluster detail):

- `advanced/wal.md`
- `advanced/data-time-partitioning.md`
- `advanced/compaction.md`
- `installation/aws-marketplace.md`
- `integrations/grafana.md`
- `integrations/superset.md`
- `integrations/vscode.md`
- `sdks/python/ingestion.md`
- `data-lifecycle/continuous-queries.md`

## Deliberately left as text

- `FIRST RUN - INITIAL ADMIN TOKEN GENERATED` banners (8 pages) - real
  terminal output; a screenshot would be worse.
- `arcctl` table output in cli/*.md - real CLI output.
- Directory trees (`data/`, `arc/`, `./data/wal/`) - monospace is the
  right medium; a picture of a file tree is harder to copy from.
- Code samples that happened to match the heuristic.

## Markers already left in the content

The conversion agents flagged these independently while writing the pages.
They overlap with the list above and carry the reasoning for each.

- **diagram** `content/docs/arc-enterprise/configuration/clustering.md:428`  
  writer failover timeline — healthy writer missing heartbeats, the
- **diagram** `content/docs/arc-enterprise/data-lifecycle/tiered-storage.mdx:8`  
  what a query touching cold-tier data does under each retrieval_mode -
- **screenshot** `content/docs/arc-enterprise/query/query-management.md:17`  
  the active-queries response rendered in a console, showing a
- **diagram** `content/docs/arc/advanced/wal.md:6`  
  the WAL write path as a real diagram — request -> WAL append -> fsync mode -> ack -> buffer -> Parquet flush — showing exactly where the acknowledgement happens under each sync mode. That boundary is 
- **verify** `content/docs/arc/configuration/storage-file-format.md:6`  
  `storage.file_format` and the `vortex` value could not be confirmed in the Arc
- **diagram** `content/docs/arc/index.mdx:155`  
  replace the ASCII box-flow below with a real diagram of the write path (client -> API -> buffer -> Parquet -> object storage) and the read path (DuckDB querying Parquet in place). The separation of co
- **screenshot** `content/docs/arc/integrations/superset.md:216`  
  the finished Superset dashboard built from these queries. The ASCII mock shows layout only; a reader following this page needs to confirm the arc:// connection worked and charts render against Arc.
- **screenshot** `content/docs/arc/integrations/grafana.md:376`  
  a real Arc-backed Grafana dashboard with these four panels populated. The ASCII mock below conveys panel arrangement but not what the plugin's query editor, time picker, or rendered series actually lo
- **screenshot** `content/docs/arc/integrations/vscode.md:109`  
  the extension's results grid after running a query — the sortable columns, row count, and export controls described below. This is the extension's primary surface and is impossible to picture from pro
- **screenshot** `content/docs/arc/integrations/vscode.md:178`  
  the Schema Explorer tree expanded to show databases, measurements, and column types, so readers can tell it apart from the results view.
