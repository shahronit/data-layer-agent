import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright", "better-sqlite3"],
  // Avoid picking a parent-folder lockfile when multiple exist on the machine
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
