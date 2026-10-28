import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  turbopack: { root: process.cwd() },
  devIndicators: false,
};

export default config;
