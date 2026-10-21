/**
 * App — the root model. A singleton holding every piece of application
 * state as signals.
 *
 * Per AGENTS.md the model exposes only state. No methods. Every write
 * happens in a controller, which mutates bucket fields directly and then
 * publishes a new array reference so signal subscribers fire.
 *
 * Reads are safe from anywhere. Writes go through controllers in
 * `src/controllers/`, never from a view directly.
 */

import { signal, computed, type Signal } from '@preact/signals-core';

import { BUCKETS } from '../config.ts';
import { Bucket } from './bucket.ts';
import { Word } from './word.ts';

/** One answered (or skipped) word, as shown in the history list. */
export interface AnswerRecord {
    word: string;
    rank: number;
    /** 1.0 = yes, 0.5 = maybe, 0.0 = no, null = skip. */
    response: number | null;
}

/** Which screen is showing. */
export type Phase = 'loading' | 'ready' | 'results';

/** The question currently being asked. */
export interface CurrentQuestion {
    bucketIdx: number;
    word: Word;
}

export class App {
    // ── Corpus ────────────────────────────────────────────────────────
    readonly words = signal<Word[]>([]);
    readonly buckets = signal<Bucket[]>(BUCKETS.map(() => new Bucket()));

    // ── Session ───────────────────────────────────────────────────────
    readonly answers = signal(0);
    readonly askedWords = signal<ReadonlySet<string>>(new Set<string>());
    readonly history = signal<AnswerRecord[]>([]);
    readonly currentQuestion = signal<CurrentQuestion | null>(null);

    // ── Screen state ──────────────────────────────────────────────────
    readonly phase = signal<Phase>('loading');
    readonly loadError = signal<string | null>(null);

    // ── Derived ───────────────────────────────────────────────────────
    /** Total answered (non-skipped) questions, shown in the stats bar. */
    readonly questionCount = computed(() => this.answers.value);
}

/** The single App instance for the whole app. */
export const app: App = new App();

/** Re-exported for convenience so views can type signal-typed props. */
export type { Signal };