/**
 * Data access: the words corpus, as served by the API.
 *
 * Kept separate from the models so they hold state rather than knowing about
 * HTTP, and separate from the views so that neither owns network concerns.
 */

import { CONFIG } from '../config.ts';
import type { WordData } from '../models/word.ts';

/** Shape of the GET /api/words response. */
interface WordsResponse {
    maxRank: number;
    count: number;
    words: WordData[];
}

/**
 * Fetch the top `maxRank` words, most frequent first.
 *
 * Throws if the server is unreachable or returns an error status; callers are
 * expected to surface that to the user.
 */
export async function fetchWords(maxRank: number = CONFIG.MAX_RANK): Promise<WordData[]> {
    const res = await fetch(`/api/words?maxRank=${maxRank}`);

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as WordsResponse;
    return data.words ?? [];
}