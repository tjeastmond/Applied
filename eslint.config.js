import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "data/",
      "node_modules/",
      "eslint.config.js",
      "prettier.config.js",
      "src/components/ui/**",
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
    files: ["server/db/sqliteRepository.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
);
