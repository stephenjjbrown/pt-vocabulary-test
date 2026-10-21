/**
 * App-level actions: corpus lifecycle, session orchestration, advancing to
 * the next word, recording answers, resetting.
 *
 * Stateless. Every function mutates the `app` singleton and nothing else.
 *
 * Bucket field mutations happen inline in `answer()` and then a fresh
 * array reference is published so signal subscribers fire. The array-clone
 * pattern is the one place where controllers know about reactivity — it's
 * simpler than introducing a BucketController for a single operation.
 */

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import { Bucket } from '../models/bucket.ts';
import { Word, type WordData } from '../models/word.ts';
import { selectNextWord } from './word-picker.ts';
import { add as historyAdd, reset as historyReset } from './history-controller.ts';

/** Replace the buckets array with a fresh array of fresh buckets. */
function freshBuckets(): Bucket[] {
    return BUCKETS.map(() => new Bucket());
}

/** Replace the bucket array in place — used after mutating a bucket's
 *  fields, so signal subscribers fire. */
function publishBuckets(): void {
    app.buckets.value = app.buckets.peek().map(b => b.clone());
}

/** Mark the app as ready once the corpus has loaded. */
export function corpusLoaded(): void {
    app.loadError.value = null;
    app.phase.value = 'ready';
    askNextWord();
}

/** Surface a corpus load failure. */
export function corpusFailed(message: string): void {
    app.loadError.value = message;
    app.phase.value = 'loading';
}

/** Populate the word list from the API response. */
export function loadWords(data: WordData[]): void {
    app.words.value = data.map(d => new Word(d));
}

/** Move the model to the next word, or to the results screen. */
export function askNextWord(): void {
    const candidate = selectNextWord(
        app.buckets.peek(),
        app.words.peek(),
        app.askedWords.peek()
    );

    if (!candidate) {
        // Every word has been seen.
        app.phase.value = 'results';
        return;
    }

    const word = app.words.peek()[candidate.wordIdx];
    if (!word) return;

    app.currentQuestion.value = { bucketIdx: candidate.bucketIdx, word };
}

/**
 * Record an answer about the current word.
 *   response: 1.0 = yes, 0.5 = maybe, 0.0 = no, null = skip
 *
 * Skip is a no-op on the bucket tallies and the answer count. It still
 * shows up in the history so the user can see what they passed over.
 */
export function answer(response: number | null): void {
    const current = app.currentQuestion.peek();
    if (!current) return;

    const { word, bucketIdx } = current;
    const buckets = app.buckets.peek();
    const bucket = buckets[bucketIdx];
    if (!bucket) return;

    if (response === null) {
        bucket.skippedCount += 1;
    } else {
        if (response === 1.0) bucket.yesCount += 1;
        else if (response === 0.0) bucket.noCount += 1;
        else if (response === 0.5) bucket.maybeCount += 1;
        bucket.asked += 1;
        app.answers.value += 1;
        app.askedWords.value = new Set(app.askedWords.peek()).add(word.word);
    }

    publishBuckets();
    historyAdd({ word: word.word, rank: word.rank, response });
    askNextWord();
}

/** Clear every answer and start over. */
export function reset(): void {
    app.buckets.value = freshBuckets();
    app.answers.value = 0;
    app.askedWords.value = new Set<string>();
    app.currentQuestion.value = null;
    historyReset();
    app.phase.value = 'ready';
    askNextWord();
}

/** Show the final results. */
export function showResults(): void {
    app.phase.value = 'results';
}