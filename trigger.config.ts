import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_jauhfgxfymakuuwbouxf",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
});
