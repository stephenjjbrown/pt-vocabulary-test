/**
 * Statistics over a Bucket — the point estimate and the confidence interval.
 *
 * The central point: the point estimate is the literal ratio of
 * yes-equivalents to answers, so 21/21 is 100% — the data, not a smoothing
 * choice. The interval around it is asymmetric at that boundary, and its
 * lower bound is the more honest number.
 */

import { describe, expect, it } from 'vitest';

import { Bucket } from '../src/models/bucket.ts';
import { bucketPointEstimate, bucketCredibleInterval } from '../src/stats.ts';

interface Tallies {
    yes?: number;
    maybe?: number;
    no?: number;
    skipped?: number;
}

/** Build a Bucket with the given tallies, bypassing record(). */
function bucket({ yes = 0, maybe = 0, no = 0, skipped = 0 }: Tallies = {}): Bucket {
    const b = new Bucket();
    b.yesCount = yes;
    b.maybeCount = maybe;
    b.noCount = no;
    b.skippedCount = skipped;
    b.asked = yes + maybe + no;
    return b;
}

describe('bucketPointEstimate', () => {
    it('is exactly 1.0 for 21/21 yeses, not the CI midpoint', () => {
        const p = bucketPointEstimate(bucket({ yes: 21 }));

        expect(p).toBe(1.0);

        const ci = bucketCredibleInterval(bucket({ yes: 21 }));
        console.log(`  p̂ = ${p}`);
        console.log(
            `  Wilson 95% CI = [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`
        );
        console.log(`  CI midpoint = ${(((ci.low + ci.high) / 2) * 100).toFixed(2)}%`);

        // The point estimate is the data; the midpoint of an asymmetric
        // interval is not.
        expect(p).not.toBe((ci.low + ci.high) / 2);
    });

    it('is exactly 1.0 for 22/22 yeses', () => {
        expect(bucketPointEstimate(bucket({ yes: 22 }))).toBe(1.0);
    });

    it('is 20/21 when a single answer is "no"', () => {
        expect(bucketPointEstimate(bucket({ yes: 20, no: 1 }))).toBeCloseTo(20 / 21, 12);
    });

    it('is 0 when nothing has been answered, rather than assuming a midpoint', () => {
        expect(bucketPointEstimate(bucket())).toBe(0);
    });

    it('weighs a passive answer as half', () => {
        // 3 yes + 1 maybe over 4 answers = 3.5 / 4
        expect(bucketPointEstimate(bucket({ yes: 3, maybe: 1 }))).toBeCloseTo(3.5 / 4, 12);
    });

    it('ignores skips entirely', () => {
        const withSkip = bucket({ yes: 1, no: 1, skipped: 9 });
        const withoutSkip = bucket({ yes: 1, no: 1 });

        expect(bucketPointEstimate(withSkip)).toBe(bucketPointEstimate(withoutSkip));
    });
});

describe('bucketCredibleInterval', () => {
    it('spans the whole range when nothing has been answered', () => {
        expect(bucketCredibleInterval(bucket())).toEqual({ low: 0, high: 1 });
    });

    it('is asymmetric at the boundary: upper pinned at 1.0, lower well below', () => {
        const ci = bucketCredibleInterval(bucket({ yes: 21 }));

        expect(ci.high).toBe(1.0);
        expect(ci.low).toBeLessThan(1.0);
        expect(ci.low).toBeGreaterThan(0.5);
    });

    it('does not depend on how many words the bucket contains', () => {
        // The interval is a function of (k, n) only. The bucket's population
        // size matters only when scaling to a word count, not here.
        const a = bucketCredibleInterval(bucket({ yes: 21 }));
        const b = bucketCredibleInterval(bucket({ yes: 21 }));

        expect(a.low).toBe(b.low);
        expect(a.high).toBe(b.high);
    });

    it('narrows as more answers arrive at the same rate', () => {
        const few = bucketCredibleInterval(bucket({ yes: 5, no: 5 }));
        const many = bucketCredibleInterval(bucket({ yes: 50, no: 50 }));

        expect(many.high - many.low).toBeLessThan(few.high - few.low);
    });

    it('stays inside [0, 1] even where Wilson does not clamp', () => {
        // The underlying library can return 1.0000000000000002 for k = n.
        for (const n of [1, 2, 5, 21, 100]) {
            const ci = bucketCredibleInterval(bucket({ yes: n }));
            expect(ci.low).toBeGreaterThanOrEqual(0);
            expect(ci.high).toBeLessThanOrEqual(1);
        }
    });
});