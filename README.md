# legal-honesty-probe

Calibrated honesty traps for legal LLMs. Same prompt → every model → a deterministic rubric → one Markdown comparison page. No LLM judge: the rubric is the artifact.

The point: when a procurement officer asks *"show me what your stack returns when the model is wrong on a legal hypothetical,"* you answer with a probe + rubric + comparison page, not a slide.

## Why now

Three things landed in legal AI inside 48 hours (verified 2026-06-03). Together they make that procurement question unavoidable:

- Claude Opus 4.8 — billed "most honest yet" — broke on a legal honesty trap under a published 10-trap methodology. [[LinuxConsultant]](https://www.linuxconsultant.org/i-set-10-honesty-traps-for-claude-opus-4-8-and-a-legal-test-broke-it/) · [[TechBuzz]](https://www.techbuzz.ai/articles/claude-opus-4-8-fails-legal-honesty-test-in-new-benchmark)
- OpenAI hired Ironclad founder Jason Boehmig to lead its legal vertical. [[Artificial Lawyer]](https://www.artificiallawyer.com/2026/06/01/ironclad-founder-jason-boehmig-joins-openai-for-legal-vertical-launch/)
- Anthropic expanded Mythos to ~150 critical-infrastructure orgs across 15+ countries. [[Cybersecurity Dive]](https://www.cybersecuritydive.com/news/ai-anthropic-claude-mythos-project-glasswing-expand/821714/)

## What it does

1. Sends the **same prompt** to every configured model.
2. Captures the response structurally.
3. Scores it **offline** against a per-trap rubric (`0 / 0.5 / 1`) — pure string/regex checks, fully reproducible.
4. Renders `out/comparison.md`: a scoreboard, a **verifier ON/OFF delta**, and per-trap detail with the reason for every score.

The models row includes a HAQQ-routed flow in two modes — **verifier OFF** (raw model passthrough) and **verifier ON** (the cite-verifier guard). The delta between those two rows is the slide.

## Trap categories

`cite-pinning` · `jurisdiction-pinning` · `scope-limit` · `hedge-on-uncertain` · `refuse-on-conflict`

Each trap is one JSON file: a prompt, an expected shape (`must_refuse`, `forbidden_patterns`, `expected_markers`), and graded notes for `1 / 0.5 / 0`.

## Run it

```bash
npm install
npm run probe        # build + run → out/comparison.md
npm test             # rubric + verifier tests
```

No API keys required. With no keys, model rows are served from recorded **fixtures** under `fixtures/<model>/<trapId>.txt` so the page renders and the rubric is testable today.

To run live:

```bash
export OPENROUTER_API_KEY=...    # one key runs all three: gpt-5.5, gemini-3.1-pro, opus-4.8
# slugs verified working 2026-06-03 (override if a default 404s):
export OPENROUTER_GPT_MODEL=openai/gpt-5.5
export OPENROUTER_GEMINI_MODEL=google/gemini-3.1-pro-preview
export OPENROUTER_OPUS_MODEL=anthropic/claude-opus-4.8
export ANTHROPIC_API_KEY=...     # optional: run Opus via the native Anthropic SDK instead
npm run probe
```

Each adapter uses its key if present and falls back to fixtures otherwise — so you can run any subset live. Opus prefers `ANTHROPIC_API_KEY` (native SDK); if that's absent but `OPENROUTER_API_KEY` is set, it routes through OpenRouter.

## Status / honesty notes

- **`claude-opus-4-8` / `gpt-5.5` / `gemini-3.1-pro`** run live via **OpenRouter** (or the native Anthropic SDK for Opus). Slugs are env-overridable so an unconfirmed id is never hardcoded into a 404. With no key they fall back to fixtures, or report "no response captured" rather than fabricate a row.
- **The HAQQ verifier** here is a transparent, deterministic guard layer (`src/verifier.ts`) standing in for the production cite-verifier: it withholds unverifiable citations and mandates a hedge/scope-lock. Same idea, fully auditable. Its ON/OFF rows apply this guard over a recorded base, so the delta is reproducible.
- **Model outputs are non-deterministic.** Live vendor scores reflect a single run and vary run to run; the rubric does not. For a procurement-grade number, average several runs.

## License & moat

The harness is **MIT**. The calibrated **civil-law trap pack** (KSA / Lebanon / UAE / Egypt) lives in `traps-civil/` and is **git-ignored** — it is the HAQQ moat and does not ship publicly. The public repo ships only the generic `traps/`.

Own the verifier, not the model.
