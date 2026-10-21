/**
 * A single corpus word with its frequency rank.
 *
 * Plain data class. No DOM, no Lit, no behaviour — just the value.
 */

export interface WordData {
    word: string;
    rank: number;
}

export class Word {
    readonly word: string;
    readonly rank: number;

    constructor(data: WordData) {
        this.word = data.word;
        this.rank = data.rank;
    }
}