import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      ".next/",
      "data/",
      "node_modules/",
      "eslint.config.js",
      "prettier.config.js",
      "next.config.ts",
      "postcss.config.mjs",
      "vitest.config.ts",
      "src/components/ui/**",
      "next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/lib/server/db/sqliteRepository.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
);
