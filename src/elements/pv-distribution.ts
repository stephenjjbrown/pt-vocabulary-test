/**
 * The total-vocabulary visualization: a horizontal range bar showing the
 * 95% credible interval, with a marker at the point estimate.
 *
 * Subscribes to `app.buckets` and redraws when it changes.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import { vocabEstimate, vocabCredibleInterval } from '../stats.ts';
import { LightElement } from './base.ts';

const MAX_VOCAB_PLOT = 64000;
const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 200;

@customElement('pv-distribution')
export class PvDistribution extends LightElement {
    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            const buckets = app.buckets.value;
            const ci = vocabCredibleInterval(buckets, BUCKETS);
            const estimate = vocabEstimate(buckets, BUCKETS);
            this.requestUpdate();
            this.draw(ci.low, ci.high, estimate);
        });
    }

    override render() {
        return html`
            <div class="distribution-container">
                <h3>Vocabulary Estimate &amp; Uncertainty</h3>
                <canvas width=${CANVAS_WIDTH} height=${CANVAS_HEIGHT}></canvas>
            </div>
        `;
    }

    private draw(low: number, high: number, estimate: number): void {
        const canvas = this.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const lo = Math.max(0, low);
        const hi = Math.min(MAX_VOCAB_PLOT, high);
        const xLo = 60 + (lo / MAX_VOCAB_PLOT) * (w - 80);
        const xHi = 60 + (hi / MAX_VOCAB_PLOT) * (w - 80);
        const xMu = 60 + (estimate / MAX_VOCAB_PLOT) * (w - 80);
        const yMid = h / 2;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(xLo, yMid - 8, xHi - xLo, 16);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xMu, yMid - 14);
        ctx.lineTo(xMu, yMid + 14);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0', 60, h - 8);
        ctx.fillText(MAX_VOCAB_PLOT.toLocaleString(), w - 20, h - 8);
        ctx.fillText(`${low.toLocaleString()}–${high.toLocaleString()}`, (xLo + xHi) / 2, yMid - 16);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`μ = ${Math.round(estimate).toLocaleString()}`, xMu, yMid + 28);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-distribution': PvDistribution;
    }
}