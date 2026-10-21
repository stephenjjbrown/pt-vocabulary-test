/**
 * Express server: serves the API and the built frontend (in production).
 *
 * In development, Vite runs the frontend on :5173 and proxies /api to
 * this server. In production, this server serves the static dist/ build.
 *
 * The SQLite database must be built first via `npm run preprocess`.
 */

import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Explicit .ts extension: Node's native TS support requires it and does NOT
// rewrite .js -> .ts the way Vite does. Browser-side imports keep .js because
// they go through Vite, which maps .js -> .ts itself.
import { getWordsUpToRank, getWordByRank, countWords, openDb, DB_PATH } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 3001;
const MAX_RANK_LIMIT = 100000;

const app = express();

// Lightweight request logger.
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

function dbExists(): boolean {
    return fs.existsSync(DB_PATH);
}

function safeCount(): number {
    try {
        return countWords();
    } catch {
        return 0;
    }
}

// Health check.
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, dbExists: dbExists(), wordCount: dbExists() ? safeCount() : 0 });
});

// GET /api/words?maxRank=64000
app.get('/api/words', (req: Request, res: Response) => {
    if (!dbExists()) {
        res.status(503).json({ error: 'Database not built. Run `npm run preprocess` first.' });
        return;
    }

    const raw = req.query.maxRank;
    const maxRank = raw === undefined ? 64000 : Number(raw);

    if (!Number.isInteger(maxRank) || maxRank < 1 || maxRank > MAX_RANK_LIMIT) {
        res.status(400).json({ error: `maxRank must be an integer 1..${MAX_RANK_LIMIT}` });
        return;
    }

    try {
        const rows = getWordsUpToRank(maxRank);
        // The client doesn't need freq, so don't send it.
        const words = rows.map(r => ({ word: r.word, rank: r.rank }));
        res.json({ maxRank, count: words.length, words });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('GET /api/words failed:', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/words/:rank
app.get('/api/words/:rank', (req: Request, res: Response) => {
    if (!dbExists()) {
        res.status(503).json({ error: 'Database not built.' });
        return;
    }

    const rank = Number(req.params.rank);
    if (!Number.isInteger(rank) || rank < 1) {
        res.status(400).json({ error: 'rank must be a positive integer' });
        return;
    }

    try {
        const word = getWordByRank(rank);
        if (!word) {
            res.status(404).json({ error: 'not found' });
            return;
        }
        res.json(word);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('GET /api/words/:rank failed:', message);
        res.status(500).json({ error: message });
    }
});

// In production, also serve the built frontend from dist/.
if (fs.existsSync(DIST)) {
    app.use(express.static(DIST));
    // SPA fallback: any non-/api GET renders index.html.
    app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
        res.sendFile(path.join(DIST, 'index.html'));
    });
} else {
    console.warn(`dist/ not found at ${DIST} -- in dev, Vite serves the frontend.`);
}

// Open the DB once at startup so we fail fast if it's missing or corrupt.
if (dbExists()) {
    try {
        openDb();
        console.log(`SQLite DB ready: ${DB_PATH}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to open DB: ${message}`);
    }
}

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});