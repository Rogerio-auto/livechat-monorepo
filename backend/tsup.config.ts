import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    worker: "src/worker.ts",
    "worker.campaigns": "src/worker.campaigns.ts",
    "worker.flows": "src/worker.flows.ts",
  },
  sourcemap: true,
  splitting: false,
  clean: true,
  minify: false,
  platform: "node",
  target: "node20",
  format: ["esm"],
  shims: false,
  dts: false,
  env: {
    NODE_ENV: process.env.NODE_ENV ?? "production",
  },
  keepNames: true,
  treeshake: false,
  external: [
    "@supabase/supabase-js",
    "amqplib",
    "baileys",
    "cookie-parser",
    "express",
    "ioredis",
    "multer",
    "pg",
    "redlock",
    "socket.io",
  ],
});
