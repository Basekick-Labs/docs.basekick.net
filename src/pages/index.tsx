import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
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
          <strong>120.25s</strong> ClickBench cold run • <strong>2.42M</strong> records/sec • <strong>302</strong> GitHub stars
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Arc - Fastest Time-Series Database"
      description="Arc is the fastest time-series database. 120.25s cold run on ClickBench, 2.42M records/sec ingestion, powered by DuckDB and Parquet.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
