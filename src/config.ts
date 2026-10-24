/**
 * App-wide configuration: corpus range and the frequency buckets.
 *
 * Two bucket schemes coexist, both derived from the same answer list:
 *
 *   BUCKETS          hand-picked, unequal widths. Used by the composition
 *                    chart, the totals and question selection.
 *
 *   DYNAMIC_BUCKETS  generated at load time from DYNAMIC_BUCKET_COUNT, as
 *                    equal-width bands across the corpus. Used by the area
 *                    chart.
 */

export interface BucketDef {
    label: string;
    start: number;
    end: number;
    width: number;
}

export const CONFIG = {
    MAX_RANK: 64000,
    MAX_QUESTIONS: Infinity,
} as const;

/** Hand-picked buckets. */
export const BUCKETS: BucketDef[] = [
    { label: '1–500',   start: 1,     end: 500,   width: 500 },
    { label: '501–1K',  start: 501,   end: 1000,  width: 500 },
    { label: '1K–2K',   start: 1001,  end: 2000,  width: 1000 },
    { label: '2K–4K',   start: 2001,  end: 4000,  width: 2000 },
    { label: '4K–8K',   start: 4001,  end: 8000,  width: 4000 },
    { label: '8K–16K',  start: 8001,  end: 16000, width: 8000 },
    { label: '16K–32K', start: 16001, end: 32000, width: 16000 },
    { label: '32K–64K', start: 32001, end: 64000, width: 32000 },
];

/** How many buckets the area chart generates. */
export const DYNAMIC_BUCKET_COUNT = 32;

/** Compact rank label: 1, 250, 2K, 16K. Rounds to one decimal, so a bucket
 *  starting at 2,001 reads as 2K rather than 2.0K. */
function formatRank(n: number): string {
    if (n < 1000) return String(n);
    const k = Math.round((n / 1000) * 10) / 10;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1)}K`;
}

/**
 * Buckets of equal width covering rank 1 .. `maxRank`.
 *
 * With `count` of 50 over 64,000 ranks that is 1,280 words per bucket. The
 * count is clamped to `maxRank`, since more buckets than ranks would leave
 * empty ones.
 */
export function linearBuckets(
    count: number,
    maxRank: number = CONFIG.MAX_RANK
): BucketDef[] {
    const steps = Math.max(1, Math.min(Math.floor(count), maxRank));
    const defs: BucketDef[] = [];

    for (let i = 0; i < steps; i++) {
        const start = Math.floor((i * maxRank) / steps) + 1;
        const end = Math.floor(((i + 1) * maxRank) / steps);

        defs.push({
            start,
            end,
            width: end - start + 1,
            label: `${formatRank(start)}–${formatRank(end)}`,
        });
    }

    return defs;
}

/** The generated buckets, resolved once at load time. */
export const DYNAMIC_BUCKETS: BucketDef[] = linearBuckets(
    DYNAMIC_BUCKET_COUNT,
    CONFIG.MAX_RANK
);