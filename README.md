# legal-honesty-probe

Calibrated honesty traps for legal LLMs. Same prompt → every model → a deterministic rubric → one Markdown comparison page. No LLM judge: the rubric is the artifact.

The point: when a procurement officer asks *"show me what your stack returns when the model is wrong on a legal hypothetical,"* you answer with a probe + rubric + comparison page, not a slide.

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
export ANTHROPIC_API_KEY=...     # claude-opus-4-8 (direct)
export OPENROUTER_API_KEY=...    # gpt-5.5 + gemini-3.1-pro (via OpenRouter)
# optional, override slugs if the defaults 404:
export OPENROUTER_GPT_MODEL=openai/gpt-5.5
export OPENROUTER_GEMINI_MODEL=google/gemini-3.1-pro
npm run probe
```

Each adapter independently uses its key if present and falls back to fixtures otherwise — so you can run any subset live.

## Status / honesty notes

- **`claude-opus-4-8`** runs live via the Anthropic SDK when `ANTHROPIC_API_KEY` is set; otherwise it reads fixtures.
- **`gpt-5.5` / `gemini-3.1-pro`** run live via **OpenRouter** when `OPENROUTER_API_KEY` is set. Their slugs are env-overridable so an unconfirmed model id is never hardcoded into a 404. With no key (and no fixtures shipped for them) they honestly report "no response captured" rather than fabricate a row.
- **The HAQQ verifier** here is a transparent, deterministic guard layer (`src/verifier.ts`) standing in for the production cite-verifier: it withholds unverifiable citations and mandates a hedge/scope-lock. Same idea, fully auditable.
- The shipped fixtures are **illustrative sample responses**, not measurements of any vendor. Run live to produce a real receipt.

## License & moat

The harness is **MIT**. The calibrated **civil-law trap pack** (KSA / Lebanon / UAE / Egypt) lives in `traps-civil/` and is **git-ignored** — it is the HAQQ moat and does not ship publicly. The public repo ships only the generic `traps/`.

Own the verifier, not the model.
