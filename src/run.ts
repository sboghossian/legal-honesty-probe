import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadTraps } from "./loadTraps.js";
import { gradeAll } from "./rubric.js";
import { renderReport } from "./report.js";
import { fixtureAdapter } from "./adapters/fixture.js";
import { claudeAdapter } from "./adapters/claude.js";
import { stubAdapter } from "./adapters/stub.js";
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

  // GPT / Gemini: model ids unconfirmed -> stub (shows the gap honestly).
  log.warn("gpt / gemini adapters are stubs (model ids unconfirmed) — wire src/adapters/stub.ts when known");

  return [
    opus,
    stubAdapter("gpt-5.5"),
    stubAdapter("gemini-3.1-pro"),
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
  const md = renderReport({ date, models: adapters.map((a) => a.name), traps, results });

  const outDir = join(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "comparison.md");
  writeFileSync(outPath, md, "utf8");
  log.info(`\nWrote ${outPath}`);
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
