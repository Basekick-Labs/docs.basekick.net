import {useState, useEffect} from 'react';

interface LatestVersionProps {
  repo: string;
  format?: 'version' | 'tag'; // 'version' returns "26.02.2", 'tag' returns "v26.02.2"
  className?: string;
}

export default function LatestVersion({repo, format = 'version', className}: LatestVersionProps) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    // Try to get cached value first
    const cached = localStorage.getItem(`latest-version-${repo}`);
    const cachedTime = localStorage.getItem(`latest-version-${repo}-time`);

    if (cached && cachedTime) {
      const age = Date.now() - parseInt(cachedTime, 10);
      // Use cache if less than 1 hour old
      if (age < 3600000) {
        setVersion(cached);
        return;
      }
    }

    // Fetch from GitHub API
    fetch(`https://api.github.com/repos/${repo}/releases/latest`)
      .then(res => res.json())
      .then(data => {
        if (data.tag_name) {
          const tag = data.tag_name;
          const versionNumber = tag.startsWith('v') ? tag.substring(1) : tag;
          const result = format === 'tag' ? tag : versionNumber;

          setVersion(result);
          localStorage.setItem(`latest-version-${repo}`, result);
          localStorage.setItem(`latest-version-${repo}-time`, Date.now().toString());
        }
      })
      .catch(() => {
        // On error, use cached value if available
        if (cached) {
          setVersion(cached);
        }
      });
  }, [repo, format]);

  if (version === null) {
    return <span className={className}>...</span>;
  }

  return <span className={className}>{version}</span>;
}
