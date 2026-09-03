'use client';

import { useEffect, useState } from 'react';

const CACHE_MS = 3600_000;

interface LatestVersionProps {
  repo: string;
  /** 'version' renders "26.09.1", 'tag' renders "v26.09.1". */
  format?: 'version' | 'tag';
  className?: string;
}

/**
 * Renders the repo's latest release, fetched client-side so a static export
 * still shows the current version without a rebuild. Cached in localStorage
 * for an hour to stay well inside GitHub's unauthenticated rate limit.
 */
export default function LatestVersion({ repo, format = 'version', className }: LatestVersionProps) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const key = `latest-version-${repo}-${format}`;
    let cached: string | null = null;

    // Storage throws in some privacy modes; the component must still render.
    try {
      cached = localStorage.getItem(key);
      const at = localStorage.getItem(`${key}-time`);
      if (cached && at && Date.now() - Number.parseInt(at, 10) < CACHE_MS) {
        setVersion(cached);
        return;
      }
    } catch {
      /* ignore */
    }

    let active = true;
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { tag_name?: string }) => {
        if (!active || !data.tag_name) return;
        const tag = data.tag_name;
        const result = format === 'tag' ? tag : tag.replace(/^v/, '');
        setVersion(result);
        try {
          localStorage.setItem(key, result);
          localStorage.setItem(`${key}-time`, Date.now().toString());
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (active && cached) setVersion(cached);
      });

    return () => {
      active = false;
    };
  }, [repo, format]);

  // Render a stable placeholder rather than nothing, so surrounding prose does
  // not reflow once the fetch resolves.
  return <span className={className}>{version ?? '…'}</span>;
}
