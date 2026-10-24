import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose only Vercel's deployment target so the browser can fail closed on Preview.
  // This is a public non-secret value; credentials must never be placed in next.config env.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "unknown",
  },
};

export default nextConfig;
