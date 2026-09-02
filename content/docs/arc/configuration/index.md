---
title: "Configuration"
description: "Configure Arc through arc.toml and its environment-variable overrides: storage backends, ingestion and compaction tuning, authentication, and the FIPS build variant."
---

Arc reads `arc.toml` at startup, and every key in it can be overridden by an environment variable. These pages cover what each section controls.

- **[Overview](/arc/configuration/overview/)** — Every arc.toml section and the environment variable that overrides each key.
- **[Authentication](/arc/configuration/authentication/)** — API tokens, the first-run bootstrap token, and the validation cache.
- **[FIPS 140-3 mode](/arc/configuration/fips/)** — The arc-fips build variant for regulated environments.
- **[Storage file format](/arc/configuration/storage-file-format/)** — Choosing between Parquet and Vortex for on-disk storage.
