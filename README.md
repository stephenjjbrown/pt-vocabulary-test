# Portuguese Vocabulary Estimator

Estimates how many Portuguese words you know, by asking whether you recognise
words sampled from a frequency-ranked corpus.

Each of eight frequency buckets maintains a tally of yes / maybe / no answers.
The point estimate for a bucket is the plain ratio of yes-equivalents to
answers; the uncertainty is a Wilson score 95% confidence interval. Questions
are drawn from whichever bucket currently has the widest confidence interval,
so effort goes where the estimate is least certain.

## Requirements

- **Node.js 22.5 or newer.** The server uses the built-in `node:sqlite` module,
  and the server runs TypeScript directly via Node's type stripping. Both
  require a recent Node.

## Getting the corpus

The word frequencies come from the AC/DC project at Linguateca:

<https://www.linguateca.pt/acesso/info_freq_English.php>

Download the **"all"** lemma frequency list *by part of speech* from that page
(the 60.0 Mb one under "all / all/pos") and save it as:

```
raw/lemapos.total.txt
```

The file is **Latin-1 encoded, not UTF-8**. Reading it as UTF-8 mangles every
accented character (`não` becomes `no`), which is why `preprocess.cjs` opens it
with `'latin1'`.

### Licence

The corpus files are **not redistributed with this repository**. They are
derived from corpora whose rights belong to their original publishers, and
Linguateca states that terms differ from resource to resource, are set by each
rights holder, and are specified in each resource's own documentation. The
frequency-list page itself carries no licence granting redistribution. Obtain
the files from the source above and observe whatever terms apply to you.

Linguateca's own tools are GPL-licensed; that does not extend to the corpus data.

## Running it

```sh
npm install
npm run preprocess   # raw corpus -> data/words.db
npm run dev          # server on :3001, Vite on :5173
```

Open <http://localhost:5173>.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Express API on :3001 and Vite on :5173, together |
| `npm start` | Express only, serving the built `dist/` as well as the API |
| `npm run preprocess` | Rebuild `data/words.db` from `raw/lemapos.total.txt` |
| `npm run build` | Type check, then bundle to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## Architecture

Three layers, with state and the operations on it living together:

- **`src/data/`** — the data-access layer. `fetchWords()` talks to
  `GET /api/words` and returns plain word data. Models never do I/O.
- **`src/models/`** — the application state, and the methods that change it.
  `App` is a singleton holding signals for the corpus, the tallies, the
  history and the current word, and exposing `begin()`, `answer()`, `reset()`.
  `Bucket` and `Word` are its constituents; `Bucket.record()` owns the rules
  for how a response changes a tally.
- **`src/elements/`** — Lit components. They read the model's signals and call
  methods on it; they never mutate state themselves. Shadow DOM is disabled so
  the global stylesheet applies. Each element subscribes to the signals it
  renders in `connectedCallback` and disposes those subscriptions in
  `disconnectedCallback`.

Reactivity uses `@preact/signals-core`. A model change notifies only the
effects that actually read the changed signal.

## Data pipeline

`data/preprocess.cjs` reads the corpus and writes SQLite:

1. Read as Latin-1.
2. Split each line into `frequency<TAB>word (POS)`.
3. Drop lines tagged `PROP` (proper nouns), `PU` / `PUNC` (punctuation) and
   `NUM` (numerals). Proper-noun counts in this corpus are divided by name
   length, so they are not comparable to single-word frequencies.
4. Drop anything that is not a word-shaped token.
5. Lowercase, merge duplicates across POS variants, sum frequencies.
6. Sort by frequency descending and write `data/words.db` with a `rank` per row.

The server exposes `GET /api/words?maxRank=N`, returning the top N words.

## Statistics

`src/stats.ts` holds the maths, as pure functions with no DOM dependency:

- Point estimate: `(yes + 0.5 × maybe) / (yes + maybe + no)`.
- Interval: Wilson score, 95%.
- Total vocabulary: sum over buckets of `estimate × bucketWidth`.
- Total interval: the per-bucket intervals scaled by bucket width and summed.

Skips do not count toward the sample size. They only remove the word from the
pool so it is not shown again.

## Tests

Tests run under [Vitest](https://vitest.dev), which transforms through Vite
the same way the app is built. That means test files are ordinary TypeScript
with `.ts` import specifiers, and any construct Vite can compile is available
— unlike Node's strip-only TypeScript loader, which the server and any
Node-executed code are limited to.

`vitest.config.ts` is separate from `vite.config.ts` so the build-only
`vite-plugin-checker` does not run during tests.

Coverage today:

- `Bucket` tallying: each response type increments the right counter, a skip
  is not counted as an answer, and `reset()` clears everything.
- The point estimate at the all-yes boundary, and that bucket size does not
  affect the interval.
- Wilson score (with and without continuity correction) against
  Clopper–Pearson, side by side.
