import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Match the existing URL shape exactly: every page is <path>/index.html
  // and every link carries the trailing slash.
  trailingSlash: true,
  output: 'export',
  reactStrictMode: true,
  images: {
    // Markdown images map to next/image, whose default loader needs a server.
    // Under `output: 'export'` that combination throws at render time, which
    // took out every Arc Enterprise page carrying an architecture diagram.
    unoptimized: true,
  },
};

export default withMDX(config);
