/**
 * Knowledge by frequency bucket, as an area chart with linear-dodge blending.
 *
 * Two overlapping sets of three areas, one hue per category:
 *
 *   Recognised (red)   — answered active OR passive
 *   Active (green)     — answered active only
 *
 * Within each set the three areas are the lower bound, the estimate and the
 * upper bound, filled from zero, at 100%, 50% and 25% of full colour
 * intensity — a constant ratio between steps rather than equal ones, so the
 * shades read as a logarithmic ramp. Colours are opaque: the ramp is
 * brightness, not opacity. The percentages live in `style.css` as
 * `--chart-intensity-mid` and `--chart-intensity-weak`.
 *
 * Linear dodge is addition: each area's channels are summed with whatever is
 * already beneath it, clamping at full. Canvas spells it `lighter`. Because
 * addition commutes, the order Chart.js draws datasets in does not affect the
 * result.
 *
 *   red + green     → yellow   (the core, where both ranges overlap)
 *   red + red + red → red      (the recognised-only bands)
 *
 * The curves are smoothed with monotone cubic interpolation, which bends
 * between buckets without overshooting them.
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
    type Plugin,
    type ChartConfiguration,
} from 'chart.js';

import { app } from '../models/app.ts';
import { CONFIG, DYNAMIC_BUCKETS } from '../config.ts';
import type { Bucket } from '../models/bucket.ts';
import { LightElement } from './base.ts';
import { readColours } from './palette.ts';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
);

/**
 * Linear dodge — the canvas name for it is `lighter`. Each area's channels are
 * added to what is already beneath, clamping at full. Applied to the dataset
 * drawing only, so axes, grid and tooltips composite normally.
 *
 * Addition commutes, so the order Chart.js draws datasets in is irrelevant.
 * (`plus-lighter` is the newer spelling of the same operation; `lighter` has
 * the wider support.)
 */
const linearDodge: Plugin<'line'> = {
    id: 'linear-dodge',
    beforeDatasetsDraw(chart) {
        chart.ctx.save();
        chart.ctx.globalCompositeOperation = 'lighter';
    },
    afterDatasetsDraw(chart) {
        chart.ctx.restore();
    },
};

/** CSS custom properties holding the three shades, strongest first. */
const KNOWN_VARS = [
    '--chart-known-strong',
    '--chart-known-mid',
    '--chart-known-weak',
] as const;
const ACTIVE_VARS = [
    '--chart-active-strong',
    '--chart-active-mid',
    '--chart-active-weak',
] as const;

/** Used if the stylesheet is missing or a variable holds something unparseable. */
const KNOWN_FALLBACK = ['rgb(255, 0, 0)', 'rgb(128, 0, 0)', 'rgb(84, 0, 0)'] as const;
const ACTIVE_FALLBACK = ['rgb(0, 255, 0)', 'rgb(0, 128, 0)', 'rgb(0, 84, 0)'] as const;

/**
 * Read the palette from CSS, so the stylesheet owns the colours. Only
 * `--chart-known-colour` and `--chart-active-colour` need to be set there;
 * the shades derive from them with `color-mix()`.
 */
function readPalette(): { known: string[]; active: string[] } {
    return {
        known: readColours(KNOWN_VARS, KNOWN_FALLBACK),
        active: readColours(ACTIVE_VARS, ACTIVE_FALLBACK),
    };
}

/**
 * Buckets are plotted at their midpoint in corpus rank on a linear x axis, so
 * equal-width buckets come out evenly spaced. Axis-edge points repeat the first
 * and last bucket's values so the areas reach the frame rather than stopping at
 * the outermost midpoints.
 */
const MIDPOINTS = DYNAMIC_BUCKETS.map(b => (b.start + b.end) / 2);
const X_POSITIONS = [0, ...MIDPOINTS, CONFIG.MAX_RANK];

/** A point on the rank axis. */
interface Sample {
    x: number;
    y: number;
}

/** One category's three boundaries across all buckets. */
interface Trio {
    lows: Sample[];
    estimates: Sample[];
    highs: Sample[];
}

interface BucketSeries {
    known: Trio;
    active: Trio;
}

interface RawTrio {
    lows: number[];
    estimates: number[];
    highs: number[];
}

/** Map a bucket's values onto the axis, with edge points so the areas reach
 *  both ends of the frame. */
function samples(values: number[]): Sample[] {
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;

    const points: Sample[] = [{ x: X_POSITIONS[0]!, y: first }];
    for (let i = 0; i < values.length; i++) {
        points.push({ x: X_POSITIONS[i + 1]!, y: values[i]! });
    }
    points.push({ x: X_POSITIONS[X_POSITIONS.length - 1]!, y: last });

    return points;
}

function toTrio(raw: RawTrio): Trio {
    return {
        lows: samples(raw.lows),
        estimates: samples(raw.estimates),
        highs: samples(raw.highs),
    };
}

function emptyRawTrio(): RawTrio {
    return { lows: [], estimates: [], highs: [] };
}

function buildSeries(buckets: Bucket[]): BucketSeries {
    const known = emptyRawTrio();
    const active = emptyRawTrio();

    for (const b of buckets) {
        known.lows.push(b.knownInterval.low);
        known.estimates.push(b.knownShare);
        known.highs.push(b.knownInterval.high);

        active.lows.push(b.activeInterval.low);
        active.estimates.push(b.activeShare);
        active.highs.push(b.activeInterval.high);
    }

    return { known: toTrio(known), active: toTrio(active) };
}

/** One area: a line through the series, filled down to zero.
 *
 * `cubicInterpolationMode: 'monotone'` curves the line without letting it
 * overshoot between points. Plain `tension` would be simpler but can push the
 * curve past the neighbouring values — which here would draw a plausible range
 * wider than the interval it represents, or dip below zero.
 */
function areaDataset(label: string, data: Sample[], colour: string) {
    return {
        label,
        data,
        fill: 'origin' as const,
        backgroundColor: colour,
        borderWidth: 0,
        pointRadius: 0,
        cubicInterpolationMode: 'monotone' as const,
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
            const series = buildSeries(app.dynamicBuckets.value);
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
                    <span class="legend-item">Brighter is the range we are confident about</span>
                </p>
                <div class="buckets-chart-wrap">
                    <canvas></canvas>
                </div>
            </div>
        `;
    }

    protected override firstUpdated(): void {
        if (!this.chart) this.createChart(buildSeries(app.dynamicBuckets.value));
    }

    private applySeries(series: BucketSeries): void {
        if (!this.chart) return;

        const sets = this.chart.data.datasets;
        const assign = (index: number, data: Sample[]): void => {
            const set = sets[index];
            if (set) set.data = data;
        };

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

        const palette = readPalette();

        const config: ChartConfiguration<'line'> = {
            type: 'line',
            // Inline plugin: blending applies to the dataset drawing only.
            plugins: [linearDodge],
            data: {
                datasets: [
                    areaDataset('Known upper bound', series.known.highs, palette.known[2]!),
                    areaDataset('Known best estimate', series.known.estimates, palette.known[1]!),
                    areaDataset('Known lower bound', series.known.lows, palette.known[0]!),
                    areaDataset('Active upper bound', series.active.highs, palette.active[2]!),
                    areaDataset('Active best estimate', series.active.estimates, palette.active[1]!),
                    areaDataset('Active lower bound', series.active.lows, palette.active[0]!),
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
                        type: 'linear' as const,
                        min: 0,
                        max: CONFIG.MAX_RANK,
                        ticks: {
                            color: '#94a3b8',
                            maxTicksLimit: 7,
                            callback: (v) => {
                                const n = Number(v);
                                if (n >= 1000) return `${Math.round(n / 1000)}K`;
                                return String(n);
                            },
                        },
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

                                const value = (index: number): number => {
                                    const point = sets[index]?.data[i] as Sample | undefined;
                                    return point?.y ?? 0;
                                };

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
