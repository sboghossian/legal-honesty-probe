import type { GradedResult } from "./types.js";
import { type ReportInput, rankModels, verifierDelta, cellOf, VERIFIER_ON, VERIFIER_OFF } from "./ranking.js";

export type { ReportInput };

// Single Markdown comparison page. No styling tricks — paste into a memo verbatim.

function mark(g: GradedResult | undefined): string {
  if (!g || g.source === "error") return "·";
  if (g.score.value === 1) return "✅ 1.0";
  if (g.score.value === 0.5) return "🟡 0.5";
  return "❌ 0.0";
}

export function renderReport(input: ReportInput): string {
  const { date, traps } = input;
  const ranked = rankModels(input);
  const withData = ranked.filter((r) => r.mean !== null);
  const errored = ranked.length - withData.length;
  const L: string[] = [];

  L.push(`# Legal Honesty Probe — Comparison`);
  L.push("");
  L.push(`Run: ${date} · ${traps.length} traps · ${ranked.length} models (${withData.length} returned data, ${errored} errored) · deterministic rubric (no LLM judge)`);
  L.push("");

  // --- Leaderboard (vendor models, ranked) ---
  L.push(`## Leaderboard (mean honesty score, 0–1)`);
  L.push("");
  L.push(`| # | Model | ${traps.map((t) => t.id).join(" | ")} | **Mean** |`);
  L.push(`|---|---|${traps.map(() => "---").join("|")}|---|`);
  ranked.forEach((r, i) => {
    const cells = traps.map((t) => mark(cellOf(input, t.id, r.model)));
    const meanStr = r.mean === null ? `— (all ${r.errors} errored)` : r.mean.toFixed(2);
    L.push(`| ${i + 1} | \`${r.model}\` | ${cells.join(" | ")} | **${meanStr}** |`);
  });
  L.push("");

  // --- The verifier delta: the slide ---
  const vd = verifierDelta(input);
  if (vd) {
    L.push(`## The verifier delta`);
    L.push("");
    L.push(`Same base. Verifier OFF = raw passthrough. Verifier ON = cite-verifier guard. Deterministic, reproducible.`);
    L.push("");
    L.push(`| Mode | Mean honesty score |`);
    L.push(`|---|---|`);
    L.push(`| \`${VERIFIER_OFF}\` (raw) | **${vd.off.toFixed(2)}** |`);
    L.push(`| \`${VERIFIER_ON}\` (guarded) | **${vd.on.toFixed(2)}** |`);
    L.push(`| **Delta** | **${(vd.delta >= 0 ? "+" : "") + vd.delta.toFixed(2)}** |`);
    L.push("");
  }

  // --- Per-trap detail ---
  L.push(`## Per-trap detail`);
  L.push("");
  for (const t of traps) {
    L.push(`### ${t.id} — ${t.category}${t.origin === "civil-law" ? " · 🔒 civil-law (moat)" : ""}`);
    L.push("");
    L.push(`> ${t.prompt.replace(/\n/g, " ")}`);
    L.push("");
    L.push(`| Model | Score | Why | Source |`);
    L.push(`|---|---|---|---|`);
    for (const m of input.models) {
      const g = cellOf(input, t.id, m);
      if (!g) continue;
      const why = g.source === "error" ? `error: ${g.error ?? "unknown"}` : g.score.reason;
      L.push(`| \`${m}\` | ${mark(g)} | ${why} | ${g.source} |`);
    }
    L.push("");
  }

  L.push(`---`);
  L.push(`*Grading is deterministic: every score reproduces from (trap, captured text), no LLM judge. "·" = the model errored/timed out on that trap and is excluded from its mean. Model outputs are non-deterministic — live scores are a single run and vary run to run; the rubric does not.*`);
  L.push("");
  return L.join("\n");
}
