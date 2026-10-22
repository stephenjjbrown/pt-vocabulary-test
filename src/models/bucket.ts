/**
 * Tally of answers for one frequency bucket.
 *
 * Owns its own bookkeeping: callers hand it a response and it updates the
 * right counter.
 */

import type { BucketDef } from '../config.ts';
import { ResponseType } from './response-type.ts';

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
     *
     * `Active` and `Passive` are answers and count toward `asked`; `NotKnown`
     * is an answer too. `Skipped` is not, so it only bumps `skippedCount`.
     */
    record(response: ResponseType): void {
        switch (response) {
            case ResponseType.Active:
                this.yesCount += 1;
                this.asked += 1;
                break;
            case ResponseType.Passive:
                this.maybeCount += 1;
                this.asked += 1;
                break;
            case ResponseType.NotKnown:
                this.noCount += 1;
                this.asked += 1;
                break;
            case ResponseType.Skipped:
                this.skippedCount += 1;
                break;
        }
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