/**
 * Tallying answers into buckets.
 *
 * Buckets are never stored. They are recomputed from the answer list whenever
 * it changes, which means one set of answers can feed several bucket schemes
 * at once — the hand-picked one and the generated one — with no risk of the
 * two drifting apart.
 *
 * Cost is answers × buckets, so tens of thousands of answers over a dozen
 * buckets is still trivial on a keystroke.
 */

import type { BucketDef } from '../config.ts';
import type { AnswerRecord } from './answer.ts';
import { Bucket } from './bucket.ts';

/** Index of the bucket containing `rank`. Falls in the last bucket if the rank
 *  is past the end of the definitions. */
export function bucketIndexFor(rank: number, defs: readonly BucketDef[]): number {
    for (let i = 0; i < defs.length; i++) {
        if (rank <= defs[i]!.end) return i;
    }
    return defs.length - 1;
}

/** Count a list of answers into a fresh set of buckets. */
export function tally(
    answers: readonly AnswerRecord[],
    defs: readonly BucketDef[]
): Bucket[] {
    const buckets = defs.map(() => new Bucket());

    for (const answer of answers) {
        const bucket = buckets[bucketIndexFor(answer.rank, defs)];
        if (bucket) bucket.record(answer.response);
    }

    return buckets;
}