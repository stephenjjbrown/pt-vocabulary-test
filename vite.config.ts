/**
 * Vite config.
 *
 * During dev: the Vite dev server runs on :5173 and proxies /api
 * requests to the Express server on :3001, so the frontend can call
 * `/api/words` with no CORS setup.
 *
 * In production: `vite build` produces a static dist/ which the Express
 * server (server/index.ts) serves directly.
 *
 * vite-plugin-checker runs `tsc` in a background process:
 *   - dev:  type errors appear in the browser overlay and the terminal
 *   - build: `vite build` exits non-zero on a type error, so the
 *            build command itself is gated even if invoked directly.
 * `enableBuild` already defaults to true; it is set explicitly here to
 * document the policy.
 */

import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

const API_PORT = process.env.API_PORT ?? '3001';

export default defineConfig({
    plugins: [
        checker({
            typescript: { tsconfigPath: './tsconfig.json' },
            enableBuild: true,
            overlay: true,
            terminal: true,
        }),
    ],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: `http://localhost:${API_PORT}`,
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});