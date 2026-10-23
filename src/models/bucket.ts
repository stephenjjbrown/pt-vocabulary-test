/**
 * Tally of answers for one frequency bucket, and the values derived from it.
 *
 * Three mutually exclusive outcomes per word: actively known, passively known,
 * or not known. "Known" is active plus passive — either answer means the word
 * is recognised in some form.
 *
 * Passive is a category of its own, not a half-strength yes: it is counted and
 * estimated on its own terms.
 *
 * The bucket knows how a response moves its counters and what its own estimates
 * are. It does not know how to pick questions or how buckets combine — those
 * belong to `App`, which owns the collection.
 */

import { wilsonInterval, type Interval } from '../stats.ts';
import type { BucketDef } from '../config.ts';
import { ResponseType } from './response-type.ts';

export class Bucket {
    activeCount = 0;
    passiveCount = 0;
    notKnownCount = 0;
    skippedCount = 0;
    asked = 0;

    /** Number of answered (non-skipped) questions. */
    get sampleSize(): number {
        return this.activeCount + this.passiveCount + this.notKnownCount;
    }

    /** Active plus passive: either answer means the word is known. */
    get knownCount(): number {
        return this.activeCount + this.passiveCount;
    }

    /** Fraction of the bucket's words estimated to be used actively. */
    get activeShare(): number {
        return this.shareOf(this.activeCount);
    }

    /** Fraction of the bucket's words estimated to be recognised but not used. */
    get passiveShare(): number {
        return this.shareOf(this.passiveCount);
    }

    /** Fraction of the bucket's words estimated to be known in any form. */
    get knownShare(): number {
        return this.shareOf(this.knownCount);
    }

    /** 95% interval on `activeShare`. */
    get activeInterval(): Interval {
        return wilsonInterval(this.activeCount, this.sampleSize);
    }

    /** 95% interval on `passiveShare`. */
    get passiveInterval(): Interval {
        return wilsonInterval(this.passiveCount, this.sampleSize);
    }

    /**
     * 95% interval on `knownShare`.
     *
     * Computed from the combined count rather than from the two category
     * intervals: active and passive compete for the same answers, so their
     * intervals cannot be added, and the union is more precise than either.
     */
    get knownInterval(): Interval {
        return wilsonInterval(this.knownCount, this.sampleSize);
    }

    /**
     * How uncertain this bucket is, as the width of the known interval.
     *
     * The floor keeps every bucket eligible to be picked at least occasionally,
     * even once its interval has collapsed.
     */
    get uncertainty(): number {
        const ci = this.knownInterval;
        return Math.max(ci.high - ci.low, 0.001);
    }

    /**
     * Record one response.
     *
     * Active, passive and not-known are all answers and count toward `asked`.
     * A skip is not, so it only bumps `skippedCount`.
     */
    record(response: ResponseType): void {
        switch (response) {
            case ResponseType.Active:
                this.activeCount += 1;
                this.asked += 1;
                break;
            case ResponseType.Passive:
                this.passiveCount += 1;
                this.asked += 1;
                break;
            case ResponseType.NotKnown:
                this.notKnownCount += 1;
                this.asked += 1;
                break;
            case ResponseType.Skipped:
                this.skippedCount += 1;
                break;
        }
    }

    reset(): void {
        this.activeCount = 0;
        this.passiveCount = 0;
        this.notKnownCount = 0;
        this.skippedCount = 0;
        this.asked = 0;
    }

    /** A count as a fraction of the answers; 0 before anything is answered. */
    private shareOf(count: number): number {
        const n = this.sampleSize;
        return n === 0 ? 0 : count / n;
    }
}

/** A fresh set of empty buckets, one per frequency band. */
export function emptyBuckets(defs: ReadonlyArray<BucketDef>): Bucket[] {
    return defs.map(() => new Bucket());
}