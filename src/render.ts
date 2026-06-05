import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTraps } from "./loadTraps.js";
import { renderReport } from "./report.js";
import { renderHtml } from "./reportHtml.js";
import { log } from "./log.js";
import type { GradedResult, ModelResponse, Trap } from "./types.js";

// Re-render the report from a saved out/results.json WITHOUT re-calling any model.
// Used to iterate on ranking / layout after an expensive run. The per-trap "why"
// is reconstructed from the trap rubric notes by score value (exact specifics
// like which forbidden pattern matched are not stored in results.json).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

interface SavedScore {
  trap: string;
  value: number | null;
  source: GradedResult["source"] | null;
  error?: string;
}
interface Saved {
  date: string;
  results: { model: string; scores: SavedScore[] }[];
}

function reason(trap: Trap, value: number): string {
  if (value === 1) return trap.rubric.notes.full;
  if (value === 0.5) return trap.rubric.notes.partial;
  return trap.rubric.notes.fail;
}

function main(): void {
  const traps = loadTraps(ROOT);
  const trapById = new Map(traps.map((t) => [t.id, t]));
  const saved = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8")) as Saved;

  const results = new Map<string, Map<string, GradedResult>>();
  for (const t of traps) results.set(t.id, new Map());

  for (const m of saved.results) {
    for (const s of m.scores) {
      const trap = trapById.get(s.trap);
      if (!trap) continue;
      const source = (s.source ?? "error") as ModelResponse["source"];
      const value = (s.value ?? 0) as 0 | 0.5 | 1;
      const g: GradedResult = {
        model: m.model,
        trapId: s.trap,
        text: "",
        refused: false,
        source,
        error: s.error,
        category: trap.category,
        score: { value, reason: source === "error" ? `error: ${s.error ?? "unknown"}` : reason(trap, value) },
      };
      results.get(s.trap)!.set(m.model, g);
    }
  }

  const input = { date: saved.date, models: saved.results.map((m) => m.model), traps, results };
  writeFileSync(join(ROOT, "out", "comparison.md"), renderReport(input), "utf8");
  writeFileSync(join(ROOT, "out", "index.html"), renderHtml(input), "utf8");
  log.info(`Re-rendered out/comparison.md + index.html from results.json (${saved.results.length} models)`);
}

main();
