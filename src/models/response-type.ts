/**
 * How the user responded to a word.
 *
 * `Active` and `Passive` both indicate recognition, weighted fully and
 * half respectively; `NotKnown` indicates they do not recognise it. `Skipped`
 * is not a judgement about the word at all — the vocabulary estimate ignores
 * it entirely, and it exists so the type system can tell the two apart.
 *
 * Declared as a const object plus a union type rather than a TypeScript
 * `enum`. Enums emit runtime code, which Node's strip-only TypeScript support
 * refuses (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), and the tests run under that
 * mode. This form has the same call-site ergonomics — `ResponseType.Active`
 * and `: ResponseType` — and is tree-shakeable.
 */

export const ResponseType = {
    /** Yes — the user knows the word. Counts as a full success. */
    Active: 'Active',

    /** Maybe — they half-recognise it. Counts as half a success. */
    Passive: 'Passive',

    /** No — they do not know it. */
    NotKnown: 'NotKnown',

    /** Passed over. Not an answer; does not affect any estimate. */
    Skipped: 'Skipped',
} as const;

export type ResponseType = (typeof ResponseType)[keyof typeof ResponseType];