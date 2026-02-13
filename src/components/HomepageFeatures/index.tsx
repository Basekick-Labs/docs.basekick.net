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
    title: 'Blazing Fast Ingestion',
    icon: '18.6M',
    description: (
      <>
        Ingest 18.6M records/sec with MessagePack columnar format.
        &lt;10ms p99 latency. Built for IoT sensors, metrics collection,
        and observability platforms that need extreme write performance.
      </>
    ),
  },
  {
    title: 'Lightning Fast Queries',
    icon: '2.64M',
    description: (
      <>
        Query 2.64M rows/sec with DuckDB's columnar engine. Sub-second
        time-windowed aggregations with full ANSI SQL support.
        MQTT ingestion, Python SDK, Apache Arrow, and JSON outputs.
      </>
    ),
  },
  {
    title: 'Flexible Storage',
    icon: 'S3',
    description: (
      <>
        Deploy anywhere with Local filesystem, MinIO, AWS S3, or Azure Blob Storage.
        True separation of compute and storage. Automatic Parquet compaction
        delivers 10-50x faster queries and 80% compression.
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
