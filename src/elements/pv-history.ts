/**
 * Recent answers list. Newest first.
 *
 * Lit escapes interpolated values by default, so corpus words are rendered
 * safely without manual escaping.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { ResponseType } from '../models/response-type.ts';
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

    /** Display for each response. Typed as a full record, so adding a
     *  ResponseType member is a compile error until it is given a label. */
    private static readonly LABELS: Record<ResponseType, { badge: string; label: string }> = {
        [ResponseType.Active]: { badge: 'badge-active', label: 'Active' },
        [ResponseType.Passive]: { badge: 'badge-passive', label: 'Passive' },
        [ResponseType.NotKnown]: { badge: 'badge-not-known', label: 'Not known' },
        [ResponseType.Skipped]: { badge: 'badge-skip', label: 'Skip' },
    };

    override render() {
        const entries = app.history.value.slice(0, MAX_VISIBLE);

        return html`
            <div class="history">
                <h3>Recent Answers</h3>
                <div class="history-list">
                    ${entries.map((e) => {
                        const { badge, label } = PvHistory.LABELS[e.response];
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