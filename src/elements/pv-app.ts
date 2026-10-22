/**
 * The application shell: owns the layout and switches between the loading,
 * question and results views based on the model's phase.
 *
 * Reads the app singleton and calls methods on it, like every other view.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { LightElement } from './base.ts';

import './pv-stats-bar.ts';
import './pv-bucket-chart.ts';
import './pv-distribution.ts';
import './pv-question-card.ts';
import './pv-history.ts';
import './pv-results.ts';

@customElement('pv-app')
export class PvApp extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            app.phase.value;
            app.loadError.value;
            this.requestUpdate();
        });
    }

    override render() {
        switch (app.phase.value) {
            case 'loading':
                return this.renderLoading();
            case 'results':
                return html`<pv-results></pv-results>`;
            case 'ready':
                return html`
                    <pv-stats-bar></pv-stats-bar>
                    <div class="main-grid">
                        <div class="left-panel">
                            <pv-bucket-chart></pv-bucket-chart>
                            <pv-distribution></pv-distribution>
                        </div>
                        <div class="right-panel">
                            <pv-question-card></pv-question-card>
                            <pv-history></pv-history>
                            <div class="controls">
                                <button class="btn btn-reset" @click=${() => app.reset()}>↺ Start Over</button>
                            </div>
                        </div>
                    </div>
                `;
        }
    }

    private renderLoading() {
        const error = app.loadError.value;
        if (error) {
            return html`
                <div class="loading">
                    <p>Failed to load words from the API.</p>
                    <p style="font-size:0.85rem;color:var(--text-muted);">${error}</p>
                    <p style="font-size:0.8rem;color:var(--text-muted);">
                        Make sure the server is running (<code>npm run dev</code>) and the
                        database is built (<code>npm run preprocess</code>).
                    </p>
                </div>
            `;
        }
        return html`
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading word corpus...</p>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-app': PvApp;
    }
}