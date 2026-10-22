/**
 * Statistics: pure functions. Given counts and bucket definitions,
 * return estimates and confidence intervals. No DOM, no state mutation.
 *
 * Wilson score CI:
 *   https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
 *
 * "Yes" counts 1, "maybe" counts 0.5, "no" counts 0. Skips don't count
 * toward n. This matches the original CLI's behavior.
 */

import WilsonScore from 'wilson-score-rank';
import type { BucketDef } from './config.ts';
import type { Bucket } from './models/bucket.ts';

/** A two-sided interval in [0, 1]. */
export interface Interval {
    low: number;
    high: number;
}

/**
 * Point estimate p̂ of fraction known. 0 when nothing's been answered --
 * we have no data, so we don't claim to know anything.
 */
export function bucketPointEstimate(b: Bucket): number {
    const n = b.sampleSize;
    return n === 0 ? 0 : b.totalScore / n;
}

/** Wilson 95% CI. Empty bucket -> [0, 1] (total uncertainty). */
export function bucketCredibleInterval(b: Bucket): Interval {
    const n = b.sampleSize;
    if (n === 0) return { low: 0, high: 1 };

    const k = b.totalScore;
    // Wilson requires integer k. Round half-credits.
    const { left, right } = WilsonScore.interval(Math.round(k), n);

    // Wilson without continuity correction doesn't clamp its output and can
    // return e.g. 1.0000000000000002, which would render as "100.02%".
    return {
        low: Math.max(0, Math.min(1, left)),
        high: Math.max(0, Math.min(1, right)),
    };
}

/** Total vocabulary estimate in number of words. */
export function vocabEstimate(buckets: Bucket[], defs: BucketDef[]): number {
    let total = 0;
    for (let i = 0; i < defs.length; i++) {
        const b = buckets[i];
        if (!b) continue;
        total += bucketPointEstimate(b) * defs[i]!.width;
    }
    return total;
}

/** Total vocabulary 95% CI in number of words. */
export function vocabCredibleInterval(buckets: Bucket[], defs: BucketDef[]): Interval {
    let lowWords = 0;
    let highWords = 0;
    for (let i = 0; i < defs.length; i++) {
        const b = buckets[i];
        if (!b) continue;
        const { low, high } = bucketCredibleInterval(b);
        const w = defs[i]!.width;
        lowWords += low * w;
        highWords += high * w;
    }
    return { low: Math.round(lowWords), high: Math.round(highWords) };
}

/** Uncertainty = CI width. Used to weight question selection. */
export function bucketUncertainty(b: Bucket): number {
    const ci = bucketCredibleInterval(b);
    return Math.max(ci.high - ci.low, 0.001);
}