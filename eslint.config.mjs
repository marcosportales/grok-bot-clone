import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The vendored registry components mark a deliberately unused binding with
    // a leading underscore. `_id` and `_uint8Array` both mean "destructured to
    // keep it out of the spread", so the rule reads the underscore as intent
    // instead of a warning a reader has to re-derive.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".trigger/**",
    "next-env.d.ts",
    // Skills installed from upstream (skills-lock.json) carry templates and
    // example projects written for other frameworks, and this repo's own skill
    // scripts run in the agent harness rather than in the app. tsc already skips
    // dotted paths, so this ignore is the only place the decision lives.
    ".agents/**",
  ]),
]);

export default eslintConfig;
