/**
 * One recorded answer.
 *
 * This is the application's source of truth: everything else — bucket tallies,
 * totals, history — is derived from the list of these.
 */

import type { ResponseType } from './response-type.ts';

export interface AnswerRecord {
    word: string;
    rank: number;
    response: ResponseType;
}