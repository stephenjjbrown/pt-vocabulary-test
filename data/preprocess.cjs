/**
 * Preprocess lemapos.total.txt into data/words.db (SQLite)
 *
 * Uses the built-in `node:sqlite` module (Node 22.5+). No external
 * dependencies.
 *
 * Pipeline:
 *   1. Read as Latin-1 (NOT UTF-8 -- the source file is non-UTF-8 and
 *      reading it as UTF-8 produces mojibake for accented characters).
 *   2. Parse the (POS) tag from the end of each line.
 *   3. Drop:
 *        - PROP  (proper nouns)
 *        - PU, PUNC  (punctuation)
 *        - NUM   (number words -- "um", "dois", etc. are tagged DET;
 *                 NUM is for things like "1990", "XII", etc.)
 *        - any "word" that is purely punctuation/symbols
 *   4. Keep the word, drop the POS tag.
 *   5. Dedupe by lowercase word, sum frequencies across POS variants.
 *   6. Sort by frequency desc, write to data/words.db.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const INPUT = path.resolve(__dirname, '../raw/lemapos.total.txt');
const DB_PATH = path.resolve(__dirname, 'words.db');
const MAX_WORDS = 100000;

// POS tags to exclude. PROP = proper nouns. PU/PUNC = punctuation.
// NUM is excluded -- it's mostly digits/roman numerals, and number
// words like "um/dois" already appear under other tags (N, ADJ).
const EXCLUDED_POS = new Set(['PROP', 'PU', 'PUNC', 'NUM']);

// Match a (POS) tag at the end of the line. Group 1 is the tag.
const TAG_RE = /\(([^)]+)\)$/;

// A "valid" word must contain at least one letter, and may only contain
// letters, accented letters, hyphens, and apostrophes.
const WORD_RE = /^[a-zA-ZÀ-ÖØ-öø-ÿ'\-]+$/;

function preprocess() {
    console.log('Reading corpus...');
    const text = fs.readFileSync(INPUT, 'latin1');
    const lines = text.split('\n');

    const dict = new Map();
    let keptLines = 0;
    let excludedByTag = 0;
    let excludedByShape = 0;
    let excludedMalformed = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const tabIdx = line.indexOf('\t');
        if (tabIdx < 0) { excludedMalformed++; continue; }

        const frequency = parseInt(line.slice(0, tabIdx), 10);
        if (Number.isNaN(frequency)) { excludedMalformed++; continue; }

        let wordField = line.slice(tabIdx + 1);

        // Extract and remove the (POS) tag at the end of the word field.
        const tagMatch = wordField.match(TAG_RE);
        if (tagMatch) {
            const pos = tagMatch[1];
            if (EXCLUDED_POS.has(pos)) { excludedByTag++; continue; }
            wordField = wordField.slice(0, tagMatch.index).trim();
        }
        // Lines without a tag (e.g. "de ()") are accepted as-is.

        // Word must be non-empty and a "word" shape.
        if (!wordField || !WORD_RE.test(wordField)) {
            excludedByShape++;
            continue;
        }

        const word = wordField.toLowerCase();
        dict.set(word, (dict.get(word) || 0) + frequency);
        keptLines++;

        if (i % 200000 === 0) {
            console.log(`  Processed ${i.toLocaleString()} lines...`);
        }
    }

    console.log(`\nKept: ${keptLines.toLocaleString()}`);
    console.log(`Excluded (PROP/PU/PUNC/NUM tag): ${excludedByTag.toLocaleString()}`);
    console.log(`Excluded (non-word shape): ${excludedByShape.toLocaleString()}`);
    console.log(`Excluded (malformed line):  ${excludedMalformed.toLocaleString()}`);
    console.log(`Unique lemmas after dedup: ${dict.size.toLocaleString()}`);

    // Sort by frequency descending
    const sorted = [...dict.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_WORDS);

    console.log(`\nWriting top ${sorted.length} words to ${DB_PATH}...`);

    // Remove any existing DB and create a new one.
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

    const db = new DatabaseSync(DB_PATH);
    db.exec(`
        CREATE TABLE words (
            rank  INTEGER PRIMARY KEY,
            word  TEXT    NOT NULL,
            freq  INTEGER NOT NULL
        );
    `);

    // Build the rows as plain objects with positional fields, so the
    // statement.bind() calls match the prepared INSERT.
    const rows = sorted.map(([word, freq], index) => [index + 1, word, freq]);

    const insert = db.prepare('INSERT INTO words (rank, word, freq) VALUES (?, ?, ?)');
    db.exec('BEGIN');
    try {
        for (const r of rows) insert.run(...r);
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }

    db.close();

    const sizeMb = (fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2);
    console.log('Done!');
    console.log(`DB size: ${sizeMb} MB`);
}

preprocess();
