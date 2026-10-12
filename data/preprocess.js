/**
 * Preprocess lemas.total.txt into a clean ranked-words.json
 * - Deduplicate by word (lowercase, sum frequencies)
 * - Filter valid Portuguese words
 * - Sort by frequency descending
 * - Output top N with rank
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '../raw/lemas.total.txt');
const OUTPUT = path.resolve(__dirname, '../public/ranked-words.json');
const MAX_WORDS = 100000; // Keep top 100K lemmas

function preprocess() {
    console.log('Reading corpus...');
    const text = fs.readFileSync(INPUT, 'utf-8');
    const lines = text.split('\n');

    const dict = new Map();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split('\t');
        if (parts.length < 2) continue;

        let frequency = parseInt(parts[0], 10);
        let word = parts[1];

        // Only valid Portuguese words (letters, accents, hyphens)
        if (!/^[a-zA-Z\u00c0-\u00fc\-]*$/.test(word) || !/[a-zA-Z\u00c0-\u00fc]/.test(word)) {
            continue;
        }

        word = word.toLowerCase();

        if (isNaN(frequency)) continue;

        dict.set(word, (dict.get(word) || 0) + frequency);

        if (i % 100000 === 0) {
            console.log(`  Processed ${i.toLocaleString()} lines...`);
        }
    }

    console.log(`Unique lemmas: ${dict.size.toLocaleString()}`);

    // Sort by frequency descending
    const sorted = [...dict.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_WORDS)
        .map(([word, freq], index) => ({
            word,
            rank: index + 1, // 1-based rank
            freq
        }));

    console.log(`Writing top ${sorted.length} words...`);
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(sorted));

    console.log('Done!');
    console.log(`Output: ${OUTPUT}`);
    console.log(`File size: ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB`);
}

preprocess();
