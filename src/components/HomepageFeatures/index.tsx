import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Blazing Fast Analytics',
    icon: '36.43s',
    description: (
      <>
        Fastest time-series database with 36.43s cold run on ClickBench (99.9M rows).
        Powered by DuckDB's columnar engine for lightning-fast SQL queries with full ANSI SQL support.
      </>
    ),
  },
  {
    title: 'Massive Throughput',
    icon: '2.42M',
    description: (
      <>
        Ingest 2.42M records/sec with MessagePack binary protocol.
        Built for IoT sensors, metrics collection, and observability platforms that need extreme write performance.
      </>
    ),
  },
  {
    title: 'Flexible Storage',
    icon: 'S3',
    description: (
      <>
        Deploy anywhere with Local filesystem, MinIO, AWS S3, or Google Cloud Storage.
        True separation of compute and storage. Automatic Parquet compaction delivers 10-50x faster queries and 80% compression.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center" style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        color: 'var(--ifm-color-primary)'
      }}>
        {icon}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
