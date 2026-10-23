/**
 * Bucket — the per-frequency-band tally, and the values derived from it.
 *
 * Three mutually exclusive outcomes per word: active, passive, not known.
 * Passive is a category of its own, not a half-strength yes.
 */

import { describe, expect, it } from 'vitest';

import { Bucket } from '../src/models/bucket.ts';
import { ResponseType } from '../src/models/response-type.ts';

interface Tallies {
    active?: number;
    passive?: number;
    notKnown?: number;
    skipped?: number;
}

/** Build a Bucket with the given tallies, bypassing record(). */
function bucket({
    active = 0,
    passive = 0,
    notKnown = 0,
    skipped = 0,
}: Tallies = {}): Bucket {
    const b = new Bucket();
    b.activeCount = active;
    b.passiveCount = passive;
    b.notKnownCount = notKnown;
    b.skippedCount = skipped;
    b.asked = active + passive + notKnown;
    return b;
}

describe('Bucket tallies', () => {
    it('starts empty', () => {
        const b = new Bucket();

        expect(b.activeCount).toBe(0);
        expect(b.passiveCount).toBe(0);
        expect(b.notKnownCount).toBe(0);
        expect(b.skippedCount).toBe(0);
        expect(b.asked).toBe(0);
        expect(b.sampleSize).toBe(0);
        expect(b.knownCount).toBe(0);
    });

    it('record(): increments the counter matching the response type', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Passive);
        b.record(ResponseType.NotKnown);

        expect(b.activeCount).toBe(1);
        expect(b.passiveCount).toBe(1);
        expect(b.notKnownCount).toBe(1);
        expect(b.asked).toBe(3);
    });

    it('record(): counts a passive answer as a full word, not half', () => {
        const b = new Bucket();
        b.record(ResponseType.Passive);

        expect(b.passiveCount).toBe(1);
        expect(b.knownCount).toBe(1);
        expect(b.knownShare).toBe(1);
    });

    it('record(): does not treat a skip as an answer', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Skipped);

        expect(b.skippedCount).toBe(1);
        expect(b.asked).toBe(1);
        expect(b.sampleSize).toBe(1);
        expect(b.knownCount).toBe(1);
    });

    it('reset(): clears every tally', () => {
        const b = new Bucket();
        b.record(ResponseType.Active);
        b.record(ResponseType.Passive);
        b.record(ResponseType.NotKnown);
        b.record(ResponseType.Skipped);
        b.reset();

        expect(b.activeCount).toBe(0);
        expect(b.passiveCount).toBe(0);
        expect(b.notKnownCount).toBe(0);
        expect(b.skippedCount).toBe(0);
        expect(b.asked).toBe(0);
    });
});

describe('Bucket knownCount', () => {
    it('is active plus passive', () => {
        expect(bucket({ active: 3, passive: 2, notKnown: 5 }).knownCount).toBe(5);
    });

    it('excludes not-known words', () => {
        expect(bucket({ active: 0, passive: 0, notKnown: 10 }).knownCount).toBe(0);
    });
});

describe('Bucket shares', () => {
    it('are all 0 before anything is answered', () => {
        const b = bucket();

        expect(b.activeShare).toBe(0);
        expect(b.passiveShare).toBe(0);
        expect(b.knownShare).toBe(0);
    });

    it('are the counts over the answers', () => {
        // 30 active, 20 passive, 50 not known out of 100
        const b = bucket({ active: 30, passive: 20, notKnown: 50 });

        expect(b.activeShare).toBeCloseTo(0.3, 12);
        expect(b.passiveShare).toBeCloseTo(0.2, 12);
        expect(b.knownShare).toBeCloseTo(0.5, 12);
    });

    it('sum to 1 across all three categories', () => {
        const b = bucket({ active: 30, passive: 20, notKnown: 50 });
        const notKnownShare = b.notKnownCount / b.sampleSize;

        expect(b.activeShare + b.passiveShare + notKnownShare).toBeCloseTo(1, 12);
    });

    it('treat a passive word as fully known, not half', () => {
        const b = bucket({ active: 0, passive: 10 });

        // Under the old half-weighting this would have been 0.5.
        expect(b.knownShare).toBe(1);
    });

    it('ignore skips', () => {
        const withSkips = bucket({ active: 1, notKnown: 1, skipped: 9 });
        const withoutSkips = bucket({ active: 1, notKnown: 1 });

        expect(withSkips.knownShare).toBe(withoutSkips.knownShare);
    });
});

describe('Bucket intervals', () => {
    it('span the whole range before anything is answered', () => {
        const b = bucket();

        expect(b.activeInterval).toEqual({ low: 0, high: 1 });
        expect(b.passiveInterval).toEqual({ low: 0, high: 1 });
        expect(b.knownInterval).toEqual({ low: 0, high: 1 });
    });

    it('pin the upper bound at 1 for the known interval when all are known', () => {
        const ci = bucket({ active: 10, passive: 10 }).knownInterval;

        expect(ci.high).toBe(1);
        expect(ci.low).toBeLessThan(1);
    });

    it('give the known interval a tighter bound than either category', () => {
        // Known pools both categories, so it is more precise than its parts.
        const b = bucket({ active: 50, passive: 30, notKnown: 20 });
        const knownWidth = b.knownInterval.high - b.knownInterval.low;
        const activeWidth = b.activeInterval.high - b.activeInterval.low;

        expect(knownWidth).toBeLessThan(activeWidth);
    });

    it('narrow as answers accumulate at the same rate', () => {
        const few = bucket({ active: 5, notKnown: 5 }).knownInterval;
        const many = bucket({ active: 50, notKnown: 50 }).knownInterval;

        expect(many.high - many.low).toBeLessThan(few.high - few.low);
    });
});

describe('Bucket.uncertainty', () => {
    it('is the width of the known interval', () => {
        const b = bucket({ active: 3, notKnown: 1 });
        const ci = b.knownInterval;

        expect(b.uncertainty).toBeCloseTo(ci.high - ci.low, 12);
    });

    it('is at its widest for an untouched bucket', () => {
        expect(bucket().uncertainty).toBeCloseTo(1, 12);
    });

    it('never reaches zero, so a settled bucket can still be picked', () => {
        expect(bucket({ active: 10000 }).uncertainty).toBeGreaterThanOrEqual(0.001);
    });
});