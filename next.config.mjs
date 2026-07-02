/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build → small Fargate image, `node server.js` entrypoint.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only integration SDKs must never be bundled into client chunks.
  serverExternalPackages: [
    "postgres",
    "ioredis",
    "@aws-sdk/client-sts",
    "@azure/identity",
    "@cdktf/hcl2json",
  ],
  experimental: {
    // Topology + estate payloads can be large; allow generous server action bodies.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
