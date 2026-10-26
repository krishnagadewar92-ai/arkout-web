import type { NextConfig } from "next";

const isPreview = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === "preview";
const configuredTerminal02Base = isPreview
  ? (process.env.NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL || "https://api2-staging.invalid")
  : (
      process.env.ARKOUT_TERMINAL_02_API_BASE_URL ||
      process.env.ARKOUT_ADS_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://api2.arkout.in"
    );
const terminal02Base = configuredTerminal02Base.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Keep all Terminal 02 calls same-origin in the browser. External
        // rewrites stream multipart uploads without a custom API route body cap.
        source: "/api/terminal02-proxy/:path*",
        destination: `${terminal02Base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
