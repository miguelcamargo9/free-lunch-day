import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{packages,services,apps}/*/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
    env: { POWERTOOLS_LOG_LEVEL: 'SILENT' },
  },
});
