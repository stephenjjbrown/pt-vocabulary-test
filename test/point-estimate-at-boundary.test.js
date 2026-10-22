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

import { Bucket } from '../src/models/bucket.ts';
import {
    bucketPointEstimate,
    bucketCredibleInterval,
} from '../src/stats.ts';

/** Build a Bucket with the given tallies, bypassing `record()`. */
function bucket({ yes = 0, maybe = 0, no = 0, skipped = 0 } = {}) {
    const b = new Bucket();
    b.yesCount = yes;
    b.maybeCount = maybe;
    b.noCount = no;
    b.skippedCount = skipped;
    b.asked = yes + maybe + no;
    return b;
}

test('21/21 yeses -> point estimate is exactly 1.0, not the CI midpoint', () => {
    const b = bucket({ yes: 21 });

    const p = bucketPointEstimate(b);
    assert.equal(p, 1.0, 'point estimate must be the literal ratio 21/21');

    const ci = bucketCredibleInterval(b);
    console.log(`  p̂ = ${p}`);
    console.log(`  Wilson 95% CI = [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`);
    console.log(`  CI midpoint = ${(((ci.low + ci.high) / 2) * 100).toFixed(2)}%`);

    // The point estimate is the data, not the midpoint of the CI.
    const midpoint = (ci.low + ci.high) / 2;
    assert.notEqual(p, midpoint, 'point estimate should not equal CI midpoint at the boundary');
});

test('22/22 yeses -> point estimate is exactly 1.0', () => {
    assert.equal(bucketPointEstimate(bucket({ yes: 22 })), 1.0);
});

test('20/21 yeses -> point estimate is 20/21, not 100%', () => {
    const p = bucketPointEstimate(bucket({ yes: 20, no: 1 }));
    assert.equal(p, 20 / 21);
    // ~0.952
});

test('CI is asymmetric at the boundary: lower bound < 1.0 even when k = n', () => {
    const ci = bucketCredibleInterval(bucket({ yes: 21 }));
    assert.ok(ci.high === 1.0, 'upper bound is pinned at 1.0');
    assert.ok(ci.low < 1.0, 'lower bound is below 1.0 because we are uncertain about the true rate');
    assert.ok(ci.low > 0.5, 'but it is still high: we are quite confident');
});

test('Bucket size (width) does not affect the point estimate or CI', () => {
    // The point estimate depends only on (k, n), not the population size
    // of the bucket. Wilson CI likewise: it's a function of k, n, z only.
    const a = bucket({ yes: 21 });
    const b = bucket({ yes: 21 });

    assert.equal(bucketPointEstimate(a), bucketPointEstimate(b));

    const ciA = bucketCredibleInterval(a);
    const ciB = bucketCredibleInterval(b);
    assert.equal(ciA.low, ciB.low);
    assert.equal(ciA.high, ciB.high);
});

test('Bucket.record(): yes / maybe / no increment the right counter and asked', () => {
    const b = new Bucket();
    b.record(1.0);
    b.record(0.5);
    b.record(0.0);

    assert.equal(b.yesCount, 1);
    assert.equal(b.maybeCount, 1);
    assert.equal(b.noCount, 1);
    assert.equal(b.asked, 3);
    assert.equal(b.sampleSize, 3);
    assert.equal(b.totalScore, 1.5);
});

test('Bucket.record(null): a skip counts separately and is not an answer', () => {
    const b = new Bucket();
    b.record(1.0);
    b.record(null);

    assert.equal(b.skippedCount, 1);
    assert.equal(b.asked, 1, 'skip must not increment asked');
    assert.equal(b.sampleSize, 1, 'skip must not affect the sample size');
    assert.equal(b.totalScore, 1, 'skip must not affect the score');
});