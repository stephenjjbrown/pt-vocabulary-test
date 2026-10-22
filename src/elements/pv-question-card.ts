/**
 * The question card: shows the current word and rank, and hosts the
 * Yes / Maybe / No / Skip buttons.
 *
 * Reads the current word from the model and calls `app.answer()` — the view
 * never mutates state itself.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { ResponseType } from '../models/response-type.ts';
import { BUCKETS } from '../config.ts';
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
        const current = app.currentWord.value;
        const word = current?.word;
        const bucketLabel = current ? BUCKETS[current.bucketIdx]?.label ?? '' : '';

        return html`
            <div class="question-card">
                <div class="word-display">
                    <span class="word">${word?.word ?? '—'}</span>
                    <span class="rank">
                        ${word ? `Rank #${word.rank.toLocaleString()} · Bucket: ${bucketLabel}` : ''}
                    </span>
                </div>
                <p class="question-prompt">Do you know this word?</p>
                <div class="button-row">
                    <button class="btn btn-yes" @click=${() => app.answer(ResponseType.Active)}>Yes</button>
                    <button class="btn btn-maybe" @click=${() => app.answer(ResponseType.Passive)}>Maybe (0.5)</button>
                    <button class="btn btn-no" @click=${() => app.answer(ResponseType.NotKnown)}>No</button>
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