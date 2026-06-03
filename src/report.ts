import type { GradedResult, Trap } from "./types.js";

// Single Markdown comparison page. No styling tricks — procurement officers
// paste this into a memo verbatim.

function mark(v: number): string {
  if (v === 1) return "✅ 1.0";
  if (v === 0.5) return "🟡 0.5";
  return "❌ 0.0";
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export interface ReportInput {
  date: string;
  models: string[];
  traps: Trap[];
  /** results[trapId][model] = GradedResult */
  results: Map<string, Map<string, GradedResult>>;
}

export function renderReport(input: ReportInput): string {
  const { date, models, traps, results } = input;
  const L: string[] = [];

  L.push(`# Legal Honesty Probe — Comparison`);
  L.push("");
  L.push(`Run: ${date} · ${traps.length} traps · ${models.length} models · deterministic rubric (no LLM judge)`);
  L.push("");

  // --- Scoreboard ---
  L.push(`## Scoreboard (mean honesty score, 0–1)`);
  L.push("");
  L.push(`| Model | ${traps.map((t) => t.id).join(" | ")} | **Mean** |`);
  L.push(`|---|${traps.map(() => "---").join("|")}|---|`);
  for (const m of models) {
    const cells = traps.map((t) => mark(results.get(t.id)?.get(m)?.score.value ?? 0));
    const mean = avg(traps.map((t) => results.get(t.id)?.get(m)?.score.value ?? 0));
    L.push(`| \`${m}\` | ${cells.join(" | ")} | **${mean.toFixed(2)}** |`);
  }
  L.push("");

  // --- The verifier delta: the slide ---
  const on = "haqq-verifier-on";
  const off = "haqq-verifier-off";
  if (models.includes(on) && models.includes(off)) {
    const onMean = avg(traps.map((t) => results.get(t.id)?.get(on)?.score.value ?? 0));
    const offMean = avg(traps.map((t) => results.get(t.id)?.get(off)?.score.value ?? 0));
    L.push(`## The verifier delta`);
    L.push("");
    L.push(`Same base model. Verifier OFF = raw passthrough. Verifier ON = cite-verifier guard.`);
    L.push("");
    L.push(`| Mode | Mean honesty score |`);
    L.push(`|---|---|`);
    L.push(`| \`${off}\` (raw) | **${offMean.toFixed(2)}** |`);
    L.push(`| \`${on}\` (guarded) | **${onMean.toFixed(2)}** |`);
    L.push(`| **Delta** | **${(onMean - offMean >= 0 ? "+" : "") + (onMean - offMean).toFixed(2)}** |`);
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
    for (const m of models) {
      const g = results.get(t.id)?.get(m);
      if (!g) continue;
      L.push(`| \`${m}\` | ${mark(g.score.value)} | ${g.score.reason} | ${g.source} |`);
    }
    L.push("");
  }

  L.push(`---`);
  L.push(`*Rubric is deterministic: every score is reproducible from (trap, captured text). "stub" = adapter not wired (model id unconfirmed). "fixture" = recorded response, no live key this run.*`);
  L.push("");
  return L.join("\n");
}
