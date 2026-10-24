/**
 * Tallying answers into buckets.
 *
 * Buckets are derived, not stored, so the interesting properties are: an
 * answer lands in the bucket whose rank range contains it, skipped answers are
 * recorded but not counted as answers, and the same answer list can be tallied
 * into more than one bucket scheme without either affecting the other.
 */

import { describe, expect, it } from 'vitest';

import { bucketIndexFor, tally } from '../src/models/aggregate.ts';
import type { AnswerRecord } from '../src/models/answer.ts';
import { ResponseType } from '../src/models/response-type.ts';
import { BUCKETS, CONFIG, linearBuckets } from '../src/config.ts';

function answer(rank: number, response: ResponseType): AnswerRecord {
    return { word: `w${rank}`, rank, response };
}

describe('bucketIndexFor', () => {
    it('maps ranks to the hand-picked buckets by their ends', () => {
        expect(bucketIndexFor(1, BUCKETS)).toBe(0);
        expect(bucketIndexFor(500, BUCKETS)).toBe(0);
        expect(bucketIndexFor(501, BUCKETS)).toBe(1);
        expect(bucketIndexFor(1000, BUCKETS)).toBe(1);
        expect(bucketIndexFor(4001, BUCKETS)).toBe(4);
    });

    it('puts a rank past the last bucket in the last bucket', () => {
        const last = BUCKETS.length - 1;
        expect(bucketIndexFor(CONFIG.MAX_RANK, BUCKETS)).toBe(last);
        expect(bucketIndexFor(CONFIG.MAX_RANK + 1000, BUCKETS)).toBe(last);
    });
});

describe('tally', () => {
    it('returns one bucket per definition', () => {
        expect(tally([], BUCKETS)).toHaveLength(BUCKETS.length);
    });

    it('counts each response type into the bucket containing its rank', () => {
        const buckets = tally(
            [
                answer(1, ResponseType.Active),
                answer(2, ResponseType.Passive),
                answer(3, ResponseType.NotKnown),
                answer(4000, ResponseType.Active),
            ],
            BUCKETS
        );

        const first = buckets[0]!;
        expect(first.activeCount).toBe(1);
        expect(first.passiveCount).toBe(1);
        expect(first.notKnownCount).toBe(1);
        expect(first.asked).toBe(3);
        expect(first.sampleSize).toBe(3);
        expect(first.knownCount).toBe(2);

        expect(buckets[3]!.activeCount).toBe(1);
    });

    it('records a skipped answer without counting it as an answer', () => {
        const buckets = tally([answer(1, ResponseType.Skipped)], BUCKETS);

        const first = buckets[0]!;
        expect(first.skippedCount).toBe(1);
        expect(first.asked).toBe(0);
        expect(first.sampleSize).toBe(0);
        expect(first.knownCount).toBe(0);
    });

    it('tallies the same answers into two schemes independently', () => {
        const answers = [
            answer(1, ResponseType.Active),
            answer(600, ResponseType.Passive),
            answer(5000, ResponseType.NotKnown),
            answer(40000, ResponseType.Active),
        ];

        const dynamic = linearBuckets(8);
        const fixed = tally(answers, BUCKETS);
        const generated = tally(answers, dynamic);

        const askedIn = (buckets: ReturnType<typeof tally>): number =>
            buckets.reduce((n, b) => n + b.asked, 0);

        // Every non-skipped answer lands in exactly one bucket in each scheme.
        expect(askedIn(fixed)).toBe(answers.length);
        expect(askedIn(generated)).toBe(answers.length);

        // Active plus passive equals the known count within a bucket, either way.
        for (const buckets of [fixed, generated]) {
            for (const b of buckets) {
                expect(b.knownCount).toBe(b.activeCount + b.passiveCount);
            }
        }
    });

    it('returns fresh buckets, so a previous tally is unaffected', () => {
        const before = tally([answer(1, ResponseType.Active)], BUCKETS);
        const after = tally([answer(1, ResponseType.NotKnown)], BUCKETS);

        expect(before[0]!.activeCount).toBe(1);
        expect(after[0]!.activeCount).toBe(0);
        expect(after[0]!.notKnownCount).toBe(1);
    });
});

describe('linearBuckets', () => {
    it('covers the whole rank range with no gaps and no overlaps', () => {
        const defs = linearBuckets(50);

        expect(defs[0]!.start).toBe(1);
        expect(defs[defs.length - 1]!.end).toBe(CONFIG.MAX_RANK);

        for (let i = 1; i < defs.length; i++) {
            expect(defs[i]!.start).toBe(defs[i - 1]!.end + 1);
        }
    });

    it('produces the requested number of buckets', () => {
        expect(linearBuckets(50)).toHaveLength(50);
        expect(linearBuckets(8)).toHaveLength(8);
        expect(linearBuckets(1)).toHaveLength(1);
    });

    it('makes every bucket the same width', () => {
        const defs = linearBuckets(50);
        const widths = new Set(defs.map(b => b.width));

        // 64,000 ranks over 50 buckets is exactly 1,280 words each.
        expect(widths.size).toBe(1);
        expect([...widths][0]).toBe(CONFIG.MAX_RANK / 50);
    });

    it('reports each bucket width as its rank span', () => {
        for (const def of linearBuckets(50)) {
            expect(def.width).toBe(def.end - def.start + 1);
        }
    });

    it('clamps the count to the number of ranks', () => {
        const defs = linearBuckets(CONFIG.MAX_RANK + 1000);

        expect(defs).toHaveLength(CONFIG.MAX_RANK);
        for (const def of defs) {
            expect(def.width).toBe(1);
        }
    });
});