/**
 * Bucket — the per-frequency-band tally.
 *
 * Covers how each response type moves the counters, that a skip is not
 * treated as an answer, and that reset() returns the bucket to a clean state.
 */

import { describe, expect, it } from 'vitest';

import { Bucket } from '../src/models/bucket.ts';
import { ResponseType } from '../src/models/response-type.ts';

describe('Bucket', () => {
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