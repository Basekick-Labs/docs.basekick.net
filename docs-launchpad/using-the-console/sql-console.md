---
sidebar_position: 1
---

# SQL console

The SQL console is where you run queries against a connected Arc instance. Open a connection from **Instances** and you land on the console, with a tab bar across the top: **SQL Console · Log Viewer · Monitoring · Retention · Continuous Queries · Alerts · MQTT · Tokens**.

![Launchpad SQL console with schema explorer](/img/launchpad/launchpad-sql-console.png)

## Schema explorer

The left panel has two tabs:

- **Tables**: a tree of your databases and their measurements (tables). Click a database to expand it and see its tables; the active database is highlighted. Use the **+** to create a database and the refresh icon to reload the tree.
- **History**: your recent queries, so you can re-run or tweak past work.

Selecting a database sets it as the query target (shown as a chip in the top-right of the editor).

## Running a query

Type SQL in the editor and click **Execute** (or use the keyboard shortcut shown on the button). Arc runs the query and returns results in the grid below.

```sql
SELECT * FROM citibike_trips LIMIT 100;
```

Arc speaks standard analytical SQL (DuckDB-powered), so window functions, CTEs, and joins all work. See the [Arc SQL reference](/arc) for the full dialect.

## Multi-tab editing

Keep several query drafts open at once in separate tabs, which is useful when you're comparing results or iterating on a few queries side by side.

## Exporting results

Below the result grid, export the current result set:

- **CSV**: download as a `.csv` file
- **JSON**: download as JSON
- **Markdown**: copy a Markdown table (handy for issues and docs)
- **Show Chart**: render the result as a quick chart

## Tips

- The status bar at the bottom shows the instance ID and the Arc endpoint you're connected to.
- Query history is per-connection, so switching instances gives you that instance's history.
