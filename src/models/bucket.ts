/**
 * Tally of answers for one frequency bucket.
 *
 * Per AGENTS.md the model exposes only state and readonly getters. The one
 * method on the class — `clone()` — exists because signal subscribers don't
 * fire when an item in an array mutates in place. The controller calls
 * `clone()` when it needs to publish a new array; views and stats read the
 * fields directly. The exception for `clone()` is a deliberate departure
 * from the strict reading, approved at design time.
 */

export class Bucket {
    yesCount = 0;
    maybeCount = 0;
    noCount = 0;
    skippedCount = 0;
    asked = 0;

    /** Number of answered (non-skipped) questions. */
    get sampleSize(): number {
        return this.yesCount + this.maybeCount + this.noCount;
    }

    /** "Yes" counts 1, "maybe" counts 0.5, "no" counts 0. */
    get totalScore(): number {
        return this.yesCount + 0.5 * this.maybeCount;
    }

    /** Structural copy, used to give signal subscribers a new reference. */
    clone(): Bucket {
        const b = new Bucket();
        b.yesCount = this.yesCount;
        b.maybeCount = this.maybeCount;
        b.noCount = this.noCount;
        b.skippedCount = this.skippedCount;
        b.asked = this.asked;
        return b;
    }
}