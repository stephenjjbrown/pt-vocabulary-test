/**
 * App — the root model. A singleton holding all application state, plus the
 * operations that change it.
 *
 * Views read the signals directly and call methods on this object. Nothing
 * else mutates state.
 */

import { signal, computed, type Signal } from '@preact/signals-core';

import { BUCKETS } from '../config.ts';
import { bucketUncertainty } from '../stats.ts';
import { Bucket, emptyBuckets } from './bucket.ts';
import { ResponseType } from './response-type.ts';
import { Word, type WordData } from './word.ts';

/** One answered (or skipped) word, as shown in the history list. */
export interface AnswerRecord {
    word: string;
    rank: number;
    response: ResponseType;
}

/** Which screen is showing. */
export type Phase = 'loading' | 'ready' | 'results';

/** The word currently being asked about. */
export interface CurrentWord {
    bucketIdx: number;
    word: Word;
}

/** Cap on stored history, so a long session cannot grow without bound. */
const MAX_HISTORY = 1000;

export class App {
    // ── Corpus ────────────────────────────────────────────────────────
    readonly words = signal<Word[]>([]);
    readonly buckets = signal<Bucket[]>(emptyBuckets(BUCKETS));

    // ── Session ───────────────────────────────────────────────────────
    readonly answers = signal(0);
    readonly askedWords = signal<ReadonlySet<string>>(new Set<string>());
    readonly history = signal<AnswerRecord[]>([]);
    readonly currentWord = signal<CurrentWord | null>(null);

    // ── Screen state ──────────────────────────────────────────────────
    readonly phase = signal<Phase>('loading');
    readonly loadError = signal<string | null>(null);

    // ── Derived ───────────────────────────────────────────────────────
    readonly questionCount = computed(() => this.answers.value);

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
        this.buckets.value = emptyBuckets(BUCKETS);
        this.answers.value = 0;
        this.currentWord.value = null;
        this.askedWords.value = new Set<string>();
        this.history.value = [];
        this.phase.value = 'ready';
        this.askNext();
    }

    // ── Answering ─────────────────────────────────────────────────────

    /**
     * Record an answer about the current word and advance.
     *
     * `Skipped` leaves the tallies and the answer count alone; it only removes
     * the word from the pool so it is not shown again.
     */
    answer(response: ResponseType): void {
        const current = this.currentWord.peek();
        if (!current) return;

        const buckets = this.buckets.peek();
        const bucket = buckets[current.bucketIdx];
        if (!bucket) return;

        bucket.record(response);

        if (response !== ResponseType.Skipped) {
            this.answers.value += 1;
            this.askedWords.value = new Set(this.askedWords.peek()).add(current.word.word);
        }

        this.history.value = [
            { word: current.word.word, rank: current.word.rank, response },
            ...this.history.peek(),
        ].slice(0, MAX_HISTORY);

        // Publish fresh bucket copies: the array item mutated in place, and a
        // signal write only notifies subscribers when the reference changes.
        // `Object.assign` rather than spread or `structuredClone`, because both
        // of those return a plain object and would lose the `Bucket` getters.
        this.buckets.value = buckets.map(b => Object.assign(new Bucket(), b));

        this.askNext();
    }

    // ── Question selection ────────────────────────────────────────────

    /** Pick the next word, or move to the results screen when none remain. */
    private askNext(): void {
        const candidate = this.selectNextWord();
        if (!candidate) {
            this.phase.value = 'results';
            return;
        }

        const word = this.words.peek()[candidate.wordIdx];
        if (!word) return;

        this.currentWord.value = { bucketIdx: candidate.bucketIdx, word };
    }

    /**
     * Choose a bucket weighted by how uncertain we are about it (confidence
     * interval width), then an unasked word inside it.
     */
    private selectNextWord(): { bucketIdx: number; wordIdx: number } | null {
        const buckets = this.buckets.peek();
        const words = this.words.peek();
        if (buckets.length === 0 || words.length === 0) return null;

        const weights = buckets.map(b => bucketUncertainty(b));
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

        const def = BUCKETS[bucketIdx];
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
            return {
                bucketIdx,
                wordIdx: inBucket[Math.floor(Math.random() * inBucket.length)]!,
            };
        }

        // This bucket has no unseen words left; fall back to any unseen word.
        const anywhere: number[] = [];
        for (let i = 0; i < words.length; i++) {
            if (!asked.has(words[i]!.word)) anywhere.push(i);
        }
        if (anywhere.length === 0) return null;

        return {
            bucketIdx,
            wordIdx: anywhere[Math.floor(Math.random() * anywhere.length)]!,
        };
    }
}

/** The single App instance for the whole app. */
export const app: App = new App();

/** Re-exported for convenience so views can type signal-typed props. */
export type { Signal };