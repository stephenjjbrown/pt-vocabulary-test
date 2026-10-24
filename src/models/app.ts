/**
 * App — the root model. A singleton whose only stored state is the answer
 * list and the session's current position; everything else is derived.
 *
 * Storing answers rather than tallies means a single list can feed more than
 * one bucket scheme. `fixedBuckets` and `dynamicBuckets` are the same answers
 * counted two ways, and both recompute whenever an answer is added.
 */

import { signal, computed, type Signal } from '@preact/signals-core';

import { BUCKETS, CONFIG, DYNAMIC_BUCKETS, type BucketDef } from '../config.ts';
import type { Interval } from '../stats.ts';
import { tally } from './aggregate.ts';
import type { AnswerRecord } from './answer.ts';
import type { Bucket } from './bucket.ts';
import { ResponseType } from './response-type.ts';
import { Word, type WordData } from './word.ts';

/** Which screen is showing. */
export type Phase = 'loading' | 'ready' | 'results';

export class App {
    // ── Corpus ────────────────────────────────────────────────────────
    readonly words = signal<Word[]>([]);

    // ── Session ───────────────────────────────────────────────────────
    /** Every answer given, newest first. The one stored source of truth. */
    readonly history = signal<AnswerRecord[]>([]);
    /** The word currently being asked about. */
    readonly currentWord = signal<Word | null>(null);

    // ── Screen state ──────────────────────────────────────────────────
    readonly phase = signal<Phase>('loading');
    readonly loadError = signal<string | null>(null);

    // ── Derived from the answer list ──────────────────────────────────
    /** Answers that were real, i.e. not skipped. */
    readonly questionCount = computed(
        () => this.history.value.reduce(
            (n, a) => (a.response === ResponseType.Skipped ? n : n + 1),
            0
        )
    );

    /** Words already shown, so none is asked twice. */
    readonly askedWords = computed<ReadonlySet<string>>(
        () => new Set(this.history.value.map(a => a.word))
    );

    /** The hand-picked buckets: composition chart, totals, question selection. */
    readonly fixedBuckets = computed(() => tally(this.history.value, BUCKETS));

    /** The generated buckets: the area chart. */
    readonly dynamicBuckets = computed(
        () => tally(this.history.value, DYNAMIC_BUCKETS)
    );

    // ── Totals, over the hand-picked buckets ──────────────────────────
    readonly vocabularyEstimate = computed((): number =>
        this.totalWords(this.fixedBuckets.value, BUCKETS, b => b.knownShare)
    );
    readonly activeVocabulary = computed((): number =>
        this.totalWords(this.fixedBuckets.value, BUCKETS, b => b.activeShare)
    );
    readonly passiveVocabulary = computed((): number =>
        this.totalWords(this.fixedBuckets.value, BUCKETS, b => b.passiveShare)
    );

    readonly vocabularyInterval = computed((): Interval =>
        this.totalInterval(this.fixedBuckets.value, BUCKETS, b => b.knownInterval)
    );
    readonly activeVocabularyInterval = computed((): Interval =>
        this.totalInterval(this.fixedBuckets.value, BUCKETS, b => b.activeInterval)
    );
    readonly passiveVocabularyInterval = computed((): Interval =>
        this.totalInterval(this.fixedBuckets.value, BUCKETS, b => b.passiveInterval)
    );

    // ── Lifecycle ─────────────────────────────────────────────────────

    /** Store the corpus and show the first word. */
    begin(data: WordData[]): void {
        this.words.value = data.map(d => new Word(d));
        this.loadError.value = null;
        this.phase.value = 'ready';
        this.askNext();
    }

    /** Show a load failure instead of the first word. */
    fail(message: string): void {
        this.loadError.value = message;
        this.phase.value = 'loading';
    }

    /** Clear every answer and start again from the first word. */
    reset(): void {
        this.history.value = [];
        this.currentWord.value = null;
        this.phase.value = 'ready';
        this.askNext();
    }

    // ── Answering ─────────────────────────────────────────────────────

    /**
     * Record an answer about the current word and advance.
     *
     * Skipped is stored like any other response — it just does not count as an
     * answer when the buckets are tallied, and the word still leaves the pool.
     */
    answer(response: ResponseType): void {
        const current = this.currentWord.peek();
        if (!current) return;

        this.history.value = [
            { word: current.word, rank: current.rank, response },
            ...this.history.peek(),
        ];

        this.askNext();
    }

    // ── Question selection ────────────────────────────────────────────

    /** Pick the next word, or move to the results screen when none remain. */
    private askNext(): void {
        const wordIdx = this.selectNextWord();
        if (wordIdx === null) {
            this.phase.value = 'results';
            return;
        }

        const word = this.words.peek()[wordIdx];
        if (!word) return;

        this.currentWord.value = word;
    }

    /**
     * Choose a bucket weighted by how uncertain we are about it (confidence
     * interval width), then an unasked word inside it.
     *
     * Selection works over the generated buckets, so the bands are uniform and
     * effort is spread evenly across the rank range rather than following the
     * hand-picked widths. Note the headline totals are still summed over the
     * hand-picked scheme, so the two views can differ slightly.
     */
    private selectNextWord(): number | null {
        const buckets = this.dynamicBuckets.peek();
        const words = this.words.peek();
        if (buckets.length === 0 || words.length === 0) return null;

        const weights = buckets.map(b => b.uncertainty);
        const total = weights.reduce((a, w) => a + w, 0);
        if (total <= 0) return null;

        const r = Math.random() * total;
        let cum = 0;
        let bucketIdx = weights.length - 1;
        for (let i = 0; i < weights.length; i++) {
            cum += weights[i]!;
            if (r < cum) {
                bucketIdx = i;
                break;
            }
        }

        const def = DYNAMIC_BUCKETS[bucketIdx];
        if (!def) return null;

        const asked = this.askedWords.peek();
        const inBucket: number[] = [];
        for (let i = 0; i < words.length; i++) {
            const w = words[i]!;
            if (w.rank >= def.start && w.rank <= def.end && !asked.has(w.word)) {
                inBucket.push(i);
            }
        }

        if (inBucket.length > 0) {
            return inBucket[Math.floor(Math.random() * inBucket.length)]!;
        }

        // This bucket has no unseen words left; fall back to any unseen word.
        const anywhere: number[] = [];
        for (let i = 0; i < words.length; i++) {
            if (!asked.has(words[i]!.word)) anywhere.push(i);
        }
        if (anywhere.length === 0) return null;

        return anywhere[Math.floor(Math.random() * anywhere.length)]!;
    }

    // ── Aggregation helpers ───────────────────────────────────────────

    /** Sum one per-bucket share, scaled by bucket width, into a word count. */
    private totalWords(
        buckets: readonly Bucket[],
        defs: readonly BucketDef[],
        shareOf: (b: Bucket) => number
    ): number {
        let total = 0;
        for (let i = 0; i < defs.length; i++) {
            const bucket = buckets[i];
            if (!bucket) continue;
            total += shareOf(bucket) * defs[i]!.width;
        }
        return total;
    }

    /** Sum per-bucket intervals, scaled by width, into a word-count interval. */
    private totalInterval(
        buckets: readonly Bucket[],
        defs: readonly BucketDef[],
        intervalOf: (b: Bucket) => Interval
    ): Interval {
        let low = 0;
        let high = 0;
        for (let i = 0; i < defs.length; i++) {
            const bucket = buckets[i];
            if (!bucket) continue;
            const ci = intervalOf(bucket);
            const width = defs[i]!.width;
            low += ci.low * width;
            high += ci.high * width;
        }
        return { low: Math.round(low), high: Math.round(high) };
    }
}

/** The single App instance for the whole app. */
export const app: App = new App();

/** Re-exported for convenience so views can type signal-typed props. */
export type { Signal, AnswerRecord };

/** The corpus size, re-exported for views that need to reason about the axis. */
export const MAX_RANK = CONFIG.MAX_RANK;