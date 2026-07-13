import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Content-Type",
          value: "application/javascript; charset=utf-8",
        },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
