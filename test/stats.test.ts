/**
 * The statistical primitive: a Wilson score interval over raw counts.
 *
 * Kept separate from Bucket so the maths can be exercised without building a
 * model, and because these properties are about the method, not the app.
 */

import { describe, expect, it } from 'vitest';

import { wilsonInterval } from '../src/stats.ts';

describe('wilsonInterval', () => {
    it('returns the whole range when there are no trials', () => {
        expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
    });

    it('pins the upper bound at 1 when every trial succeeded', () => {
        const ci = wilsonInterval(21, 21);

        expect(ci.high).toBe(1);
        expect(ci.low).toBeLessThan(1);
        expect(ci.low).toBeGreaterThan(0.5);
    });

    it('pins the lower bound at 0 when every trial failed', () => {
        const ci = wilsonInterval(0, 5);

        expect(ci.low).toBe(0);
        expect(ci.high).toBeGreaterThan(0);
        expect(ci.high).toBeLessThan(1);
    });

    it('is close to symmetric at a balanced split', () => {
        const ci = wilsonInterval(50, 100);

        expect(ci.low).toBeCloseTo(1 - ci.high, 2);
    });

    it('narrows as trials accumulate at the same rate', () => {
        const few = wilsonInterval(5, 10);
        const many = wilsonInterval(50, 100);

        expect(many.high - many.low).toBeLessThan(few.high - few.low);
    });

    it('stays inside [0, 1] where the underlying library does not clamp', () => {
        // Without continuity correction the library can return 1.0000000000000002.
        for (const n of [1, 2, 5, 21, 100]) {
            const ci = wilsonInterval(n, n);
            expect(ci.low).toBeGreaterThanOrEqual(0);
            expect(ci.high).toBeLessThanOrEqual(1);
        }
    });

    it('rounds a fractional success count', () => {
        // A "maybe" contributes 0.5, and Wilson needs an integer k.
        expect(wilsonInterval(20.5, 21)).toEqual(wilsonInterval(21, 21));
    });

    it('widens as the observed proportion approaches 0.5', () => {
        const nearEdge = wilsonInterval(9, 10);
        const middle = wilsonInterval(5, 10);

        expect(middle.high - middle.low).toBeGreaterThan(nearEdge.high - nearEdge.low);
    });
});