/**
 * The statistical primitive: a confidence interval for a proportion.
 *
 * Deliberately unaware of `Bucket` — this takes numbers and returns an
 * interval, so the models can own their own derived values without depending
 * on a statistics module that knows their shape.
 *
 * Wilson score interval:
 *   https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
 */

import WilsonScore from 'wilson-score-rank';

/** A two-sided interval in [0, 1]. */
export interface Interval {
    low: number;
    high: number;
}

/**
 * 95% Wilson score interval for `k` successes out of `n` trials.
 *
 * `k` may be fractional (a "maybe" counts as half); Wilson requires an
 * integer count, so it is rounded here.
 *
 * With no trials there is no information, so the interval is the whole range.
 */
export function wilsonInterval(k: number, n: number): Interval {
    if (n <= 0) return { low: 0, high: 1 };

    const { left, right } = WilsonScore.interval(Math.round(k), n);

    // Wilson without continuity correction does not clamp its output and can
    // return e.g. 1.0000000000000002, which would render as "100.02%".
    return {
        low: Math.max(0, Math.min(1, left)),
        high: Math.max(0, Math.min(1, right)),
    };
}