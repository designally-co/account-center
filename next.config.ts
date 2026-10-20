import type { NextConfig } from "next";

const config: NextConfig = {
  // One small Node server in the release image, for the NAS.
  output: "standalone",
  poweredByHeader: false,
  // No other site may show Account Center in a frame (it could trick an admin into a click).
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    }];
  },
};

export default config;
