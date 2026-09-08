---
title: "Output formats and exit codes"
description: "What arcli prints and how it exits: table, json, csv and arrow output per command, --no-header, stdout versus stderr, confirmation prompts and --yes, exit codes 0, 1, 130 and 143, and script patterns."
---

arcli is built to be piped. The rules below hold for every command so a script can rely on them.

## stdout and stderr

- **stdout** carries the result: the table, the JSON or CSV document, the Arrow stream, or a one-line confirmation such as `OK` or `Deleted database "staging"`.
- **stderr** carries everything else: `Error: …` lines, warnings (TLS disabled, a query that looks wrong), progress while `--wait` polls, confirmation prompts, and the reminders that follow a freshly printed secret.

The two commands that print a token secret, `auth token create` and `auth token rotate`, print **only** the secret on stdout, so `$(…)` captures it cleanly.

## Output formats

Select with `-o` / `--output`. Which formats a command offers depends on what it returns:

| Format | Available on | Notes |
|---|---|---|
| `table` | every command that talks to a server (default) | Upper-cased headers, box drawing; `--no-header` removes the header row |
| `json` | every command that talks to a server | Usually the server's document unchanged, so keys match the [REST API](/arc/api-reference/overview/); a few commands (`ping`, `auth whoami`) build their own document |
| `csv` | list-shaped commands: `query`, `db list`, `db show` (measurements only), `measurement list`, `auth token list`, `retention list`/`executions`, `cq list`/`executions`, `backup list`, `cluster nodes`, `compaction candidates`/`history`, `logs` | RFC 4180, header row unless `--no-header` |
| `arrow` | `query` only | Arrow IPC stream on stdout, unbuffered |

Timestamps in tables are RFC 3339 in UTC. `-o json` never reformats them. The `config` commands take no `-o`: they only touch the local file.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The command did what it said. A `ping` that finds the server up and the token valid; a `--dry-run` that ran. |
| `1` | Anything else: bad flags, no connection resolved, server error (`Error: arc: … (HTTP 4xx/5xx)`), network failure, timeout, a declined or refused confirmation prompt (except the two noted below), a `--estimate` the server could not produce. |
| `130` | Interrupted by Ctrl-C (SIGINT) |
| `143` | Terminated by SIGTERM |

On 130 and 143 arcli prints `interrupted; any operation already accepted by the server continues there` and cancels the in-flight request; the server keeps going. A second Ctrl-C kills arcli outright.

## Confirmation prompts

Destructive commands (`delete`, `retention execute`, `retention delete`, `cq delete`, `backup restore`, `backup delete`, `auth token rotate|revoke|delete`, `cluster node remove`) ask `… [y/N]` on stderr. The default is always no. When stdin is not a terminal (a pipe, a file, `/dev/null`) the prompt is refused with `Error: aborted` and exit 1 and the command does nothing; pass `--yes` (`-y`) to proceed without asking. There is no way to make the default yes.

Two older commands behave slightly differently: `db drop` and `config delete` also prompt, but a declined or non-terminal prompt prints `Aborted.` and exits **0** without doing anything. Scripts should not rely on the exit code there; pass `--yes` when the drop is intended.

## Patterns

```bash
# JSON for jq
arcli query -o json "SELECT host, max(usage) AS m FROM cpu GROUP BY 1" | jq -r '.data[] | @tsv'

# CSV straight into a file
arcli query -o csv "SELECT * FROM cpu WHERE time > now() - INTERVAL 1 DAY" > cpu-24h.csv

# A token for a pipeline, captured without the reminder
TOKEN=$(arcli auth token create --name telegraf --permission write 2>/dev/null)

# Fail a CI job if the server or the token is bad
arcli ping >/dev/null || exit 1

# Non-interactive destructive command
arcli delete --database metrics --measurement cpu --where "host = 'retired-1'" --yes
```

Verbose, human-facing output never includes a token; arcli redacts them everywhere but the two secret-printing commands.
