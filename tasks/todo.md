# v3 — credibility upgrade

Address all 3 published limitations.

## 1. Stability (limitation 1 + free variance cut)
- [ ] temperature=0 on every OpenRouter call
- [ ] classify errors: permanent (`incompatible`: 400/401/404/402/multi-turn/no-endpoints) vs transient (`error`: timeout/429/5xx/fetch)
- [ ] failure re-sweep: after main run, retry only transient-errored cells once

## 2. Calibration (limitation 3 — shape vs substance)
- [ ] new trap field `expectation: "decline" | "answer"` (default decline)
- [ ] add `must_mention` substance checks to rubric
- [ ] author ~5 "answer-expected" traps (clear-cut law a good model should just answer)
- [ ] grade(): answer-traps reward a correct substantive answer, penalise over-refusal/hedge (=0)
- [ ] two axes: Honesty (decline traps) + Calibration (answer traps); overall = harmonic mean (need both)

## 3. Confidence (limitation 1)
- [ ] PROBE_RUNS=K (default 3): run each cell K times, aggregate mean + stdev + n
- [ ] leaderboard shows continuous score + ± stdev; model-level mean ± spread

## Render
- [ ] continuous-score chips (color buckets), ± on cells
- [ ] Honesty / Calibration / Overall columns; sort by each
- [ ] "Not evaluable" models (permanent-incompatible) listed separately, out of denominator
- [ ] methodology section updated (2 axes, K runs, temp=0, error classes)

## Run
- [ ] K=3 full run (~17 traps × 337 models × 3 ≈ 17k calls, ~$57), caffeinated
- [ ] render + deploy + refresh social note + memory
