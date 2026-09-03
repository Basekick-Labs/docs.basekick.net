'use client';

import { useEffect } from 'react';
import { LaunchPulse } from '@basekick-labs/launchpulse';

// The SDK fires the initial $pageview itself and hooks SPA navigations, so a
// one-time init is all the wiring the app needs. Module-level flag rather than
// a ref: React strict mode mounts effects twice in dev, and init must run once.
let initialized = false;

export function LaunchPulseAnalytics() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    // LaunchPulse is undefined during SSR/prerender; the effect only runs in
    // the browser, but the types keep the optional call honest.
    LaunchPulse?.init('lp_pub_g7NQzPgX3g5FyCJvQj6Qnj');
  }, []);
  return null;
}
