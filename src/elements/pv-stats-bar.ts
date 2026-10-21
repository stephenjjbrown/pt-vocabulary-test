/**
 * The three stat tiles: questions answered, estimated vocabulary, and the
 * 95% credible interval.
 *
 * Reads the model, calls no controller. On connect it subscribes to the
 * signals it renders; on disconnect those subscriptions are dropped.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import { vocabEstimate, vocabCredibleInterval } from '../stats.ts';
import { LightElement } from './base.ts';

@customElement('pv-stats-bar')
export class PvStatsBar extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            // Reading these registers them as dependencies, so the
            // subscription re-runs (and triggers an update) on change.
            app.answers.value;
            app.buckets.value;
            this.requestUpdate();
        });
    }

    override render() {
        const buckets = app.buckets.value;
        const estimate = vocabEstimate(buckets, BUCKETS);
        const ci = vocabCredibleInterval(buckets, BUCKETS);

        return html`
            <div class="stats-bar">
                <div class="stat">
                    <span class="stat-label">Questions answered</span>
                    <span class="stat-value">${app.answers.value}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Estimated vocabulary</span>
                    <span class="stat-value">${Math.round(estimate).toLocaleString()}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">95% credible interval</span>
                    <span class="stat-value"
                        >${ci.low.toLocaleString()}–${ci.high.toLocaleString()}</span
                    >
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