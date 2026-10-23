/**
 * The headline numbers: how many questions have been answered, how much
 * vocabulary is actively known, and how much is at least recognised — each
 * with its 95% interval.
 *
 * Passive is not shown as its own figure: it is the difference between the two
 * estimates. The chart carries the detail.
 *
 * Reads the model. On connect it subscribes to the signals it renders and
 * disposes those subscriptions on disconnect.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { LightElement } from './base.ts';

/** Format an interval as "low–high". */
function range(lo: number, hi: number): string {
    return `${lo.toLocaleString()}–${hi.toLocaleString()}`;
}

@customElement('pv-stats-bar')
export class PvStatsBar extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            // Reading these registers them as dependencies, so the
            // subscription re-runs (and triggers an update) on change.
            app.answers.value;
            app.activeVocabulary.value;
            app.vocabularyEstimate.value;
            this.requestUpdate();
        });
    }

    override render() {
        const activeCi = app.activeVocabularyInterval.value;
        const recognisedCi = app.vocabularyInterval.value;

        return html`
            <div class="stats-bar">
                <div class="stat">
                    <span class="stat-label">Questions answered</span>
                    <span class="stat-value">${app.answers.value}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Active vocabulary</span>
                    <span class="stat-value"
                        >${Math.round(app.activeVocabulary.value).toLocaleString()}</span
                    >
                    <span class="stat-sub">${range(activeCi.low, activeCi.high)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total recognised</span>
                    <span class="stat-value"
                        >${Math.round(app.vocabularyEstimate.value).toLocaleString()}</span
                    >
                    <span class="stat-sub">${range(recognisedCi.low, recognisedCi.high)}</span>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-stats-bar': PvStatsBar;
    }
}