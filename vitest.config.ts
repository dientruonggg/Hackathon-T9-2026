import { defineConfig } from "vitest/config";\nexport default defineConfig({\n  test: {\n    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"]\n  }\n});
