import {useState, useEffect} from 'react';

interface GitHubStarsProps {
  repo: string;
  className?: string;
}

export default function GitHubStars({repo, className}: GitHubStarsProps) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    // Try to get cached value first
    const cached = localStorage.getItem(`github-stars-${repo}`);
    const cachedTime = localStorage.getItem(`github-stars-${repo}-time`);

    if (cached && cachedTime) {
      const age = Date.now() - parseInt(cachedTime, 10);
      // Use cache if less than 1 hour old
      if (age < 3600000) {
        setStars(parseInt(cached, 10));
        return;
      }
    }

    // Fetch from GitHub API
    fetch(`https://api.github.com/repos/${repo}`)
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count) {
          setStars(data.stargazers_count);
          localStorage.setItem(`github-stars-${repo}`, data.stargazers_count.toString());
          localStorage.setItem(`github-stars-${repo}-time`, Date.now().toString());
        }
      })
      .catch(() => {
        // On error, use cached value if available
        if (cached) {
          setStars(parseInt(cached, 10));
        }
      });
  }, [repo]);

  if (stars === null) {
    return null;
  }

  return (
    <span className={className}>
      <strong>{stars.toLocaleString()}</strong> GitHub stars
    </span>
  );
}
