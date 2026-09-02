import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Match the existing URL shape exactly: every page is <path>/index.html
  // and every link carries the trailing slash.
  trailingSlash: true,
  output: 'export',
  reactStrictMode: true,
};

export default withMDX(config);
