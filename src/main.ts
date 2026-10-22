/**
 * Bootstrap. Fetches the corpus through the data layer and hands it to the
 * model, then lets views and model methods do the rest.
 */

import './style.css';
import './elements/index.ts';

import { app } from './models/app.ts';
import { ResponseType } from './models/response-type.ts';
import { fetchWords } from './data/words-api.ts';

/** Keyboard shortcuts. Only active while a word is on screen. */
function handleKey(e: KeyboardEvent): void {
    if (app.phase.value !== 'ready') return;

    switch (e.key) {
        case 'y': case 'Y': app.answer(ResponseType.Active); break;
        case 'm': case 'M': app.answer(ResponseType.Passive); break;
        case 'n': case 'N': app.answer(ResponseType.NotKnown); break;
        case 's': case 'S': app.answer(ResponseType.Skipped); break;
    }
}

async function main(): Promise<void> {
    window.addEventListener('keydown', handleKey);

    try {
        app.begin(await fetchWords());
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to load corpus:', err);
        app.fail(message);
    }
}

void main();