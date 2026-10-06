import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone (minimal server.js) for small Docker images.
  // See docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",
};

export default nextConfig;
