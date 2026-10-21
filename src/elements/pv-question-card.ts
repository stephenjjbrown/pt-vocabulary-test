/**
 * The question card: shows the current word and rank, and hosts the
 * Yes / Maybe / No / Skip buttons.
 *
 * Reads the current question from the model. Button clicks call the
 * session controller — the view never mutates anything itself.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import { answer } from '../controllers/app-controller.ts';
import { LightElement } from './base.ts';

@customElement('pv-question-card')
export class PvQuestionCard extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            app.currentQuestion.value;
            this.requestUpdate();
        });
    }

    override render() {
        const current = app.currentQuestion.value;
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
                    <button class="btn btn-yes" @click=${() => answer(1.0)}>Yes</button>
                    <button class="btn btn-maybe" @click=${() => answer(0.5)}>Maybe (0.5)</button>
                    <button class="btn btn-no" @click=${() => answer(0.0)}>No</button>
                </div>
                <div class="button-row secondary">
                    <button class="btn btn-skip" @click=${() => answer(null)}>Skip</button>
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