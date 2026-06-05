import type { GradedResult, Trap } from "./types.js";

export interface ReportInput {
  date: string;
  models: string[];
  traps: Trap[];
  /** results[trapId][model] = GradedResult */
  results: Map<string, Map<string, GradedResult>>;
}

export interface RankedModel {
  model: string;
  /** Mean over traps that returned data (errors excluded). null if all errored. */
  mean: number | null;
  valid: number;
  errors: number;
}

export const VERIFIER_ON = "haqq-verifier-on";
export const VERIFIER_OFF = "haqq-verifier-off";
const VERIFIER = new Set([VERIFIER_ON, VERIFIER_OFF]);

export function cellOf(input: ReportInput, trapId: string, model: string): GradedResult | undefined {
  return input.results.get(trapId)?.get(model);
}

export function meanOver(input: ReportInput, model: string): { mean: number | null; valid: number; errors: number } {
  const vals: number[] = [];
  let errors = 0;
  for (const t of input.traps) {
    const g = cellOf(input, t.id, model);
    if (!g || g.source === "error") errors++;
    else vals.push(g.score.value);
  }
  return { mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, valid: vals.length, errors };
}

/** Vendor models only (verifier rows excluded), ranked by mean desc; all-errored sink to the bottom. */
export function rankModels(input: ReportInput): RankedModel[] {
  return input.models
    .filter((m) => !VERIFIER.has(m))
    .map((model) => ({ model, ...meanOver(input, model) }))
    .sort((a, b) => {
      if (a.mean === null && b.mean === null) return a.model.localeCompare(b.model);
      if (a.mean === null) return 1;
      if (b.mean === null) return -1;
      // Coverage tier first: fully-tested models (no errored traps) rank above
      // any partial-coverage model, so a 1-of-15 "perfect" can't top a true 15/15.
      // Within a tier: mean desc, then completeness, then name.
      const aFull = a.errors === 0 ? 1 : 0;
      const bFull = b.errors === 0 ? 1 : 0;
      return bFull - aFull || b.mean - a.mean || b.valid - a.valid || a.model.localeCompare(b.model);
    });
}

export function verifierDelta(input: ReportInput): { off: number; on: number; delta: number } | null {
  if (!input.models.includes(VERIFIER_ON) || !input.models.includes(VERIFIER_OFF)) return null;
  const on = meanOver(input, VERIFIER_ON).mean ?? 0;
  const off = meanOver(input, VERIFIER_OFF).mean ?? 0;
  return { off, on, delta: on - off };
}
