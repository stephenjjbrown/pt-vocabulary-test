/**
 * Bootstrap. Loads the corpus and hands it to the model, then lets the
 * controllers and views do the rest.
 *
 * There is no app-wide state here and no event plumbing — each view
 * subscribes to the signals it renders, and button clicks call controllers
 * directly.
 */

import './style.css';
import './elements/index.ts';

import { app } from './models/app.ts';
import { corpusFailed, corpusLoaded, answer, loadWords } from './controllers/app-controller.ts';
import { CONFIG } from './config.ts';
import type { WordData } from './models/word.ts';

interface WordsResponse {
    maxRank: number;
    count: number;
    words: WordData[];
}

async function loadCorpus(): Promise<void> {
    const res = await fetch(`/api/words?maxRank=${CONFIG.MAX_RANK}`);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as WordsResponse;
    loadWords(data.words ?? []);
}

/** Keyboard shortcuts. Only active while a question is on screen. */
function handleKey(e: KeyboardEvent): void {
    if (app.phase.value !== 'ready') return;

    switch (e.key) {
        case 'y': case 'Y': answer(1.0); break;
        case 'm': case 'M': answer(0.5); break;
        case 'n': case 'N': answer(0.0); break;
        case 's': case 'S': answer(null); break;
    }
}

function main(): void {
    window.addEventListener('keydown', handleKey);

    loadCorpus().then(corpusLoaded).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to load corpus:', err);
        corpusFailed(message);
    });
}

main();