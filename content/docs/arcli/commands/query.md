---
title: "arcli query"
description: "Run SQL against an Arc database with arcli query: SQL from an argument, a file or stdin, table, JSON, CSV or Arrow IPC output, a client-side row cap, and --estimate to size a result before running it."
---

`arcli query` sends one SQL statement to `POST /api/v1/query` and renders the result. Defaults suit interactive use: a table on stdout, errors on stderr, exit 0 on success and 1 on any failure.

## Quick reference

```bash
arcli query "SELECT host, avg(usage) AS usage FROM cpu GROUP BY 1 ORDER BY 2 DESC"
arcli query --database metrics "SELECT count(*) FROM cpu"    # another database for this call
arcli query -f reports/p99.sql                                # SQL from a file
echo "SELECT 1" | arcli query                                 # SQL from stdin
arcli query -o json "SELECT count(*) AS rows FROM cpu" | jq .data[0][0]
arcli query --estimate "SELECT * FROM cpu WHERE region = 'us-east'"
```

## SQL input

Three sources, in this order of precedence:

1. The positional argument: `arcli query "SELECT 1"`.
2. `-f FILE`: the file's contents are the statement.
3. Stdin, when neither is given and stdin is a pipe or a file.

Run interactively with no argument and no pipe, arcli exits with an error instead of waiting on the terminal. The statement goes to the server as written; the database comes from `--database`, else the profile's `default_database`, else Arc's own default (`default`).

## Flags

| Flag | Description | Default |
|---|---|---|
| `--database` `string` | target database (defaults to connection's default_database) |  |
| `--estimate` | estimate the result size (server-side COUNT(*)) instead of running the query |  |
| `-f`, `--file` `string` | read SQL from a file instead of the positional arg |  |
| `--limit` `int` | cap output rows client-side (0 = no cap; server result is already bounded by the SQL) |  |
| `--no-header` | suppress column header row (table + csv) |  |
| `-o`, `--output` `string` | output format: table\|json\|csv\|arrow | `"table"` |

Plus the [connection flags](/arcli/reference/connections/#per-command-flags) every command takes.

## Output formats

| `-o` | Use it for |
|---|---|
| `table` (default) | Reading results in a terminal. Column headers are upper-cased; `--no-header` drops them. |
| `json` | Scripts and `jq`. The server's document: `columns`, `data` (rows as arrays), `row_count`, `execution_time_ms`. |
| `csv` | Spreadsheets, pandas, R. RFC 4180 with a header row; `--no-header` drops it. |
| `arrow` | Arrow IPC bytes on stdout, streamed rather than buffered: pipe into pyarrow, polars or DuckDB. Only `query` offers it. |

```text
$ arcli query -o json "SELECT count(*) AS rows FROM cpu"
{
  "columns": ["rows"],
  "data": [[5]],
  "row_count": 1,
  "execution_time_ms": 1
}

$ arcli query -o csv "SELECT host, usage FROM cpu ORDER BY usage DESC LIMIT 2"
host,usage
web-2,0.71
web-1,0.63
```

```python
# Arrow straight into pandas, no file in between:
#   arcli query -o arrow "SELECT * FROM cpu" | python3 read_arrow.py
import sys, pyarrow.ipc as ipc
table = ipc.open_stream(sys.stdin.buffer).read_all()
print(table.to_pandas().describe())
```

## Capping rows client-side

`--limit N` stops rendering after N rows. It does not change the SQL: the server still computes the full result, so put a `LIMIT` in the statement when the result is large and the cap is only a convenience for the terminal. `--limit` and `--estimate` cannot be combined.

## Estimating a result first

```text
$ arcli query --estimate "SELECT * FROM cpu WHERE region = 'us-east'"
estimated rows: 3
size class:     none
note:           ✅ Small query: 3 rows.
estimate took:  1ms
```

`--estimate` asks `POST /api/v1/query/estimate` to run the statement as a `SELECT COUNT(*)`, so it scans what the query would scan but returns only a row count and a size class (`none`, `low`, `medium`, `high`). Use it before a query that might return millions of rows or before wiring one into a dashboard. The estimate is a real query: it needs a token that can read the database. With `-o json` the server's document is printed as is; `csv` and `arrow` are not accepted with `--estimate`. A statement the estimator cannot handle (for example `SHOW DATABASES`) is reported as an error with exit 1.

## Exit status and errors

Server errors arrive as `Error: arc: <message> (HTTP <status>)` on stderr, including the SQL error text from the engine; a query that exceeds `--timeout` (default 1m) is cancelled client-side, and the server may keep running it. Ctrl-C cancels the request and exits 130. See [Output formats and exit codes](/arcli/reference/output/).
