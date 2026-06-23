import { solidPane, buildConfig } from "solidos-toolkit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: solidPane({
    litDecoratorPaths: [],
    sandbox: {
      subject: "https://solidos.solidcommunity.net/Contacts/index.ttl#this",
    },
  }),
  resolve: {
    tsconfigPaths: true,
  },
  build: buildConfig({ entry: "src/index.ts" }),
  test: {
    environment: "jsdom",
    setupFiles: ["test/helpers/setup.ts"],
    coverage: {
      include: ["src/**/*.[jt]s"],
    },
  },
});
