/**
 * Tally of answers for one frequency bucket.
 *
 * Owns its own bookkeeping: callers hand it a response and it updates the
 * right counter.
 */

import type { BucketDef } from '../config.ts';

export class Bucket {
    yesCount = 0;
    maybeCount = 0;
    noCount = 0;
    skippedCount = 0;
    asked = 0;

    /** Number of answered (non-skipped) questions. */
    get sampleSize(): number {
        return this.yesCount + this.maybeCount + this.noCount;
    }

    /** "Yes" counts 1, "maybe" counts 0.5, "no" counts 0. */
    get totalScore(): number {
        return this.yesCount + 0.5 * this.maybeCount;
    }

    /**
     * Record one response.
     *   response: 1.0 = yes, 0.5 = maybe, 0.0 = no, null = skip
     *
     * A skip bumps `skippedCount` only: it is not an answer, so it does not
     * affect `sampleSize`, `totalScore` or `asked`.
     */
    record(response: number | null): void {
        if (response === null) {
            this.skippedCount += 1;
            return;
        }

        if (response === 1.0) this.yesCount += 1;
        else if (response === 0.0) this.noCount += 1;
        else if (response === 0.5) this.maybeCount += 1;

        this.asked += 1;
    }

    reset(): void {
        this.yesCount = 0;
        this.maybeCount = 0;
        this.noCount = 0;
        this.skippedCount = 0;
        this.asked = 0;
    }
}

/** A fresh set of empty buckets, one per frequency band. */
export function emptyBuckets(defs: ReadonlyArray<BucketDef>): Bucket[] {
    return defs.map(() => new Bucket());
}