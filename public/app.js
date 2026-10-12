/**
 * Portuguese Vocabulary Estimator - Bayesian Adaptive Web App
 * 
 * Core model:
 *   P(know word at rank r | V, steepness) = sigmoid((V - r) / steepness)
 * 
 * We maintain a discrete grid posterior over V, update with each answer,
 * and use expected information gain to select the next question.
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CONFIG = {
    // Grid over possible vocabulary sizes (log-spaced)
    V_MIN: 50,
    V_MAX: 100000,
    V_STEPS: 400,

    // Sigmoid steepness (how sharp the knowledge cliff is)
    STEEPNESS: 500,

    // Exploration vs exploitation
    EXPLORATION_RATE: 0.15, // 15% of questions explore randomly

    // Question budget
    MAX_QUESTIONS: 300,
    MIN_QUESTIONS: 20,

    // Prior: log-uniform over V
    PRIOR_TYPE: 'log-uniform',
};

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

let words = [];           // [{word, rank, freq}]
let posterior = [];       // [{v, logP}] — unnormalized log-probabilities
let answers = [];         // [{rank, response}]  response: 1=yes, 0.5=maybe, 0=no
let askedRanks = new Set();
let currentQuestionIndex = null;
let isAutoAdvance = true;

// UI refs
const els = {};

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────

function init() {
    cacheElements();
    loadWords().then(() => {
        initPosterior();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        nextQuestion();
    });
}

function cacheElements() {
    const ids = [
        'loading','app',
        'questionCount','estimate','credibleInterval',
        'curveCanvas','distCanvas',
        'currentWord','wordRank',
        'questionCard','answerHistory',
        'btnYes','btnMaybe','btnNo','btnSkip','btnStop','btnReset',
        'autoAdvance',
        'results','finalEstimate','finalCI','finalQuestions','profileBreakdown',
        'btnRestart'
    ];
    ids.forEach(id => els[id] = document.getElementById(id));

    els.btnYes.onclick = () => answer(1.0);
    els.btnMaybe.onclick = () => answer(0.5);
    els.btnNo.onclick = () => answer(0.0);
    els.btnSkip.onclick = () => answer(null); // skip = no info
    els.btnStop.onclick = showResults;
    els.btnReset.onclick = resetTest;
    els.btnRestart.onclick = resetTest;
    els.autoAdvance.onchange = (e) => { isAutoAdvance = e.target.checked; };

    window.addEventListener('keydown', handleKey);
}

async function loadWords() {
    const res = await fetch('ranked-words.json');
    words = await res.json();
    console.log(`Loaded ${words.length.toLocaleString()} words`);
}

// ─────────────────────────────────────────────────────────────
// BAYESIAN POSTERIOR
// ─────────────────────────────────────────────────────────────

function initPosterior() {
    posterior = [];
    const logMin = Math.log(CONFIG.V_MIN);
    const logMax = Math.log(CONFIG.V_MAX);
    const step = (logMax - logMin) / (CONFIG.V_STEPS - 1);

    for (let i = 0; i < CONFIG.V_STEPS; i++) {
        const v = Math.exp(logMin + i * step);
        // Log-uniform prior → flat in log-space
        posterior.push({ v, logP: 0 });
    }
}

/**
 * Likelihood of observing `response` at rank `r` given V.
 * response: 1 = yes, 0.5 = maybe, 0 = no
 * We model "maybe" as a noisy observation: 50% yes + 50% no.
 */
function likelihood(response, rank, V) {
    const pKnow = sigmoid((V - rank) / CONFIG.STEEPNESS);

    if (response === 1.0) {
        return pKnow;
    } else if (response === 0.0) {
        return 1 - pKnow;
    } else if (response === 0.5) {
        // "maybe" = 0.5 * yes + 0.5 * no
        return 0.5 * pKnow + 0.5 * (1 - pKnow);
    }
    return 1; // skip → no info
}

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function updatePosterior(rank, response) {
    let maxLogP = -Infinity;
    for (let i = 0; i < posterior.length; i++) {
        const pt = posterior[i];
        const lh = likelihood(response, rank, pt.v);
        pt.logP += Math.log(Math.max(lh, 1e-300));
        if (pt.logP > maxLogP) maxLogP = pt.logP;
    }

    // Normalize in log-space (subtract max, then exp and sum)
    let sumExp = 0;
    for (let i = 0; i < posterior.length; i++) {
        posterior[i].logP -= maxLogP;
        sumExp += Math.exp(posterior[i].logP);
    }

    const logSum = Math.log(sumExp);
    for (let i = 0; i < posterior.length; i++) {
        posterior[i].logP -= logSum;
    }
}

// ─────────────────────────────────────────────────────────────
// ESTIMATES FROM POSTERIOR
// ─────────────────────────────────────────────────────────────

function getStats() {
    // Convert to probabilities
    const probs = posterior.map(p => ({ v: p.v, p: Math.exp(p.logP) }));

    // Mean
    let mean = 0;
    for (const pt of probs) mean += pt.v * pt.p;

    // 95% credible interval
    let cum = 0;
    let lower = CONFIG.V_MIN;
    let upper = CONFIG.V_MAX;
    for (const pt of probs) {
        cum += pt.p;
        if (cum >= 0.025 && lower === CONFIG.V_MIN) lower = pt.v;
        if (cum >= 0.975 && upper === CONFIG.V_MAX) upper = pt.v;
    }

    // MAP
    let mapV = probs[0].v;
    let maxP = probs[0].p;
    for (const pt of probs) {
        if (pt.p > maxP) { maxP = pt.p; mapV = pt.v; }
    }

    return { mean: Math.round(mean), lower: Math.round(lower), upper: Math.round(upper), map: Math.round(mapV) };
}

/**
 * Expected probability of knowing a word at rank r, under current posterior.
 */
function expectedPKnow(rank) {
    let sum = 0;
    for (const pt of posterior) {
        const p = Math.exp(pt.logP);
        sum += p * sigmoid((pt.v - rank) / CONFIG.STEEPNESS);
    }
    return sum;
}

/**
 * Expected information gain from asking about rank r.
 * Approximate: choose rank where expected P(know) is closest to 0.5.
 */
function expectedInformationGain(rank) {
    const ep = expectedPKnow(rank);
    // Binary entropy: maximum at p=0.5
    const entropy = -(ep * Math.log2(ep) + (1 - ep) * Math.log2(1 - ep));
    return isNaN(entropy) ? 0 : entropy;
}

// ─────────────────────────────────────────────────────────────
// QUESTION SELECTION
// ─────────────────────────────────────────────────────────────

function selectNextRank() {
    // Exploration: occasionally pick randomly to avoid getting stuck
    if (Math.random() < CONFIG.EXPLORATION_RATE) {
        let idx;
        do { idx = Math.floor(Math.random() * words.length); }
        while (askedRanks.has(idx));
        return idx;
    }

    // Exploitation: pick the rank with maximum expected information gain
    // To avoid scanning all 100K words each time, we sample candidates
    const CANDIDATES = 2000;
    let bestIdx = -1;
    let bestGain = -1;

    for (let i = 0; i < CANDIDATES; i++) {
        const idx = Math.floor(Math.random() * words.length);
        if (askedRanks.has(idx)) continue;
        const gain = expectedInformationGain(words[idx].rank);
        if (gain > bestGain) {
            bestGain = gain;
            bestIdx = idx;
        }
    }

    // Fallback: random if no candidate found
    if (bestIdx === -1) {
        do { bestIdx = Math.floor(Math.random() * words.length); }
        while (askedRanks.has(bestIdx));
    }

    return bestIdx;
}

function nextQuestion() {
    if (answers.length >= CONFIG.MAX_QUESTIONS) {
        showResults();
        return;
    }

    const idx = selectNextRank();
    currentQuestionIndex = idx;
    askedRanks.add(idx);

    const w = words[idx];
    els.currentWord.textContent = w.word;
    els.wordRank.textContent = `Rank #${w.rank.toLocaleString()}`;

    els.questionCount.textContent = answers.length;
}

function answer(response) {
    if (currentQuestionIndex === null) return;

    const rank = words[currentQuestionIndex].rank;
    const word = words[currentQuestionIndex].word;

    if (response !== null) {
        answers.push({ rank, response, word });
        updatePosterior(rank, response);
        addHistory(word, rank, response);

        // Update stats
        const stats = getStats();
        els.estimate.textContent = stats.mean.toLocaleString();
        els.credibleInterval.textContent = `${stats.lower.toLocaleString()}–${stats.upper.toLocaleString()}`;
    } else {
        // Skip
        addHistory(word, rank, null);
    }

    // Redraw curves
    drawCurve();
    drawDistribution();

    if (isAutoAdvance && answers.length < CONFIG.MAX_QUESTIONS) {
        nextQuestion();
    } else if (answers.length >= CONFIG.MAX_QUESTIONS) {
        showResults();
    }
}

// ─────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────

function addHistory(word, rank, response) {
    const div = document.createElement('div');
    div.className = 'history-item';

    let badge = '';
    let label = '';
    if (response === 1.0) { badge = 'badge-yes'; label = 'Yes'; }
    else if (response === 0.5) { badge = 'badge-maybe'; label = 'Maybe'; }
    else if (response === 0.0) { badge = 'badge-no'; label = 'No'; }
    else { badge = 'badge-skip'; label = 'Skip'; }

    div.innerHTML = `
        <span>
            <span class="hw">${word}</span>
            <span class="hr">#${rank.toLocaleString()}</span>
        </span>
        <span class="${badge}" style="padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">${label}</span>
    `;
    els.answerHistory.insertBefore(div, els.answerHistory.firstChild);
}

// ─────────────────────────────────────────────────────────────
// CANVAS RENDERING
// ─────────────────────────────────────────────────────────────

function drawCurve() {
    const canvas = els.curveCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Margins
    const mLeft = 60, mRight = 20, mTop = 20, mBottom = 40;
    const pw = w - mLeft - mRight;
    const ph = h - mTop - mBottom;

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const y = mTop + (ph / 10) * i;
        ctx.beginPath(); ctx.moveTo(mLeft, y); ctx.lineTo(mLeft + pw, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const y = mTop + (ph / 5) * i;
        ctx.fillText(`${(1 - i / 5).toFixed(1)}`, mLeft - 8, y + 4);
    }

    // X-axis labels (log scale)
    ctx.textAlign = 'center';
    const xLabels = [1, 10, 100, 1000, 10000, 100000];
    for (const label of xLabels) {
        const x = mLeft + (Math.log(label) / Math.log(100000)) * pw;
        ctx.fillText(label.toLocaleString(), x, h - 10);
    }

    // Compute curve points
    const ranks = [];
    const expected = [];
    const lower = [];
    const upper = [];

    const nPoints = 200;
    for (let i = 0; i <= nPoints; i++) {
        const logRank = (Math.log(1) + (Math.log(100000) - Math.log(1)) * (i / nPoints));
        const rank = Math.round(Math.exp(logRank));
        if (rank > words.length) break;
        ranks.push(rank);

        // Expected
        expected.push(expectedPKnow(rank));

        // Credible band: percentiles of P(know) under posterior
        const ps = posterior.map(pt => sigmoid((pt.v - rank) / CONFIG.STEEPNESS));
        const probs = posterior.map(pt => Math.exp(pt.logP));
        lower.push(weightedQuantile(ps, probs, 0.025));
        upper.push(weightedQuantile(ps, probs, 0.975));
    }

    // Draw credible band
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    for (let i = 0; i < ranks.length; i++) {
        const x = mLeft + (Math.log(ranks[i]) / Math.log(100000)) * pw;
        const y = mTop + (1 - upper[i]) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = ranks.length - 1; i >= 0; i--) {
        const x = mLeft + (Math.log(ranks[i]) / Math.log(100000)) * pw;
        const y = mTop + (1 - lower[i]) * ph;
        ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw expected curve
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < ranks.length; i++) {
        const x = mLeft + (Math.log(ranks[i]) / Math.log(100000)) * pw;
        const y = mTop + (1 - expected[i]) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw observed answers
    for (const ans of answers) {
        const x = mLeft + (Math.log(ans.rank) / Math.log(100000)) * pw;
        const y = mTop + (1 - ans.response) * ph;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = ans.response === 1.0 ? '#22c55e' : ans.response === 0.5 ? '#f59e0b' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Draw MAP estimate line
    const stats = getStats();
    const mapX = mLeft + (Math.log(stats.map) / Math.log(100000)) * pw;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX, mTop);
    ctx.lineTo(mapX, mTop + ph);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawDistribution() {
    const canvas = els.distCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const mLeft = 60, mRight = 20, mTop = 10, mBottom = 30;
    const pw = w - mLeft - mRight;
    const ph = h - mTop - mBottom;

    // Find max probability for scaling
    let maxP = 0;
    for (const pt of posterior) {
        const p = Math.exp(pt.logP);
        if (p > maxP) maxP = p;
    }

    // Draw distribution
    ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.beginPath();
    ctx.moveTo(mLeft, h - mBottom);
    for (let i = 0; i < posterior.length; i++) {
        const pt = posterior[i];
        const x = mLeft + (i / (posterior.length - 1)) * pw;
        const y = mTop + ph - (Math.exp(pt.logP) / maxP) * ph;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(mLeft + pw, h - mBottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < posterior.length; i++) {
        const pt = posterior[i];
        const x = mLeft + (i / (posterior.length - 1)) * pw;
        const y = mTop + ph - (Math.exp(pt.logP) / maxP) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mean line
    const stats = getStats();
    const meanIdx = posterior.findIndex(pt => pt.v >= stats.mean);
    const meanX = mLeft + (meanIdx / (posterior.length - 1)) * pw;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(meanX, mTop);
    ctx.lineTo(meanX, h - mBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const labels = [50, 500, 5000, 50000, 100000];
    for (const v of labels) {
        const idx = Math.round((Math.log(v) - Math.log(CONFIG.V_MIN)) / (Math.log(CONFIG.V_MAX) - Math.log(CONFIG.V_MIN)) * (posterior.length - 1));
        const x = mLeft + (idx / (posterior.length - 1)) * pw;
        ctx.fillText(v.toLocaleString(), x, h - 8);
    }

    // Mean label
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`μ = ${stats.mean.toLocaleString()}`, meanX, mTop - 2);
}

function weightedQuantile(values, weights, q) {
    // Sort by value
    const pairs = values.map((v, i) => ({ v, w: weights[i] }));
    pairs.sort((a, b) => a.v - b.v);

    let cum = 0;
    const totalW = weights.reduce((a, b) => a + b, 0);
    const target = q * totalW;

    for (const p of pairs) {
        cum += p.w;
        if (cum >= target) return p.v;
    }
    return pairs[pairs.length - 1].v;
}

// ─────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────

function showResults() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');

    const stats = getStats();
    els.finalEstimate.textContent = stats.mean.toLocaleString();
    els.finalCI.textContent = `${stats.lower.toLocaleString()}–${stats.upper.toLocaleString()}`;
    els.finalQuestions.textContent = answers.length;

    // Profile breakdown by frequency band
    const bands = [
        { label: 'Top 1K', start: 1, end: 1000 },
        { label: '1K–2K', start: 1001, end: 2000 },
        { label: '2K–5K', start: 2001, end: 5000 },
        { label: '5K–10K', start: 5001, end: 10000 },
        { label: '10K–20K', start: 10001, end: 20000 },
        { label: '20K+', start: 20001, end: 100000 },
    ];

    els.profileBreakdown.innerHTML = '';
    for (const band of bands) {
        // Expected % known in this band
        let expKnown = 0;
        const midRank = (band.start + band.end) / 2;
        expKnown = expectedPKnow(midRank);

        const div = document.createElement('div');
        div.className = 'profile-band';
        div.innerHTML = `
            <div class="band-label">${band.label}</div>
            <div class="band-value">${(expKnown * 100).toFixed(0)}%</div>
        `;
        els.profileBreakdown.appendChild(div);
    }
}

function resetTest() {
    answers = [];
    askedRanks.clear();
    currentQuestionIndex = null;
    initPosterior();
    els.answerHistory.innerHTML = '';
    els.estimate.textContent = '—';
    els.credibleInterval.textContent = '—';
    els.questionCount.textContent = '0';
    document.getElementById('results').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    drawCurve();
    drawDistribution();
    nextQuestion();
}

// ─────────────────────────────────────────────────────────────
// KEYBOARD SUPPORT
// ─────────────────────────────────────────────────────────────

function handleKey(e) {
    if (document.getElementById('results').classList.contains('hidden') === false) return;
    if (document.getElementById('app').classList.contains('hidden')) return;

    switch (e.key) {
        case 'y': case 'Y': answer(1.0); break;
        case 'm': case 'M': answer(0.5); break;
        case 'n': case 'N': answer(0.0); break;
        case 's': case 'S': answer(null); break;
        case 'Enter': if (!isAutoAdvance) nextQuestion(); break;
    }
}

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────

init();
