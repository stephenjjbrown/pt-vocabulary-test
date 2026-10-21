/**
 * SQLite database access for the words corpus.
 *
 * The database is built by `data/preprocess.cjs` (one-shot, run via
 * `npm run preprocess`). At runtime we only read from it.
 *
 * Uses the built-in `node:sqlite` module (Node 22.5+). No external dependency.
 *
 * Schema:
 *   CREATE TABLE words (
 *       rank  INTEGER PRIMARY KEY,
 *       word  TEXT    NOT NULL,
 *       freq  INTEGER NOT NULL
 *   );
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, '..', 'data', 'words.db');

export interface WordRow {
    rank: number;
    word: string;
    freq: number;
}

let db: DatabaseSync | null = null;

/** Open the database (singleton). Throws if the file is missing. */
export function openDb(): DatabaseSync {
    db ??= new DatabaseSync(DB_PATH, { readOnly: true });
    return db;
}

/** Return all words with rank <= maxRank, sorted by rank ascending. */
export function getWordsUpToRank(maxRank: number): WordRow[] {
    const conn = openDb();
    const stmt = conn.prepare(
        'SELECT rank, word, freq FROM words WHERE rank <= ? ORDER BY rank ASC'
    );
    return stmt.all(maxRank) as unknown as WordRow[];
}

/** Lookup a single word by rank. Returns null if not found. */
export function getWordByRank(rank: number): WordRow | null {
    const conn = openDb();
    const row = conn.prepare('SELECT rank, word, freq FROM words WHERE rank = ?').get(rank);
    return (row as unknown as WordRow | undefined) ?? null;
}

/** Total number of rows in the words table. */
export function countWords(): number {
    const conn = openDb();
    const row = conn.prepare('SELECT COUNT(*) AS n FROM words').get() as unknown as { n: number };
    return row.n;
}