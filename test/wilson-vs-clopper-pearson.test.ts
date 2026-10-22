/**
 * Compares Wilson score (with and without continuity correction) against
 * Clopper-Pearson exact intervals on the same inputs.
 *
 * Context: the app once showed "100% (82–100%)" for a bucket where every
 * answer was yes. The question was why the point estimate sat at the top of
 * its interval rather than in the middle. Answer: the point estimate is the
 * data (21/21), and the interval is asymmetric at that boundary. These tests
 * pin down how far apart the three methods actually land.
 */

import { describe, expect, it } from 'vitest';

import WilsonScore from 'wilson-score-rank';
import binomialTest from '@stdlib/stats-binomial-test';

interface Interval {
    left: number;
    right: number;
}

function wilsonWith(k: number, n: number): Interval {
    return WilsonScore.interval(k, n, { correction: true });
}

function wilsonWithout(k: number, n: number): Interval {
    return WilsonScore.interval(k, n, { correction: false });
}

function clopperPearson(k: number, n: number): Interval {
    const { ci } = binomialTest(k, n);
    return { left: ci[0]!, right: ci[1]! };
}

interface Case {
    k: number;
    n: number;
    label: string;
}

const CASES: Case[] = [
    { k: 21, n: 21, label: '21/21 yeses (the boundary case from the screenshot)' },
    { k: 22, n: 22, label: '22/22 yeses' },
    { k: 20, n: 21, label: '20/21 yeses (one no)' },
    { k: 10, n: 10, label: '10/10 yeses' },
    { k: 5, n: 5, label: '5/5 yeses' },
    { k: 50, n: 100, label: '50/100 yeses (p=0.5, balanced)' },
    { k: 0, n: 5, label: '0/5 noes (all-fail boundary)' },
    { k: 96, n: 100, label: '96/100 yeses (high but not boundary)' },
    { k: 75, n: 100, label: '75/100 yeses' },
];

/** Wilson without continuity correction does not clamp, and can return
 *  slightly over 1 for the all-yes case. */
const EPS = 1e-9;

describe('Wilson vs Clopper-Pearson', () => {
    it('produces valid intervals for every case', () => {
        console.log();
        console.log(
            '  k/n            | point     | Wilson (corr)    | Wilson (no corr) | Clopper-Pearson'
        );
        console.log('  ' + '-'.repeat(104));

        for (const c of CASES) {
            const w = wilsonWith(c.k, c.n);
            const wn = wilsonWithout(c.k, c.n);
            const cp = clopperPearson(c.k, c.n);

            const fmt = (ci: Interval) =>
                `[${(ci.left * 100).toFixed(2).padStart(6)}%, ${(ci.right * 100).toFixed(2).padStart(6)}%]`;
            const point = `${((c.k / c.n) * 100).toFixed(2).padStart(6)}%`;

            console.log(
                `  ${c.label.padEnd(50)} | ${point} | ${fmt(w)} | ${fmt(wn)} | ${fmt(cp)}`
            );

            for (const [name, ci] of [
                ['Wilson+', w],
                ['Wilson-', wn],
                ['Clopper-Pearson', cp],
            ] as const) {
                expect(ci.left, `${name} lower bound`).toBeGreaterThanOrEqual(-EPS);
                expect(ci.left, `${name} lower bound`).toBeLessThanOrEqual(1);
                expect(ci.right, `${name} upper bound`).toBeGreaterThanOrEqual(-EPS);
                expect(ci.right, `${name} upper bound`).toBeLessThanOrEqual(1 + EPS);
                expect(ci.left, `${name} low > high`).toBeLessThanOrEqual(ci.right);
            }
        }
        console.log();
    });

    it('agrees on the upper bound at 21/21 and differs by a few points on the lower', () => {
        const w = wilsonWith(21, 21);
        const wn = wilsonWithout(21, 21);
        const cp = clopperPearson(21, 21);

        // Upper bound is pinned at 1 by all three: you cannot know more than
        // everything.
        expect(w.right).toBeCloseTo(1, 9);
        expect(wn.right).toBeCloseTo(1, 9);
        expect(cp.right).toBeCloseTo(1, 9);

        // The lower bounds all sit in the low 80s, and disagree by only a
        // few percentage points.
        for (const ci of [w, wn, cp]) {
            expect(ci.left).toBeGreaterThan(0.7);
            expect(ci.left).toBeLessThan(0.9);
        }

        console.log(
            `  21/21 lower bounds: Wilson+=${(w.left * 100).toFixed(2)}% ` +
                `Wilson-=${(wn.left * 100).toFixed(2)}% ` +
                `Clopper-Pearson=${(cp.left * 100).toFixed(2)}%`
        );
    });

    it('does not depend on the bucket population size', () => {
        // Both methods take only (k, n); the bucket's word count is irrelevant
        // to the interval and only matters when scaling to a word estimate.
        expect(clopperPearson(21, 21)).toEqual(clopperPearson(21, 21));
        expect(wilsonWith(21, 21)).toEqual(wilsonWith(21, 21));
    });
});