/**
 * Bucket knowledge chart: bar chart with error bars.
 *
 * Each bar spans the 95% credible interval (Wilson with continuity
 * correction); an orange marker shows the point estimate k/n.
 *
 * Chart.js owns the canvas, so its lifecycle is tied to the element's:
 * create it once the canvas exists, update it when the model changes, and
 * destroy it on disconnect so the instance doesn't leak across hot reloads.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
    Chart,
    BarController,
    BarElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    PointElement,
    ScatterController,
    LineController,
    type ChartConfiguration,
} from 'chart.js';
import {
    BarWithErrorBarsController,
    BarWithErrorBar,
    PointWithErrorBar,
} from 'chartjs-chart-error-bars';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import type { Bucket } from '../models/bucket.ts';
import { LightElement } from './base.ts';

Chart.register(
    BarController,
    BarElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    ScatterController,
    LineController,
    PointElement,
    BarWithErrorBarsController,
    BarWithErrorBar,
    PointWithErrorBar,
);

/** One bar: the CI spans yMin..yMax, y is the point estimate. */
interface BucketBarPoint {
    x: string;
    y: number;
    yMin: number;
    yMax: number;
}

/**
 * One point marker. The error-bar plugin's types require min/max alongside
 * x/y, so we set them equal to the value: a point estimate has no spread
 * of its own, so the whisker collapses to zero length.
 */
interface BucketPointMarker {
    x: string;
    y: number;
    yMin: number;
    yMax: number;
}

@customElement('pv-bucket-chart')
export class PvBucketChart extends LightElement {
    private chart: Chart | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            const buckets = app.buckets.value;
            if (!this.chart) {
                this.createChart(buckets);
            } else {
                this.chart.data.datasets[0]!.data = this.buildBars(buckets);
                this.chart.data.datasets[1]!.data = this.buildPoints(buckets);
                this.chart.update('none');
            }
        });
    }

    override disconnectedCallback(): void {
        this.chart?.destroy();
        this.chart = null;
        super.disconnectedCallback();
    }

    override render() {
        return html`
            <div class="buckets-container">
                <h2>Knowledge by Frequency Bucket</h2>
                <p class="buckets-legend">
                    <span class="legend-item"><span class="legend-bar"></span> 95% CI</span>
                    <span class="legend-item"><span class="legend-dot"></span> Point estimate (k/n)</span>
                </p>
                <div class="buckets-chart-wrap">
                    <canvas></canvas>
                </div>
            </div>
        `;
    }

    protected override firstUpdated(): void {
        if (!this.chart) this.createChart(app.buckets.value);
    }

    private buildBars(buckets: Bucket[]): BucketBarPoint[] {
        return buckets.map((b, i) => {
            const ci = b.credibleInterval;
            return {
                x: BUCKETS[i]?.label ?? String(i + 1),
                y: b.pointEstimate,
                yMin: ci.low,
                yMax: ci.high,
            };
        });
    }

    private buildPoints(buckets: Bucket[]): BucketPointMarker[] {
        return buckets.map((b, i) => {
            const y = b.pointEstimate;
            return {
                x: BUCKETS[i]?.label ?? String(i + 1),
                y,
                yMin: y,
                yMax: y,
            };
        });
    }

    private createChart(buckets: Bucket[]): void {
        const canvas = this.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;

        // Defensive: something else may have claimed this canvas already.
        Chart.getChart(canvas)?.destroy();

        const config: ChartConfiguration = {
            type: BarWithErrorBarsController.id,
            data: {
                labels: BUCKETS.map(b => b.label),
                datasets: [
                    {
                        label: '95% CI',
                        data: this.buildBars(buckets),
                        backgroundColor: 'rgba(56, 189, 248, 0.25)',
                        borderColor: 'rgba(56, 189, 248, 0.8)',
                        borderWidth: 1,
                        errorBarColor: 'rgba(56, 189, 248, 1)',
                        errorBarLineWidth: 2,
                        errorBarWhiskerSize: 8,
                        // The point estimate is shown by the overlay dataset.
                        pointRadius: 0,
                    },
                    {
                        label: 'Point estimate',
                        type: 'scatter',
                        data: this.buildPoints(buckets),
                        backgroundColor: '#f59e0b',
                        borderColor: '#f59e0b',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            callback: (v) => `${Math.round(Number(v) * 100)}%`,
                            color: '#94a3b8',
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { display: false },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const d = ctx.raw as Partial<BucketBarPoint>;
                                if (d.yMin != null && d.yMax != null) {
                                    return `95% CI: [${(d.yMin * 100).toFixed(1)}%, ${(d.yMax * 100).toFixed(1)}%]`;
                                }
                                if (d.y != null) {
                                    return `Point estimate: ${(d.y * 100).toFixed(1)}%`;
                                }
                                return '';
                            },
                        },
                    },
                },
            },
        };

        this.chart = new Chart(canvas, config);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pv-bucket-chart': PvBucketChart;
    }
}