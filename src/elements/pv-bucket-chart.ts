/**
 * Knowledge by frequency bucket, as an area chart.
 *
 * The y axis is the fraction of a bucket's words, the x axis the buckets in
 * frequency order.
 *
 * Two overlapping sets of three areas are drawn, each filled from zero at a
 * single alpha so that overlaps deepen:
 *
 *   Known range (yellow)   — words answered active OR passive
 *     0 → lower bound, lower → estimate, estimate → upper bound
 *
 *   Active range (green)   — words answered active only
 *     0 → lower bound, lower → estimate, estimate → upper bound
 *
 * The active areas are drawn last, so they sit over the known ones. Since
 * active is a subset of known, the green never rises above the yellow.
 *
 * Chart.js owns the canvas, so its lifecycle is tied to the element's: create
 * it once the canvas exists, update it when the model changes, and destroy it
 * on disconnect so the instance doesn't leak across hot reloads.
 */

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
    type ChartConfiguration,
} from 'chart.js';

import { app } from '../models/app.ts';
import { BUCKETS } from '../config.ts';
import type { Bucket } from '../models/bucket.ts';
import { LightElement } from './base.ts';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
);

/** Known (active or passive). */
const YELLOW = 'rgba(245, 158, 11, 0.33)';

/** Active only, drawn over the known areas. */
const GREEN = 'rgba(34, 197, 94, 0.2)';

/** One category's three boundaries across all buckets. */
interface Trio {
    lows: number[];
    estimates: number[];
    highs: number[];
}

interface BucketSeries {
    known: Trio;
    active: Trio;
}

function emptyTrio(): Trio {
    return { lows: [], estimates: [], highs: [] };
}

function buildSeries(buckets: Bucket[]): BucketSeries {
    const known = emptyTrio();
    const active = emptyTrio();

    for (const b of buckets) {
        known.lows.push(b.knownInterval.low);
        known.estimates.push(b.knownShare);
        known.highs.push(b.knownInterval.high);

        active.lows.push(b.activeInterval.low);
        active.estimates.push(b.activeShare);
        active.highs.push(b.activeInterval.high);
    }

    return { known, active };
}

/** One area: a line through the series, filled down to zero. */
function areaDataset(label: string, data: number[], colour: string) {
    return {
        label,
        data,
        fill: 'origin' as const,
        backgroundColor: colour,
        borderWidth: 0,
        pointRadius: 0,
        tension: 0,
    };
}

/** Dataset indices, in the order they are added to the chart. */
const KNOWN_HIGH = 0;
const KNOWN_ESTIMATE = 1;
const KNOWN_LOW = 2;
const ACTIVE_HIGH = 3;
const ACTIVE_ESTIMATE = 4;
const ACTIVE_LOW = 5;

@customElement('pv-bucket-chart')
export class PvBucketChart extends LightElement {
    private chart: Chart | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.observe(() => {
            const series = buildSeries(app.buckets.value);
            if (!this.chart) {
                this.createChart(series);
            } else {
                this.applySeries(series);
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
                    <span class="legend-item"><span class="legend-bar known"></span> Recognised</span>
                    <span class="legend-item"><span class="legend-bar active"></span> Active</span>
                    <span class="legend-item">Darker shading is the range we are confident about</span>
                </p>
                <div class="buckets-chart-wrap">
                    <canvas></canvas>
                </div>
            </div>
        `;
    }

    protected override firstUpdated(): void {
        if (!this.chart) this.createChart(buildSeries(app.buckets.value));
    }

    private applySeries(series: BucketSeries): void {
        if (!this.chart) return;

        const sets = this.chart.data.datasets;
        const assign = (index: number, data: number[]): void => {
            const set = sets[index];
            if (set) set.data = data;
        };

        // Known first, active second — matching the draw order below.
        assign(KNOWN_HIGH, series.known.highs);
        assign(KNOWN_ESTIMATE, series.known.estimates);
        assign(KNOWN_LOW, series.known.lows);
        assign(ACTIVE_HIGH, series.active.highs);
        assign(ACTIVE_ESTIMATE, series.active.estimates);
        assign(ACTIVE_LOW, series.active.lows);

        this.chart.update('none');
    }

    private createChart(series: BucketSeries): void {
        const canvas = this.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;

        // Defensive: something else may have claimed this canvas already.
        Chart.getChart(canvas)?.destroy();

        const config: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: BUCKETS.map(b => b.label),
                datasets: [
                    // Known (yellow) first, so the active (green) areas land on
                    // top of them.
                    areaDataset('Known upper bound', series.known.highs, YELLOW),
                    areaDataset('Known best estimate', series.known.estimates, YELLOW),
                    areaDataset('Known lower bound', series.known.lows, YELLOW),
                    areaDataset('Active upper bound', series.active.highs, GREEN),
                    areaDataset('Active best estimate', series.active.estimates, GREEN),
                    areaDataset('Active lower bound', series.active.lows, GREEN),
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
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
                        // One tooltip per bucket rather than one line per area.
                        filter: (item) => item.datasetIndex === KNOWN_HIGH,
                        callbacks: {
                            label: (ctx) => {
                                const sets = ctx.chart.data.datasets;
                                const i = ctx.dataIndex;

                                const value = (index: number): number =>
                                    Number(sets[index]?.data[i]);

                                const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

                                const knownRange = `${pct(value(KNOWN_LOW))}–${pct(value(KNOWN_HIGH))}`;
                                const activeRange = `${pct(value(ACTIVE_LOW))}–${pct(value(ACTIVE_HIGH))}`;

                                return [
                                    `recognised ${pct(value(KNOWN_ESTIMATE))} [${knownRange}]`,
                                    `active ${pct(value(ACTIVE_ESTIMATE))} [${activeRange}]`,
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
        'pv-bucket-chart': PvBucketChart;
    }
}