import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import GitHubStars from '@site/src/components/GitHubStars';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/arc">
            Get Started
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="https://github.com/basekick-labs/arc"
            style={{marginLeft: '10px'}}>
            GitHub
          </Link>
        </div>
        <div style={{marginTop: '2rem', fontSize: '1.2rem', opacity: 0.9}}>
          <strong>18.6M</strong> records/sec • <strong>2.64M</strong> rows/sec queries • <strong>p99: &lt;10ms</strong> • <GitHubStars repo="basekick-labs/arc" />
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Arc - High-Performance Time-Series Database"
      description="High-performance time-series database built on DuckDB and Parquet. 18.6M records/sec ingestion, 2.64M rows/sec queries, <10ms p99 latency. SQL queries, S3/Azure/MinIO storage, MQTT, Python SDK.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
