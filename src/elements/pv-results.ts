/**
 * Final results: overall estimate, credible interval, question count, and a
 * per-bucket breakdown.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import { LightElement } from './base.ts';

@customElement('pv-results')
export class PvResults extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            app.answers.value;
            app.vocabularyEstimate.value;
            app.vocabularyInterval.value;
            this.requestUpdate();
        });
    }

    override render() {
        const buckets = app.buckets.value;
        const estimate = app.vocabularyEstimate.value;
        const ci = app.vocabularyInterval.value;

        return html`
            <div class="results">
                <h2>🎉 Final Results</h2>
                <div class="result-grid">
                    <div class="result-card">
                        <span class="result-label">Estimated vocabulary</span>
                        <span class="result-value">${Math.round(estimate).toLocaleString()}</span>
                        <span class="result-sub">words known</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">95% credible interval</span>
                        <span class="result-value"
                            >${ci.low.toLocaleString()}–${ci.high.toLocaleString()}</span
                        >
                        <span class="result-sub">range of uncertainty</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">Questions answered</span>
                        <span class="result-value">${app.answers.value}</span>
                        <span class="result-sub">total asked</span>
                    </div>
                </div>

                <div class="result-summary">
                    <h3>Bucket Breakdown</h3>
                    <div>
                        ${buckets.map((b, i) => {
                            const mean = b.pointEstimate;
                            const bucketCi = b.credibleInterval;
                            return html`
                                <div class="profile-band">
                                    <div class="band-label">${BUCKETS[i]?.label ?? ''}</div>
                                    <div class="band-value">${Math.round(mean * 100)}%</div>
                                    <div style="font-size:0.7rem;color:var(--text-muted);">
                                        ${Math.round(bucketCi.low * 100)}–${Math.round(bucketCi.high * 100)}%
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                </div>

                <button class="btn btn-primary" @click=${() => app.reset()}>🔄 Take Test Again</button>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-results': PvResults;
    }
}