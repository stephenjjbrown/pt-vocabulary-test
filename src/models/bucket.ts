/**
 * Tally of answers for one frequency bucket, and the values derived from it.
 *
 * The bucket knows how a response moves its counters (`record`) and what its
 * own estimate and uncertainty are. It does not know how to pick questions or
 * how buckets combine — those belong to `App`, which owns the collection.
 */

import { wilsonInterval, type Interval } from '../stats.ts';
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
     * Fraction of the bucket's words the user is estimated to know.
     * 0 when nothing has been answered — we have no data, so we claim nothing.
     */
    get pointEstimate(): number {
        const n = this.sampleSize;
        return n === 0 ? 0 : this.totalScore / n;
    }

    /** 95% interval on `pointEstimate`; the whole range when unanswered. */
    get credibleInterval(): Interval {
        return wilsonInterval(Math.round(this.totalScore), this.sampleSize);
    }

    /**
     * How uncertain this bucket is, as the width of its interval.
     *
     * The floor keeps every bucket eligible to be picked at least occasionally,
     * even once its interval has collapsed.
     */
    get uncertainty(): number {
        const ci = this.credibleInterval;
        return Math.max(ci.high - ci.low, 0.001);
    }

    /**
     * Record one response.
     *
     * `Active`, `Passive` and `NotKnown` are answers and count toward `asked`.
     * `Skipped` is not, so it only bumps `skippedCount`.
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