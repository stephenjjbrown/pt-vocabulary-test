/**
 * App-wide configuration: corpus range and the 8 frequency buckets.
 *
 * Buckets grow exponentially because vocabulary learning curves roughly
 * follow a sigmoid against log-frequency: most learners know most of the
 * first 500 words, less than half of the first 5K, and so on.
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