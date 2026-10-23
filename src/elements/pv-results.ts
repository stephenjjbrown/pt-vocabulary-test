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
        const active = app.activeVocabulary.value;
        const recognised = app.vocabularyEstimate.value;
        const recognisedCi = app.vocabularyInterval.value;

        return html`
            <div class="results">
                <h2>🎉 Final Results</h2>
                <div class="result-grid">
                    <div class="result-card">
                        <span class="result-label">Active vocabulary</span>
                        <span class="result-value">${Math.round(active).toLocaleString()}</span>
                        <span class="result-sub">words you use</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">Total recognised</span>
                        <span class="result-value"
                            >${Math.round(recognised).toLocaleString()}</span
                        >
                        <span class="result-sub">
                            ${recognisedCi.low.toLocaleString()}–${recognisedCi.high.toLocaleString()}
                            at 95%
                        </span>
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
                            const ci = b.knownInterval;
                            return html`
                                <div class="profile-band">
                                    <div class="band-label">${BUCKETS[i]?.label ?? ''}</div>
                                    <div class="band-value">
                                        ${Math.round(b.knownShare * 100)}% recognised
                                    </div>
                                    <div style="font-size:0.7rem;color:var(--text-muted);">
                                        active ${Math.round(b.activeShare * 100)}% · CI
                                        ${Math.round(ci.low * 100)}–${Math.round(ci.high * 100)}%
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