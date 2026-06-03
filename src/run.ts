import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadTraps } from "./loadTraps.js";
import { gradeAll } from "./rubric.js";
import { renderReport } from "./report.js";
import { renderHtml } from "./reportHtml.js";
import { fixtureAdapter } from "./adapters/fixture.js";
import { claudeAdapter } from "./adapters/claude.js";
import { openrouterAdapter } from "./adapters/openrouter.js";
import { haqqAdapter } from "./adapters/haqq.js";
import { log } from "./log.js";
import type { Adapter, GradedResult } from "./types.js";

// Repo root = parent of dist/ (or src/ under tsx). Resolve from this file.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Build the model line-up. Live adapters engage only when their key is present. */
function buildAdapters(): Adapter[] {
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  // Opus: live if key present, else recorded fixture under fixtures/claude-opus-4-8/.
  const opus = hasAnthropic ? claudeAdapter() : fixtureAdapter("claude-opus-4-8", ROOT);
  if (!hasAnthropic) log.warn("ANTHROPIC_API_KEY missing — claude-opus-4-8 served from fixtures");

  // GPT / Gemini via OpenRouter. Slugs are env-overridable so unconfirmed ids
  // never get baked in. Live when OPENROUTER_API_KEY is set, else fixture fallback.
  const gptSlug = process.env.OPENROUTER_GPT_MODEL ?? "openai/gpt-5.5";
  const geminiSlug = process.env.OPENROUTER_GEMINI_MODEL ?? "google/gemini-3.1-pro";
  if (!process.env.OPENROUTER_API_KEY) {
    log.warn("OPENROUTER_API_KEY missing — gpt / gemini served from fixtures (likely 'no response')");
  } else {
    log.step(`OpenRouter live: ${gptSlug}, ${geminiSlug} (override via OPENROUTER_GPT_MODEL / OPENROUTER_GEMINI_MODEL)`);
  }

  return [
    opus,
    openrouterAdapter("gpt-5.5", gptSlug, ROOT),
    openrouterAdapter("gemini-3.1-pro", geminiSlug, ROOT),
    haqqAdapter("off", ROOT),
    haqqAdapter("on", ROOT),
  ];
}

async function main(): Promise<void> {
  const traps = loadTraps(ROOT);
  if (traps.length === 0) {
    log.error("no traps found in traps/ or traps-civil/");
    process.exit(1);
  }
  const adapters = buildAdapters();
  log.info(`Probing ${adapters.length} models against ${traps.length} traps...`);

  const results = new Map<string, Map<string, GradedResult>>();
  for (const trap of traps) {
    const responses = await Promise.all(adapters.map((a) => a.answer(trap)));
    const graded = gradeAll(trap, responses);
    const byModel = new Map<string, GradedResult>();
    for (const g of graded) byModel.set(g.model, g);
    results.set(trap.id, byModel);
    log.step(`${trap.id} (${trap.category}) graded`);
  }

  // Date is passed in / read from env so the runner stays deterministic-friendly.
  const date = process.env.PROBE_DATE ?? new Date().toISOString().slice(0, 10);
  const reportInput = { date, models: adapters.map((a) => a.name), traps, results };
  const outDir = join(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "comparison.md"), renderReport(reportInput), "utf8");
  writeFileSync(join(outDir, "index.html"), renderHtml(reportInput), "utf8");
  log.info(`\nWrote ${join(outDir, "comparison.md")} + index.html`);
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
