/**
 * History operations.
 *
 * Stateless functions over the `history` signal on `app`. The signal is
 * the storage; this controller decides what operations are valid.
 */

/** Cap on the stored history. Views can render more or fewer. */
const MAX_HISTORY = 1000;

import { app, type AnswerRecord } from '../models/app.ts';

/** Add a record, newest-first. Drops the oldest if over the cap. */
export function add(record: AnswerRecord): void {
    const next = [record, ...app.history.peek()];
    if (next.length > MAX_HISTORY) next.length = MAX_HISTORY;
    app.history.value = next;
}

/** Clear all history. */
export function reset(): void {
    app.history.value = [];
}