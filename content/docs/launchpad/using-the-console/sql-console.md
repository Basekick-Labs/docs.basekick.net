---
title: "SQL console"
description: "Run SQL against a connected Arc instance from the browser: browse the schema tree, replay query history, run a selection or a whole script, and export results as CSV, JSON, Markdown, or a chart."
---

The SQL console is where you run queries against a connected Arc instance. Open a connection from **Instances** and you land on the console, with a tab bar across the top: **SQL Console · Log Viewer · Monitoring · Retention · Continuous Queries · Alerts · MQTT · Tokens**.

![Launchpad SQL console with schema explorer](/img/launchpad/launchpad-sql-console.png)

## Schema Explorer

The left panel has two tabs:

- **Tables**: a tree of your databases and their measurements (tables). Click a database to expand it and see its tables; the active database is highlighted. Use the **+** to create a database and the refresh icon to reload the tree.
- **History**: your recent queries, so you can re-run or tweak past work.

Selecting a database sets it as the query target (shown as a chip in the top-right of the editor).

## Running a Query

Type SQL in the editor and click **Execute** (or press the shortcut shown on the button). Select part of the query first and a **Run Selection** button appears, which runs only the highlighted statement.

```sql
SELECT * FROM citibike_trips LIMIT 100;
```

Arc speaks standard analytical SQL (DuckDB-powered), so window functions, CTEs, and joins all work. See the [Arc SQL reference](/arc/) for the full dialect.

## Multi-statement Scripts

Run several statements in one go and the results panel gives each its own tab, so you can page through the output of a script without splitting it up by hand.

## Exporting Results

Below the result grid, export the current result set:

- **CSV**: download as a `.csv` file
- **JSON**: download as JSON
- **Markdown**: copy a Markdown table to the clipboard (handy for issues and docs)
- **Show Chart**: render the result as a quick chart. It appears only when the result has a numeric column to plot.

## Tips

- The status bar at the bottom shows which connection you're on and its Arc endpoint, alongside the row count and execution time of the last query.
- Query history is per-connection, so switching instances gives you that instance's history.
