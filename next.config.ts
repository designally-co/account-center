import type { NextConfig } from "next";

const config: NextConfig = {
  // One small Node server in the release image, for the NAS.
  output: "standalone",
  poweredByHeader: false,
};

export default config;
