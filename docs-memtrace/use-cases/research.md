---
sidebar_position: 4
---

# Research & Analysis

AI agents that crawl, summarize, and analyze data over time. They need to track what they've already read, what patterns they've found, and what conclusions they've drawn — building knowledge incrementally instead of starting from zero.

## The Challenge

Research agents face unique requirements:

- **Knowledge accumulation** - Build understanding over time, not just one-shot analysis
- **Source tracking** - Remember where information came from
- **Pattern recognition** - Connect insights across multiple data points
- **Avoid duplication** - Don't re-analyze what's already been processed
- **Incremental learning** - Update conclusions as new data arrives

## How Memtrace Helps

Memtrace enables systematic knowledge building:

- **Source attribution** - Tag memories with sources and URLs
- **Time-series analysis** - Track how data changes over time
- **Pattern storage** - Store insights and patterns as they emerge
- **Deduplication** - Avoid re-processing same sources
- **Decision logging** - Record conclusions with supporting evidence

## Example: Market Research Agent

An agent that monitors competitor pricing daily, remembering trends and flagging anomalies.

### Setup

```python
from memtrace import Memtrace, RegisterAgentRequest, CreateSessionRequest

memtrace = Memtrace("http://localhost:9100", "mtk_...")

# Register research agent
researcher = memtrace.register_agent(RegisterAgentRequest(
    name="market-researcher",
    description="Monitors competitor pricing and market trends",
))

# Create long-running research session
session = memtrace.create_session(CreateSessionRequest(
    agent_id=researcher.id,
    metadata={
        "project": "competitor_pricing_analysis",
        "market": "saas_timeseries_db",
    },
))
```

### Daily Data Collection

```python
def collect_pricing_data():
    """Collect pricing data from competitors"""

    # Check if already collected today
    today = datetime.now().strftime("%Y-%m-%d")
    already_collected = memtrace.search_memories({
        "agent_id": researcher.id,
        "session_id": session.id,
        "tags": ["pricing_data", f"date_{today}"],
    })

    if already_collected.memories:
        print("Already collected pricing data today")
        return

    # Collect data
    competitor_a_price = scrape_competitor_pricing("competitor_a")
    competitor_b_price = scrape_competitor_pricing("competitor_b")

    # Store data points
    memtrace.remember(
        researcher.id,
        f"Competitor A pricing: Basic ${competitor_a_price['basic']}, Pro ${competitor_a_price['pro']}",
        session_id=session.id,
        tags=["pricing_data", "competitor_a", f"date_{today}"],
        metadata={
            "competitor": "competitor_a",
            "date": today,
            "prices": competitor_a_price,
        },
        importance=0.7,
    )

    memtrace.remember(
        researcher.id,
        f"Competitor B pricing: Starter ${competitor_b_price['starter']}, Business ${competitor_b_price['business']}",
        session_id=session.id,
        tags=["pricing_data", "competitor_b", f"date_{today}"],
        metadata={
            "competitor": "competitor_b",
            "date": today,
            "prices": competitor_b_price,
        },
        importance=0.7,
    )
```

### Pattern Detection

```python
def analyze_pricing_trends():
    """Analyze pricing data for patterns"""

    # Get last 30 days of pricing data
    pricing_data = memtrace.search_memories({
        "agent_id": researcher.id,
        "session_id": session.id,
        "tags": ["pricing_data"],
        "since": "30d",
    })

    # Analyze for changes
    for competitor in ["competitor_a", "competitor_b"]:
        competitor_data = [m for m in pricing_data.memories if competitor in m.tags]

        # Check for price changes
        prices = [m.metadata.get("prices") for m in competitor_data]
        if len(prices) >= 2:
            if prices[-1] != prices[-2]:
                memtrace.remember(
                    researcher.id,
                    f"{competitor} changed pricing from {prices[-2]} to {prices[-1]}",
                    session_id=session.id,
                    tags=["price_change", competitor, "alert"],
                    importance=1.0,
                )

                memtrace.decide(
                    researcher.id,
                    f"Flag {competitor} price change for review",
                    "Price changes may indicate market shift or competitive response",
                )
```

### Trend Analysis

```python
def analyze_long_term_trends():
    """Analyze trends over 90 days"""

    # Get 90 days of data
    data = memtrace.search_memories({
        "agent_id": researcher.id,
        "session_id": session.id,
        "tags": ["pricing_data"],
        "since": "90d",
    })

    # Calculate averages
    competitor_a_avg = calculate_average_price(data, "competitor_a")
    competitor_b_avg = calculate_average_price(data, "competitor_b")

    # Store insight
    memtrace.remember(
        researcher.id,
        f"90-day pricing analysis: Competitor A avg ${competitor_a_avg}, Competitor B avg ${competitor_b_avg}",
        session_id=session.id,
        tags=["analysis", "trend", "90_day"],
        importance=0.9,
    )

    # Check for patterns
    if competitor_a_avg < competitor_b_avg * 0.7:
        memtrace.decide(
            researcher.id,
            "Competitor A pursuing aggressive low-price strategy",
            "A consistently priced 30% below B over 90 days, likely targeting market share",
        )
```

## Example: Content Research Agent

An agent that researches topics by reading articles and building a knowledge base.

### Setup

```python
content_researcher = memtrace.register_agent(RegisterAgentRequest(
    name="content-researcher",
    description="Researches topics by reading web sources",
))

session = memtrace.create_session(CreateSessionRequest(
    agent_id=content_researcher.id,
    metadata={"topic": "golang_concurrency"},
))
```

### Source Collection

```python
def research_topic(url: str):
    """Research a specific URL"""

    # Check if already researched
    already_read = memtrace.search_memories({
        "agent_id": content_researcher.id,
        "session_id": session.id,
        "content_contains": url,
        "tags": ["source"],
    })

    if already_read.memories:
        print(f"Already researched {url}")
        return

    # Scrape and analyze
    content = scrape_url(url)
    key_points = extract_key_points(content)

    # Store source
    memtrace.remember(
        content_researcher.id,
        f"Source: {url}",
        session_id=session.id,
        tags=["source", "web"],
        metadata={"url": url, "scraped_at": datetime.now().isoformat()},
        importance=0.6,
    )

    # Store key findings
    for point in key_points:
        memtrace.remember(
            content_researcher.id,
            point,
            session_id=session.id,
            tags=["finding", "golang", "concurrency"],
            metadata={"source": url},
            importance=0.8,
        )
```

### Knowledge Synthesis

```python
def synthesize_findings():
    """Synthesize findings across all sources"""

    # Get all findings
    findings = memtrace.search_memories({
        "agent_id": content_researcher.id,
        "session_id": session.id,
        "tags": ["finding"],
    })

    # Group by theme
    themes = {}
    for finding in findings.memories:
        # Use LLM to categorize finding
        theme = categorize_finding(finding.content)
        if theme not in themes:
            themes[theme] = []
        themes[theme].append(finding)

    # Store synthesis
    for theme, theme_findings in themes.items():
        memtrace.remember(
            content_researcher.id,
            f"Theme '{theme}' covered by {len(theme_findings)} sources",
            session_id=session.id,
            tags=["synthesis", theme],
            importance=0.9,
        )

    # Draw conclusions
    memtrace.decide(
        content_researcher.id,
        f"Research complete: identified {len(themes)} key themes from {len(findings.memories)} findings",
        f"Sufficient coverage across {len(get_unique_sources(findings))} sources",
    )
```

## Example: Technical Documentation Crawler

An agent that crawls documentation sites and builds a searchable knowledge base.

### Setup

```python
doc_crawler = memtrace.register_agent(RegisterAgentRequest(
    name="doc-crawler",
    description="Crawls and indexes technical documentation",
))

session = memtrace.create_session(CreateSessionRequest(
    agent_id=doc_crawler.id,
    metadata={"target": "golang_docs"},
))
```

### Crawling

```python
def crawl_documentation(base_url: str):
    """Crawl documentation site"""

    pages_to_crawl = [base_url]
    crawled = set()

    while pages_to_crawl:
        url = pages_to_crawl.pop(0)

        if url in crawled:
            continue

        # Check if already crawled (persistent memory)
        already_crawled = memtrace.search_memories({
            "agent_id": doc_crawler.id,
            "content_contains": url,
            "tags": ["crawled"],
        })

        if already_crawled.memories:
            print(f"Skipping {url} - already crawled")
            crawled.add(url)
            continue

        # Crawl page
        content = fetch_page(url)
        links = extract_links(content)

        # Store page
        memtrace.remember(
            doc_crawler.id,
            f"Crawled {url}",
            session_id=session.id,
            tags=["crawled", "documentation"],
            metadata={
                "url": url,
                "word_count": len(content.split()),
                "links_found": len(links),
            },
            importance=0.5,
        )

        # Extract and store key information
        sections = extract_sections(content)
        for section in sections:
            memtrace.remember(
                doc_crawler.id,
                f"Section '{section['title']}': {section['summary']}",
                session_id=session.id,
                tags=["content", section['category']],
                metadata={"source": url, "section": section['title']},
                importance=0.8,
            )

        # Add new links to queue
        pages_to_crawl.extend([l for l in links if l not in crawled])
        crawled.add(url)
```

### Progress Tracking

```python
def get_crawl_progress():
    """Check crawl progress"""

    crawled = memtrace.search_memories({
        "agent_id": doc_crawler.id,
        "session_id": session.id,
        "tags": ["crawled"],
    })

    content_extracted = memtrace.search_memories({
        "agent_id": doc_crawler.id,
        "session_id": session.id,
        "tags": ["content"],
    })

    return {
        "pages_crawled": len(crawled.memories),
        "sections_extracted": len(content_extracted.memories),
    }
```

## Example: Data Analyst Agent

An agent that processes CSV files, finds patterns, and generates insights.

### Setup

```python
analyst = memtrace.register_agent(RegisterAgentRequest(
    name="data-analyst",
    description="Analyzes datasets and generates insights",
))

session = memtrace.create_session(CreateSessionRequest(
    agent_id=analyst.id,
    metadata={"dataset": "sales_2025"},
))
```

### Data Processing

```python
def analyze_dataset(file_path: str):
    """Analyze a dataset file"""

    # Check if already analyzed
    already_analyzed = memtrace.search_memories({
        "agent_id": analyst.id,
        "content_contains": file_path,
        "tags": ["analyzed"],
    })

    if already_analyzed.memories:
        print(f"Dataset {file_path} already analyzed")
        return

    # Load and analyze
    df = pd.read_csv(file_path)

    # Store metadata
    memtrace.remember(
        analyst.id,
        f"Analyzed {file_path}: {len(df)} rows, {len(df.columns)} columns",
        session_id=session.id,
        tags=["analyzed", "metadata"],
        metadata={
            "file": file_path,
            "rows": len(df),
            "columns": list(df.columns),
        },
        importance=0.7,
    )

    # Find patterns
    for column in df.select_dtypes(include='number').columns:
        stats = df[column].describe()

        memtrace.remember(
            analyst.id,
            f"Column '{column}': mean={stats['mean']:.2f}, std={stats['std']:.2f}",
            session_id=session.id,
            tags=["statistics", column],
            metadata={"file": file_path, "column": column},
            importance=0.6,
        )

        # Flag anomalies
        if stats['std'] > stats['mean'] * 2:
            memtrace.remember(
                analyst.id,
                f"High variance detected in '{column}' - potential anomaly",
                session_id=session.id,
                tags=["anomaly", column],
                importance=0.9,
            )
```

### Cross-Dataset Insights

```python
def find_cross_dataset_patterns():
    """Find patterns across multiple analyzed datasets"""

    all_stats = memtrace.search_memories({
        "agent_id": analyst.id,
        "session_id": session.id,
        "tags": ["statistics"],
    })

    # Correlate patterns
    # ... analysis logic ...

    memtrace.decide(
        analyst.id,
        "Found correlation between sales and marketing spend across datasets",
        "3 datasets show consistent 2.5x ROI on marketing, recommend increased budget",
    )
```

## Best Practices

### Source Attribution

Always tag memories with source information:

```python
metadata = {
    "source": "https://example.com/article",
    "scraped_at": "2026-02-13T10:00:00Z",
}
```

### Deduplication

Check before re-processing:

```python
already_processed = memtrace.search_memories({
    "content_contains": url,
    "tags": ["processed"],
})
```

### Importance Scoring

Prioritize findings over routine logs:

```python
# Routine data collection
importance=0.5

# Key finding
importance=0.9

# Critical insight
importance=1.0
```

### Temporal Queries

Use time windows for trend analysis:

```python
# Recent data
since="7d"

# Long-term trends
since="90d"
```

### Pattern Recording

Store patterns as decisions:

```python
memtrace.decide(
    agent_id,
    "Pattern identified: prices drop every Tuesday",
    "Observed consistently over 8 weeks across 3 competitors",
)
```

## Benefits

- **No duplicate work** - Agent remembers what it already analyzed
- **Knowledge accumulation** - Builds understanding over time
- **Pattern recognition** - Connects insights across data points
- **Source tracking** - Always know where information came from
- **Incremental learning** - Updates conclusions as new data arrives
- **Audit trail** - Full history of research process and decisions
