/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@milvaloop/ui', '@milvaloop/config', '@milvaloop/types'],
  // Traces the exact production dependency subset into .next/standalone
  // (a self-contained server.js plus only the node_modules it actually
  // needs) — see apps/web/Dockerfile, which copies just that output
  // rather than the whole monorepo's node_modules into the runtime image.
  output: 'standalone',
};

export default nextConfig;
