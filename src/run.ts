import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadTraps } from "./loadTraps.js";
import { gradeAll, gradeRuns } from "./rubric.js";
import { renderReport } from "./report.js";
import { renderHtml } from "./reportHtml.js";
import { fixtureAdapter } from "./adapters/fixture.js";
import { claudeAdapter } from "./adapters/claude.js";
import { openrouterAdapter } from "./adapters/openrouter.js";
import { haqqAdapter } from "./adapters/haqq.js";
import { fetchChatModels, fetchBalance } from "./openrouterModels.js";
import { mapLimit } from "./pool.js";
import { log } from "./log.js";
import type { Adapter, GradedResult, Trap } from "./types.js";

/** Preload completed (non-error) cells from a prior out/results.json for --resume. */
function loadCheckpoint(root: string, traps: Trap[], results: Map<string, Map<string, GradedResult>>): number {
  const path = join(root, "out", "results.json");
  if (!existsSync(path)) return 0;
  const saved = JSON.parse(readFileSync(path, "utf8")) as {
    runs?: number;
    results: { model: string; scores: { trap: string; value: number | null; std?: number; source?: string; error?: string }[] }[];
  };
  const runs = saved.runs ?? 1;
  const trapById = new Map(traps.map((t) => [t.id, t]));
  let n = 0;
  for (const m of saved.results) {
    for (const s of m.scores) {
      const trap = trapById.get(s.trap);
      if (!trap || s.value === null || s.source === "error" || s.source === "incompatible" || s.source == null) continue;
      const mean = s.value;
      const nearest = (Math.round(mean * 2) / 2) as 0 | 0.5 | 1;
      results.get(s.trap)!.set(m.model, {
        model: m.model, trapId: s.trap, text: "", refused: false,
        source: s.source as GradedResult["source"], category: trap.category, expectation: trap.expectation,
        score: { value: nearest, reason: "resumed" },
        ...(runs > 1 ? { agg: { mean, std: s.std ?? 0, runs } } : {}),
      });
      n++;
    }
  }
  return n;
}

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
  // Preflight: don't start a paid run on an empty account.
  const balance = await fetchBalance(key);
  if (balance !== null) {
    log.info(`OpenRouter balance: $${balance.toFixed(2)}`);
    if (balance <= 0 && !process.env.PROBE_FORCE) {
      log.error(`balance is $${balance.toFixed(2)} — top up before an ALL_MODELS run (or set PROBE_FORCE=1). Aborting.`);
      process.exit(1);
    }
    if (balance < 20) log.warn(`balance $${balance.toFixed(2)} may not cover a full multi-run sweep (~$22/run × PROBE_RUNS). It will checkpoint; resume with PROBE_RESUME=1 after topping up.`);
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

  const date = process.env.PROBE_DATE ?? new Date().toISOString().slice(0, 10);
  const outDir = join(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  const K = Math.max(1, Number(process.env.PROBE_RUNS ?? 1));

  const buildJson = (): unknown => ({
    date,
    traps: traps.map((t) => ({ id: t.id, category: t.category, origin: t.origin })),
    runs: K,
    results: adapters.map((a) => ({
      model: a.name,
      scores: traps.map((t) => {
        const g = results.get(t.id)!.get(a.name);
        return { trap: t.id, value: g?.agg ? g.agg.mean : g?.score.value ?? null, std: g?.agg?.std ?? 0, source: g?.source ?? null, error: g?.error };
      }),
    })),
  });
  const saveJson = (): void => writeFileSync(join(outDir, "results.json"), JSON.stringify(buildJson(), null, 2), "utf8");
  const isCreditError = (g: GradedResult | undefined): boolean => /insufficient credits|\b402\b/i.test(g?.error ?? "");

  if (allModels) {
    log.info(`PROBE_RUNS=${K} (each cell averaged over ${K} run${K > 1 ? "s" : ""}, temperature 0)`);
    if (process.env.PROBE_RESUME) log.info(`Resume: preloaded ${loadCheckpoint(ROOT, traps, results)} completed cells (skipped)`);

    let aborted = false;
    const runCell = async (trap: Trap, adapter: Adapter): Promise<void> => {
      const have = results.get(trap.id)!.get(adapter.name);
      if (have && have.source !== "error" && have.source !== "incompatible") return; // already done (resume)
      const runs = [];
      for (let k = 0; k < K; k++) runs.push(await adapter.answer(trap));
      const g = gradeRuns(trap, runs);
      results.get(trap.id)!.set(adapter.name, g);
      if (isCreditError(g)) aborted = true;
    };

    const tasks: { trap: Trap; adapter: Adapter }[] = [];
    for (const trap of traps) for (const adapter of adapters) tasks.push({ trap, adapter });
    let done = 0;
    const total = tasks.length;
    await mapLimit(tasks, CONCURRENCY, async ({ trap, adapter }) => {
      if (aborted) return;
      await runCell(trap, adapter);
      done++;
      if (done % 100 === 0 || done === total) { log.step(`${done}/${total} cells graded`); saveJson(); }
    });

    if (aborted) {
      log.error("ABORTED: account out of credits (402). Top up, then re-run with PROBE_RESUME=1 to continue without re-paying for completed cells.");
      saveJson();
    } else {
      const sweep = tasks.filter(({ trap, adapter }) => results.get(trap.id)!.get(adapter.name)?.source === "error");
      if (sweep.length) {
        log.info(`Re-sweeping ${sweep.length} transient-errored cells...`);
        await mapLimit(sweep, CONCURRENCY, async ({ trap, adapter }) => {
          if (aborted) return;
          const prev = results.get(trap.id)!.get(adapter.name);
          const runs = [];
          for (let k = 0; k < K; k++) runs.push(await adapter.answer(trap));
          const g = gradeRuns(trap, runs);
          if (g.source !== "error" || prev?.source === "error") results.get(trap.id)!.set(adapter.name, g);
          if (isCreditError(g)) aborted = true;
        });
      }
    }
  } else {
    for (const trap of traps) {
      const responses = await Promise.all(adapters.map((a) => a.answer(trap)));
      for (const g of gradeAll(trap, responses)) results.get(trap.id)!.set(g.model, g);
      log.step(`${trap.id} (${trap.category}) graded`);
    }
  }

  const reportInput = { date, models: adapters.map((a) => a.name), traps, results };
  writeFileSync(join(outDir, "comparison.md"), renderReport(reportInput), "utf8");
  writeFileSync(join(outDir, "index.html"), renderHtml(reportInput), "utf8");
  saveJson();
  log.info(`\nWrote ${join(outDir, "comparison.md")} + index.html + results.json`);
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
