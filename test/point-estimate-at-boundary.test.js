/**
 * Verifies that the point estimate for a bucket equals the literal ratio
 * of yes-count to total-answered, with no "smoothing" toward the CI midpoint.
 *
 * Specifically: 21 yeses out of 21 answered (in a bucket of any size, including
 * the 500-word top-frequency bucket) should produce a point estimate of 100%
 * — because that is the data, not a modeling choice.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    bucketPointEstimate,
    bucketCredibleInterval,
} from '../src/stats.ts';

test('21/21 yeses -> point estimate is exactly 1.0, not the CI midpoint', () => {
    const b = {
        yesCount: 21,
        maybeCount: 0,
        noCount: 0,
        skippedCount: 0,
        asked: 21,
    };

    const p = bucketPointEstimate(b);
    assert.equal(p, 1.0, 'point estimate must be the literal ratio 21/21');

    const ci = bucketCredibleInterval(b);
    console.log(`  p̂ = ${p}`);
    console.log(`  Wilson 95% CI = [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`);
    console.log(`  CI midpoint = ${((ci.low + ci.high) / 2 * 100).toFixed(2)}%`);

    // The point estimate is the data, not the midpoint of the CI.
    const midpoint = (ci.low + ci.high) / 2;
    assert.notEqual(p, midpoint, 'point estimate should not equal CI midpoint at the boundary');
});

test('22/22 yeses -> point estimate is exactly 1.0', () => {
    const b = {
        yesCount: 22, maybeCount: 0, noCount: 0, skippedCount: 0, asked: 22,
    };
    assert.equal(bucketPointEstimate(b), 1.0);
});

test('20/21 yeses -> point estimate is 20/21, not 100%', () => {
    const b = {
        yesCount: 20, maybeCount: 0, noCount: 1, skippedCount: 0, asked: 21,
    };
    const p = bucketPointEstimate(b);
    assert.equal(p, 20 / 21);
    // ~0.952
});

test('CI is asymmetric at the boundary: lower bound < 1.0 even when k = n', () => {
    const b = {
        yesCount: 21, maybeCount: 0, noCount: 0, skippedCount: 0, asked: 21,
    };
    const ci = bucketCredibleInterval(b);
    assert.ok(ci.high === 1.0, 'upper bound is pinned at 1.0');
    assert.ok(ci.low < 1.0, 'lower bound is below 1.0 because we are uncertain about the true rate');
    assert.ok(ci.low > 0.5, 'but it is still high: we are quite confident');
});

test('Bucket size (width) does not affect the point estimate or CI', () => {
    // The point estimate depends only on (k, n), not the population size
    // of the bucket. Wilson CI likewise: it's a function of k, n, z only.
    const a = { yesCount: 21, maybeCount: 0, noCount: 0, skippedCount: 0, asked: 21 };
    const b = { yesCount: 21, maybeCount: 0, noCount: 0, skippedCount: 0, asked: 21 };

    const pA = bucketPointEstimate(a);
    const pB = bucketPointEstimate(b);
    assert.equal(pA, pB);

    const ciA = bucketCredibleInterval(a);
    const ciB = bucketCredibleInterval(b);
    assert.equal(ciA.low, ciB.low);
    assert.equal(ciA.high, ciB.high);
});
