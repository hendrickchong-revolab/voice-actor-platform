import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Tells Next.js the project root is this directory, not the monorepo root.
  // Suppresses the multiple-lockfiles warning and ensures correct build traces.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
