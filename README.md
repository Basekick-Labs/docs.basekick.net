# Arc Documentation

Official documentation for [Arc](https://github.com/basekick-labs/arc) - the fastest time-series database in ClickBench.

## About

This repository contains the documentation website for Arc, a high-performance time-series data warehouse built on DuckDB and Parquet. Arc achieves 36.43s on ClickBench (99.9M rows) and delivers 2.01M records/sec ingestion.

Visit the live documentation at [docs.basekick.net](https://docs.basekick.net)

## Technology Stack

- **Docusaurus 3.9.1** - Modern static site generator built with React
- **TypeScript** - Type-safe documentation and components
- **Markdown/MDX** - Documentation content format
- **GitHub Actions** - Automated deployment pipeline
- **Nginx** - Static file serving in production
- **Traefik** - Reverse proxy with Let's Encrypt SSL

## Local Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Start Development Server

```bash
npm start
```

This starts a local development server at `http://localhost:3000` with hot reloading.

### Build for Production

```bash
npm run build
```

Generates static content in the `build/` directory ready for deployment.

## Documentation Structure

```
docs/
├── intro.md                    # Getting started
├── getting-started.md          # Quick start guide
├── installation/               # Docker and native setup
├── configuration/              # Configuration guides
├── performance/                # ClickBench benchmarks
├── api-reference/              # API documentation
├── integrations/               # Superset, Telegraf, etc.
└── advanced/                   # WAL, compaction features
```

## Contributing

We welcome contributions to improve the documentation!

### How to Contribute

1. **Fork the repository**
   ```bash
   git clone https://github.com/basekick-labs/docs.basekick.net.git
   cd docs.basekick.net
   ```

2. **Create a branch**
   ```bash
   git checkout -b docs/improve-installation-guide
   ```

3. **Make your changes**
   - Edit markdown files in `docs/`
   - Test locally with `npm start`
   - Verify the build with `npm run build`

4. **Commit and push**
   ```bash
   git add .
   git commit -m "docs: improve installation guide with examples"
   git push origin docs/improve-installation-guide
   ```

5. **Create a Pull Request**
   - Open a PR on GitHub
   - Describe your changes
   - Link any related issues

### Documentation Guidelines

- **No emojis** - Keep documentation professional and accessible
- **Clear headings** - Use descriptive section titles
- **Code examples** - Include working code snippets
- **Links** - Use `/arc/page-name` for internal links
- **Images** - Store in `static/img/` and reference with `/img/filename`

### Testing Your Changes

Before submitting:

```bash
# Check for broken links
npm run build

# Test locally
npm start
```

## Deployment

This repository deploys automatically via GitHub Actions when changes are pushed to `main`. The workflow:

1. Builds the Docusaurus site
2. Connects to deployment server via Tailscale VPN
3. Syncs files to `/opt/services/docs.basekick.net`
4. Nginx serves the static site at docs.basekick.net

## Project Structure

```
docs.basekick.net/
├── .github/workflows/          # GitHub Actions
├── docs/                       # Documentation content (Markdown)
├── src/
│   ├── components/             # React components
│   ├── css/                    # Custom styles
│   └── pages/                  # Custom pages (homepage)
├── static/                     # Static assets (images, etc.)
├── docusaurus.config.ts        # Docusaurus configuration
├── sidebars.ts                 # Sidebar navigation
└── docker-compose.yml          # Production deployment
```

## Support

- Documentation: [docs.basekick.net](https://docs.basekick.net)
- GitHub Issues: [github.com/basekick-labs/arc/issues](https://github.com/basekick-labs/arc/issues)
- Website: [basekick.net](https://basekick.net)

## License

This documentation is part of the Arc project.

---

Built by [Basekick Labs](https://basekick.net) with Docusaurus.
