/**
 * The question card: shows the current word and rank, and hosts the
 * Active / Passive / Not known / Skip buttons.
 *
 * Reads the current word from the model and calls `app.answer()` — the view
 * never mutates state itself.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { ResponseType } from '../models/response-type.ts';
import { LightElement } from './base.ts';

@customElement('pv-question-card')
export class PvQuestionCard extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            app.currentWord.value;
            this.requestUpdate();
        });
    }

    override render() {
        const word = app.currentWord.value;

        return html`
            <div class="question-card">
                <div class="word-display">
                    <span class="word">${word?.word ?? '—'}</span>
                    <span class="rank">
                        ${word ? `Rank #${word.rank.toLocaleString()}` : ''}
                    </span>
                </div>
                <p class="question-prompt">Do you know this word?</p>
                <div class="button-row">
                    <button class="btn btn-active" @click=${() => app.answer(ResponseType.Active)}>
                        Active <span class="btn-hint">I use it</span>
                    </button>
                    <button class="btn btn-passive" @click=${() => app.answer(ResponseType.Passive)}>
                        Passive <span class="btn-hint">I recognise it</span>
                    </button>
                    <button class="btn btn-not-known" @click=${() => app.answer(ResponseType.NotKnown)}>
                        Not known
                    </button>
                </div>
                <div class="button-row secondary">
                    <button class="btn btn-skip" @click=${() => app.answer(ResponseType.Skipped)}>Skip</button>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-question-card': PvQuestionCard;
    }
}