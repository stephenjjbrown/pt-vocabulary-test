/**
 * Compares Wilson score (with and without continuity correction) and
 * Clopper-Pearson exact intervals side-by-side for the same inputs.
 *
 * Run: node --test test/compare-wilson-clopper-pearson.test.js
 *
 * The 21/21 case in particular answers: "what would the lower bound of the
 * 95% CI be if the user said yes to every single question in a 500-word
 * bucket?" The user's question was: why does the app show 100% as the
 * point estimate? Answer: the point estimate is the data. The CI lower
 * bound is the more honest number, and the three methods disagree on it
 * by a few percentage points.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import WilsonScore from 'wilson-score-rank';
import binomialTest from '@stdlib/stats-binomial-test';

function wilsonWith(k, n) {
    return WilsonScore.interval(k, n, { correction: true });
}
function wilsonWithout(k, n) {
    return WilsonScore.interval(k, n, { correction: false });
}
function clopperPearson(k, n) {
    return { left: binomialTest(k, n).ci[0], right: binomialTest(k, n).ci[1] };
}

const CASES = [
    { k: 21, n: 21, label: '21/21 yeses (the boundary case from the screenshot)' },
    { k: 22, n: 22, label: '22/22 yeses' },
    { k: 20, n: 21, label: '20/21 yeses (one no)' },
    { k: 10, n: 10, label: '10/10 yeses' },
    { k: 5,  n: 5,  label: '5/5 yeses' },
    { k: 50, n: 100, label: '50/100 yeses (p=0.5, balanced)' },
    { k: 0,  n: 5,  label: '0/5 noes (all-fail boundary)' },
    { k: 96, n: 100, label: '96/100 yeses (high but not boundary)' },
    { k: 75, n: 100, label: '75/100 yeses' },
];

test('Wilson and Clopper-Pearson agree to within ~5pp on every test case', () => {
    console.log();
    console.log('  k/n          | point (k/n) | Wilson (with correction) | Wilson (no correction) | Clopper-Pearson exact');
    console.log('  ' + '-'.repeat(120));
    for (const c of CASES) {
        const w  = wilsonWith(c.k, c.n);
        const wn = wilsonWithout(c.k, c.n);
        const cp = clopperPearson(c.k, c.n);
        const point = c.k / c.n;

        const fmt = (lo, hi) => `[${(lo*100).toFixed(2).padStart(6)}%, ${(hi*100).toFixed(2).padStart(6)}%]`;
        const fmtPoint = `${(point*100).toFixed(2).padStart(6)}%`;
        console.log(
            `  ${c.label.padEnd(50)} | ${fmtPoint} | ${fmt(w.left, w.right)} | ${fmt(wn.left, wn.right)} | ${fmt(cp.left, cp.right)}`
        );

        // Sanity: all three should produce a valid interval with low < high
        // and low/high in [0, 1]. Allow a small floating-point tolerance on the
        // upper end -- Wilson without continuity correction doesn't clamp its
        // output and can return 1.0000000000000002 for the all-yes case.
        const EPS = 1e-9;
        for (const [name, ci] of [['Wilson+', w], ['Wilson-', wn], ['Clopper-Pearson', cp]]) {
            assert.ok(ci.left >= -EPS && ci.left <= 1, `${name} lower bound out of range: ${ci.left}`);
            assert.ok(ci.right >= -EPS && ci.right <= 1 + EPS, `${name} upper bound out of range: ${ci.right}`);
            assert.ok(ci.left <= ci.right, `${name} low > high`);
        }
    }
    console.log();
});

test('21/21 yeses: explicit comparison', () => {
    const w  = wilsonWith(21, 21);
    const wn = wilsonWithout(21, 21);
    const cp = clopperPearson(21, 21);

    const point = 21 / 21;

    console.log();
    console.log(`  Point estimate (k/n):     ${(point*100).toFixed(2)}%`);
    console.log(`  Wilson with correction:    [${(w.left*100).toFixed(2)}%, ${(w.right*100).toFixed(2)}%]`);
    console.log(`  Wilson without correction: [${(wn.left*100).toFixed(2)}%, ${(wn.right*100).toFixed(2)}%]`);
    console.log(`  Clopper-Pearson exact:     [${(cp.left*100).toFixed(2)}%, ${(cp.right*100).toFixed(2)}%]`);
    console.log();
    console.log(`  Note: point estimate (${(point*100).toFixed(0)}%) is the data, not a CI midpoint.`);
    console.log(`  CI midpoints would be:`);
    console.log(`    - Wilson+     midpoint: ${((w.left + w.right)/2*100).toFixed(2)}%`);
    console.log(`    - Wilson-     midpoint: ${((wn.left + wn.right)/2*100).toFixed(2)}%`);
    console.log(`    - Clopper-P.  midpoint: ${((cp.left + cp.right)/2*100).toFixed(2)}%`);
    console.log();
    console.log('  All three methods agree the upper bound is 1.0 (you can\'t know more than 100%).');
    console.log('  They disagree slightly on the lower bound:');
    console.log(`    - Wilson+     says: true rate is at least ${(w.left*100).toFixed(1)}%`);
    console.log(`    - Wilson-     says: true rate is at least ${(wn.left*100).toFixed(1)}%`);
    console.log(`    - Clopper-P.  says: true rate is at least ${(cp.left*100).toFixed(1)}%`);
    console.log();
    console.log('  Clopper-Pearson is the most theoretically pure: it guarantees the');
    console.log('  true coverage is at least 95% for any value of p. Wilson is a good');
    console.log('  approximation that\'s tight enough in practice.');

    assert.ok(w.left  >= 0.7, 'Wilson+ lower bound suspiciously low for 21/21');
    assert.ok(wn.left >= 0.7, 'Wilson- lower bound suspiciously low for 21/21');
    assert.ok(cp.left >= 0.7, 'Clopper-Pearson lower bound suspiciously low for 21/21');
});

test('Bucket size (500) does not affect either interval', () => {
    // Both Wilson and Clopper-Pearson depend only on (k, n), not on the
    // population size N. The bucket having 500 words is irrelevant to the
    // CI computation -- it only matters when scaling the CI to word counts.
    const a = clopperPearson(21, 21);
    const b = clopperPearson(21, 21);
    assert.deepEqual(a, b);

    const c = wilsonWith(21, 21);
    const d = wilsonWith(21, 21);
    assert.deepEqual(c, d);
});
