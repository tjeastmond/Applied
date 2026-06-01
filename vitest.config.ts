import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "external-bun-modules",
      enforce: "pre",
      resolveId(source) {
        if (source.startsWith("bun:")) {
          return { id: source, external: true };
        }
        return null;
      },
    },
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.bun.test.ts"],
    pool: "forks",
  },
});
