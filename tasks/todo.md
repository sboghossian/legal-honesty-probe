# legal-honesty-probe — build plan

MIT honesty-trap harness for legal LLMs. Same prompt → every model → offline rubric → one Markdown comparison page. Verifier ON/OFF delta is the slide.

## Decisions (locked 2026-06-03)
- New MIT repo (not a fork of haqq-lab). Harness public; civil-law trap pack is the HAQQ moat (gitignored).
- v0 = harness + offline fixtures. Renders today with zero keys. Live mode auto-engages when keys present.
- Adapters: `claude-opus-4-8` real; `openai`/`gemini` stubbed with TODO-ID guards; `haqq` = verifier ON/OFF.
- Rubric is deterministic (no LLM judge). 0 / 0.5 / 1, data-driven from each trap JSON.

## Tasks
- [x] Scaffold repo
- [x] package.json + tsconfig (strict) + .gitignore (moat) + LICENSE (MIT)
- [x] types.ts — Trap, Response, Score, Adapter
- [x] rubric.ts — deterministic grader (+ empty-response guard)
- [x] loadTraps.ts — read traps/ + traps-civil/
- [x] adapters: fixture, claude (real), stub (gpt/gemini), haqq(ON/OFF) + verifier.ts
- [x] run.ts — CLI: same prompt → models → grade → write report
- [x] report.ts — scoreboard + verifier delta + per-trap detail
- [x] 5 public generic traps
- [x] 4 civil-law moat traps (gitignored)
- [x] fixtures so comparison.md renders today (civil fixtures gitignored too)
- [x] tests (7 passing) — rubric fatal/empty/refuse + verifier recovery + determinism
- [x] README (honest), build clean, run clean (verifier delta +0.78)
- [x] initial commit

## Result
- `npm run probe` → out/comparison.md, zero keys. Verifier OFF 0.22 → ON 1.00 (+0.78).
- Live mode: set ANTHROPIC_API_KEY for real claude-opus-4-8.

## Next (deferred, needs your input)
- Confirm gpt-5.5 / gemini-3.1-pro model IDs + keys → wire stub.ts.
- Decide HTML scorecard (haqq-lab style) vs markdown-only.
- Decide public GitHub remote (ask before creating).

## Open / unverified
- News premise (ZDNet test, Mythos 150, OpenAI/Ironclad) NOT verified — cutoff Jan 2026.
- gpt-5.5 / gemini-3.1-pro model IDs unconfirmed → adapters stubbed.
