/**
 * Word-picking logic.
 *
 * Pure: takes buckets/words/asked, returns a choice. Mutates nothing.
 */

import { BUCKETS } from '../config.ts';
import { bucketUncertainty } from '../stats.ts';
import type { Bucket } from '../models/bucket.ts';

/** A word chosen from the corpus, with the bucket it belongs to. */
export interface Candidate {
    bucketIdx: number;
    wordIdx: number;
}

/**
 * Pick a bucket weighted by CI width (how uncertain we are about it), then
 * a word inside it that hasn't been asked yet. Returns null when every
 * word has been seen.
 */
export function selectNextWord(
    buckets: Bucket[],
    words: ReadonlyArray<{ word: string; rank: number }>,
    asked: ReadonlySet<string>
): Candidate | null {
    if (buckets.length === 0 || words.length === 0) return null;

    const weights = buckets.map(b => bucketUncertainty(b));
    const totalWeight = weights.reduce((a, w) => a + w, 0);
    if (totalWeight <= 0) return null;

    const r = Math.random() * totalWeight;
    let cum = 0;
    let bucketIdx = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
        cum += weights[i]!;
        if (r < cum) { bucketIdx = i; break; }
    }

    const def = BUCKETS[bucketIdx];
    if (!def) return null;

    const inBucket: number[] = [];
    for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        if (w.rank >= def.start && w.rank <= def.end && !asked.has(w.word)) {
            inBucket.push(i);
        }
    }

    if (inBucket.length > 0) {
        return { bucketIdx, wordIdx: inBucket[Math.floor(Math.random() * inBucket.length)]! };
    }

    // Bucket exhausted: fall back to any unasked word anywhere.
    const anywhere: number[] = [];
    for (let i = 0; i < words.length; i++) {
        if (!asked.has(words[i]!.word)) anywhere.push(i);
    }
    if (anywhere.length === 0) return null;
    return { bucketIdx, wordIdx: anywhere[Math.floor(Math.random() * anywhere.length)]! };
}