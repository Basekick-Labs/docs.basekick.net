'use client';

import { useEffect, useState } from 'react';

const CACHE_MS = 3600_000;

interface GitHubStarsProps {
  repo: string;
  className?: string;
}

/**
 * Live star count for a repo, fetched client-side and cached for an hour.
 * Renders nothing until it resolves, so a failed fetch leaves no empty label.
 */
export default function GitHubStars({ repo, className }: GitHubStarsProps) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const key = `github-stars-${repo}`;
    let cached: string | null = null;

    try {
      cached = localStorage.getItem(key);
      const at = localStorage.getItem(`${key}-time`);
      if (cached && at && Date.now() - Number.parseInt(at, 10) < CACHE_MS) {
        setStars(Number.parseInt(cached, 10));
        return;
      }
    } catch {
      /* ignore */
    }

    let active = true;
    fetch(`https://api.github.com/repos/${repo}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { stargazers_count?: number }) => {
        if (!active || typeof data.stargazers_count !== 'number') return;
        setStars(data.stargazers_count);
        try {
          localStorage.setItem(key, String(data.stargazers_count));
          localStorage.setItem(`${key}-time`, Date.now().toString());
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (active && cached) setStars(Number.parseInt(cached, 10));
      });

    return () => {
      active = false;
    };
  }, [repo]);

  if (stars === null) return null;

  return (
    <span className={className}>
      <strong>{stars.toLocaleString()}</strong> GitHub stars
    </span>
  );
}
