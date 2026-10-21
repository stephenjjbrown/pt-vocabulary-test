/**
 * Recent answers list. Newest first.
 *
 * Lit escapes interpolated values by default, so corpus words are rendered
 * safely without manual escaping.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { LightElement } from './base.ts';

/** Cap the rendered list so a long session can't grow the DOM unbounded. */
const MAX_VISIBLE = 1000;

@customElement('pv-history')
export class PvHistory extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            app.history.value;
            this.requestUpdate();
        });
    }

    private static labelFor(response: number | null): { badge: string; label: string } {
        if (response === 1.0) return { badge: 'badge-yes', label: 'Yes' };
        if (response === 0.5) return { badge: 'badge-maybe', label: 'Maybe' };
        if (response === 0.0) return { badge: 'badge-no', label: 'No' };
        return { badge: 'badge-skip', label: 'Skip' };
    }

    override render() {
        const entries = app.history.value.slice(0, MAX_VISIBLE);

        return html`
            <div class="history">
                <h3>Recent Answers</h3>
                <div class="history-list">
                    ${entries.map((e) => {
                        const { badge, label } = PvHistory.labelFor(e.response);
                        return html`
                            <div class="history-item">
                                <span>
                                    <span class="hw">${e.word}</span>
                                    <span class="hr">#${e.rank.toLocaleString()}</span>
                                </span>
                                <span
                                    class=${badge}
                                    style="padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;"
                                    >${label}</span
                                >
                            </div>
                        `;
                    })}
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-history': PvHistory;
    }
}