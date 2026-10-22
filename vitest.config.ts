/**
 * Vitest configuration.
 *
 * Kept separate from `vite.config.ts` so the build-only `vite-plugin-checker`
 * does not run during tests. Vitest transforms through Vite/esbuild, which
 * means test files get the same TypeScript handling as the app — including
 * `.ts` import specifiers and constructs Node's strip-only loader rejects.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
    },
});