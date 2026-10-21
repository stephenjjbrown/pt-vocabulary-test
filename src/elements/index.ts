/**
 * Barrel export for the view library.
 *
 * Importing this module registers every custom element, which is what makes
 * `<pv-app>` and friends work in index.html.
 */

export { LightElement } from './base.ts';
export { PvApp } from './pv-app.ts';
export { PvStatsBar } from './pv-stats-bar.ts';
export { PvBucketChart } from './pv-bucket-chart.ts';
export { PvDistribution } from './pv-distribution.ts';
export { PvQuestionCard } from './pv-question-card.ts';
export { PvHistory } from './pv-history.ts';
export { PvResults } from './pv-results.ts';