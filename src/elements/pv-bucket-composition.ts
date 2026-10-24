/**
 * Vocabulary mix by bucket: a horizontal stacked bar per frequency band.
 *
 * Each bar totals the fraction of that bucket's words the user knows, split
 * into the part they use actively and the part they only recognise. Only the
 * point estimates are shown — this chart is about composition, not precision;
 * the area chart above carries the intervals.
 *
 * The passive segment is the remainder, `known − active`, which is the same as
 * `Bucket.passiveShare` since known is the union of the two categories.
 *
 * Colours come from CSS, which is why the bars use the same green and amber as
 * the Active and Passive answer buttons rather than the area chart's palette:
 * they identify the two answers the user gave.
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
    type ChartConfiguration,
} from 'chart.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import type { Bucket } from '../models/bucket.ts';
import { LightElement } from './base.ts';
import { readColours } from './palette.ts';

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

const COLOUR_VARS = ['--active', '--passive'] as const;
const COLOUR_FALLBACK = ['rgb(34, 197, 94)', 'rgb(245, 158, 11)'] as const;

interface Mix {
    active: number[];
    passive: number[];
}

function buildMix(buckets: Bucket[]): Mix {
    return {
        active: buckets.map(b => b.activeShare),
        passive: buckets.map(b => b.passiveShare),
    };
}

@customElement('pv-bucket-composition')
export class PvBucketComposition extends LightElement {
    private chart: Chart | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            const mix = buildMix(app.fixedBuckets.value);
            if (!this.chart) {
                this.createChart(mix);
            } else {
                this.applyMix(mix);
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
                <h2>Vocabulary Mix by Frequency Bucket</h2>
                <p class="buckets-legend">
                    <span class="legend-item"><span class="legend-bar mix-active"></span> Active</span>
                    <span class="legend-item"><span class="legend-bar mix-passive"></span> Passive</span>
                    <span class="legend-item">Point estimates only</span>
                </p>
                <div class="composition-chart-wrap">
                    <canvas></canvas>
                </div>
            </div>
        `;
    }

    protected override firstUpdated(): void {
        if (!this.chart) this.createChart(buildMix(app.fixedBuckets.value));
    }

    private applyMix(mix: Mix): void {
        if (!this.chart) return;

        const [active, passive] = this.chart.data.datasets;
        if (active) active.data = mix.active;
        if (passive) passive.data = mix.passive;

        this.chart.update('none');
    }

    private createChart(mix: Mix): void {
        const canvas = this.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;

        Chart.getChart(canvas)?.destroy();

        const [activeColour, passiveColour] = readColours(COLOUR_VARS, COLOUR_FALLBACK);

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels: BUCKETS.map(b => b.label),
                datasets: [
                    {
                        label: 'Active',
                        data: mix.active,
                        backgroundColor: activeColour,
                        stack: 'mix',
                        borderRadius: 2,
                        // No gap between the two segments of a bar.
                        borderSkipped: false,
                    },
                    {
                        label: 'Passive',
                        data: mix.passive,
                        backgroundColor: passiveColour,
                        stack: 'mix',
                        borderRadius: 2,
                        borderSkipped: false,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        stacked: true,
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            callback: (v) => `${Math.round(Number(v) * 100)}%`,
                            color: '#94a3b8',
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { display: false },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        // One tooltip per bar rather than one line per segment.
                        filter: (item) => item.datasetIndex === 0,
                        callbacks: {
                            label: (ctx) => {
                                const sets = ctx.chart.data.datasets;
                                const i = ctx.dataIndex;

                                const active = Number(sets[0]?.data[i] ?? 0);
                                const passive = Number(sets[1]?.data[i] ?? 0);

                                const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

                                return [
                                    `active ${pct(active)}`,
                                    `passive ${pct(passive)}`,
                                    `recognised ${pct(active + passive)}`,
                                ];
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
        'pv-bucket-composition': PvBucketComposition;
    }
}