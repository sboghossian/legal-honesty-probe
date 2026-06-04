import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadTraps } from "./loadTraps.js";
import { grade, gradeAll } from "./rubric.js";
import { renderReport } from "./report.js";
import { renderHtml } from "./reportHtml.js";
import { fixtureAdapter } from "./adapters/fixture.js";
import { claudeAdapter } from "./adapters/claude.js";
import { openrouterAdapter } from "./adapters/openrouter.js";
import { haqqAdapter } from "./adapters/haqq.js";
import { fetchChatModels } from "./openrouterModels.js";
import { mapLimit } from "./pool.js";
import { log } from "./log.js";
import type { Adapter, GradedResult, Trap } from "./types.js";

// Repo root = parent of dist/ (or src/ under tsx). Resolve from this file.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CONCURRENCY = Number(process.env.PROBE_CONCURRENCY ?? 16);

/** Curated 5-model line-up (default mode). Live adapters engage only when their key is present. */
function buildCuratedAdapters(): Adapter[] {
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const opusSlug = process.env.OPENROUTER_OPUS_MODEL ?? "anthropic/claude-opus-4.8";
  const opus = hasAnthropic
    ? claudeAdapter()
    : process.env.OPENROUTER_API_KEY
      ? openrouterAdapter("claude-opus-4-8", opusSlug, ROOT)
      : fixtureAdapter("claude-opus-4-8", ROOT);
  if (hasAnthropic) log.step("claude-opus-4-8 live via Anthropic SDK");
  else if (process.env.OPENROUTER_API_KEY) log.step(`claude-opus-4-8 live via OpenRouter (${opusSlug})`);
  else log.warn("no Anthropic/OpenRouter key — claude-opus-4-8 served from fixtures");

  const gptSlug = process.env.OPENROUTER_GPT_MODEL ?? "openai/gpt-5.5";
  const geminiSlug = process.env.OPENROUTER_GEMINI_MODEL ?? "google/gemini-3.1-pro";
  if (!process.env.OPENROUTER_API_KEY) log.warn("OPENROUTER_API_KEY missing — gpt / gemini served from fixtures");
  else log.step(`OpenRouter live: ${gptSlug}, ${geminiSlug}`);

  return [
    opus,
    openrouterAdapter("gpt-5.5", gptSlug, ROOT),
    openrouterAdapter("gemini-3.1-pro", geminiSlug, ROOT),
    haqqAdapter("off", ROOT),
    haqqAdapter("on", ROOT),
  ];
}

/** ALL_MODELS mode: one adapter per text-chat model on OpenRouter, plus the verifier rows. */
async function buildAllModelAdapters(): Promise<Adapter[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    log.error("ALL_MODELS requires OPENROUTER_API_KEY");
    process.exit(1);
  }
  let models = await fetchChatModels(key);
  const limit = process.env.MODELS_LIMIT ? Number(process.env.MODELS_LIMIT) : 0;
  if (limit > 0) models = models.slice(0, limit);
  log.info(`ALL_MODELS: ${models.length} text-chat models from OpenRouter (concurrency ${CONCURRENCY})`);
  const vendor = models.map((m) => openrouterAdapter(m.id, m.id, ROOT));
  // Keep the verifier delta rows — the moat slide — alongside the full field.
  return [...vendor, haqqAdapter("off", ROOT), haqqAdapter("on", ROOT)];
}

async function main(): Promise<void> {
  const traps = loadTraps(ROOT);
  if (traps.length === 0) {
    log.error("no traps found in traps/ or traps-civil/");
    process.exit(1);
  }

  const allModels = Boolean(process.env.ALL_MODELS);
  const adapters = allModels ? await buildAllModelAdapters() : buildCuratedAdapters();
  log.info(`Probing ${adapters.length} models against ${traps.length} traps...`);

  const results = new Map<string, Map<string, GradedResult>>();
  for (const trap of traps) results.set(trap.id, new Map());

  if (allModels) {
    // Flatten to (trap, adapter) tasks and run through a concurrency pool so we
    // don't fire thousands of requests at once. Per-call errors are already
    // captured inside the adapter (source: "error"), so the pool never rejects.
    const tasks: { trap: Trap; adapter: Adapter }[] = [];
    for (const trap of traps) for (const adapter of adapters) tasks.push({ trap, adapter });
    let done = 0;
    const total = tasks.length;
    await mapLimit(tasks, CONCURRENCY, async ({ trap, adapter }) => {
      const res = await adapter.answer(trap);
      results.get(trap.id)!.set(adapter.name, { ...res, category: trap.category, score: grade(trap, res) });
      done++;
      if (done % 100 === 0 || done === total) log.step(`${done}/${total} calls graded`);
    });
  } else {
    for (const trap of traps) {
      const responses = await Promise.all(adapters.map((a) => a.answer(trap)));
      for (const g of gradeAll(trap, responses)) results.get(trap.id)!.set(g.model, g);
      log.step(`${trap.id} (${trap.category}) graded`);
    }
  }

  const date = process.env.PROBE_DATE ?? new Date().toISOString().slice(0, 10);
  const reportInput = { date, models: adapters.map((a) => a.name), traps, results };
  const outDir = join(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "comparison.md"), renderReport(reportInput), "utf8");
  writeFileSync(join(outDir, "index.html"), renderHtml(reportInput), "utf8");
  // Machine-readable dump so anyone can re-analyze the full field.
  const json = {
    date,
    traps: traps.map((t) => ({ id: t.id, category: t.category, origin: t.origin })),
    results: adapters.map((a) => ({
      model: a.name,
      scores: traps.map((t) => {
        const g = results.get(t.id)!.get(a.name);
        return { trap: t.id, value: g?.score.value ?? null, source: g?.source ?? null, error: g?.error };
      }),
    })),
  };
  writeFileSync(join(outDir, "results.json"), JSON.stringify(json, null, 2), "utf8");
  log.info(`\nWrote ${join(outDir, "comparison.md")} + index.html + results.json`);
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
