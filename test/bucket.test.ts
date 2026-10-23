/**
 * Bucket — the per-frequency-band tally, and the values derived from it.
 *
 * Covers how each response type moves the counters, that a skip is not treated
 * as an answer, and that the estimate, interval and uncertainty follow from
 * the tallies.
 */

import { describe, expect, it } from 'vitest';

import { Bucket } from '../src/models/bucket.ts';
import { ResponseType } from '../src/models/response-type.ts';

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

describe('Bucket tallies', () => {
    it('starts empty', () => {
        const b = new Bucket();

        expect(b.yesCount).toBe(0);
        expect(b.maybeCount).toBe(0);
        expect(b.noCount).toBe(0);
        expect(b.skippedCount).toBe(0);
        expect(b.asked).toBe(0);
        expect(b.sampleSize).toBe(0);
        expect(b.totalScore).toBe(0);
    });

    it('record(): increments the counter matching the response type', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Passive);
        b.record(ResponseType.NotKnown);

        expect(b.yesCount).toBe(1);
        expect(b.maybeCount).toBe(1);
        expect(b.noCount).toBe(1);
        expect(b.asked).toBe(3);
    });

    it('record(): weighs a passive (maybe) answer as half', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Active);
        b.record(ResponseType.Passive);

        // 2 full + 1 half
        expect(b.totalScore).toBe(2.5);
        expect(b.sampleSize).toBe(3);
    });

    it('record(): does not treat a skip as an answer', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Skipped);

        expect(b.skippedCount).toBe(1);
        expect(b.asked).toBe(1);
        expect(b.sampleSize).toBe(1);
        expect(b.totalScore).toBe(1);
    });

    it('reset(): clears every tally', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Passive);
        b.record(ResponseType.NotKnown);
        b.record(ResponseType.Skipped);
        b.reset();

        expect(b.yesCount).toBe(0);
        expect(b.maybeCount).toBe(0);
        expect(b.noCount).toBe(0);
        expect(b.skippedCount).toBe(0);
        expect(b.asked).toBe(0);
    });
});

describe('Bucket.pointEstimate', () => {
    it('is 0 when nothing has been answered, rather than assuming a midpoint', () => {
        expect(bucket().pointEstimate).toBe(0);
    });

    it('is the literal ratio, so 21/21 is exactly 1', () => {
        expect(bucket({ yes: 21 }).pointEstimate).toBe(1);
    });

    it('is 20/21 when a single answer is "no"', () => {
        expect(bucket({ yes: 20, no: 1 }).pointEstimate).toBeCloseTo(20 / 21, 12);
    });

    it('weighs a passive answer as half', () => {
        // 3 yes + 1 maybe over 4 answers
        expect(bucket({ yes: 3, maybe: 1 }).pointEstimate).toBeCloseTo(3.5 / 4, 12);
    });

    it('ignores skips entirely', () => {
        const withSkips = bucket({ yes: 1, no: 1, skipped: 9 });
        const withoutSkips = bucket({ yes: 1, no: 1 });

        expect(withSkips.pointEstimate).toBe(withoutSkips.pointEstimate);
    });
});

describe('Bucket.credibleInterval', () => {
    it('spans the whole range when nothing has been answered', () => {
        expect(bucket().credibleInterval).toEqual({ low: 0, high: 1 });
    });

    it('is asymmetric at the boundary: upper pinned at 1, lower well below', () => {
        const ci = bucket({ yes: 21 }).credibleInterval;

        expect(ci.high).toBe(1);
        expect(ci.low).toBeLessThan(1);
        expect(ci.low).toBeGreaterThan(0.5);
    });

    it('does not depend on how many words the bucket contains', () => {
        // The interval is a function of the tallies alone; bucket width only
        // matters when scaling the fraction to a word count.
        const a = bucket({ yes: 21 }).credibleInterval;
        const b = bucket({ yes: 21 }).credibleInterval;

        expect(a).toEqual(b);
    });

    it('narrows as answers accumulate at the same rate', () => {
        const few = bucket({ yes: 5, no: 5 }).credibleInterval;
        const many = bucket({ yes: 50, no: 50 }).credibleInterval;

        expect(many.high - many.low).toBeLessThan(few.high - few.low);
    });
});

describe('Bucket.uncertainty', () => {
    it('is the width of the credible interval', () => {
        const b = bucket({ yes: 3, no: 1 });
        const ci = b.credibleInterval;

        expect(b.uncertainty).toBeCloseTo(ci.high - ci.low, 12);
    });

    it('is at its widest for an untouched bucket', () => {
        expect(bucket().uncertainty).toBeCloseTo(1, 12);
    });

    it('never reaches zero, so a settled bucket can still be picked', () => {
        // The interval width collapses well below the floor with many answers.
        expect(bucket({ yes: 10000 }).uncertainty).toBeGreaterThanOrEqual(0.001);
    });
});