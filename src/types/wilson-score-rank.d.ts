/**
 * Type declarations for `wilson-score-rank`, which ships no types of its own.
 * Hand-written to match the library's actual API (see node_modules/wilson-score-rank/wilsonscore.js).
 */

declare module 'wilson-score-rank' {
    export interface WilsonOptions {
        /** Confidence level, e.g. 0.95. Default 0.95. */
        confidence?: number;
        /** Apply continuity correction. Default true. */
        correction?: boolean;
    }

    export interface WilsonInterval {
        left: number;
        right: number;
    }

    const WilsonScore: {
        /** k = successes, n = total trials. */
        interval(k: number, n: number, options?: WilsonOptions): WilsonInterval;
        lowerBound(k: number, n: number, options?: WilsonOptions): number;
        ratingInterval(
            avg: number,
            n: number,
            minScore: number,
            maxScore: number,
            options?: WilsonOptions
        ): WilsonInterval;
        ratingLowerBound(
            avg: number,
            n: number,
            minScore: number,
            maxScore: number,
            options?: WilsonOptions
        ): number;
    };

    export default WilsonScore;
}