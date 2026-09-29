import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sidebar lives on the left; keep the dev-only indicator out of its footer.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
