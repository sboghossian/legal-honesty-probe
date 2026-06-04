import type { GradedResult } from "./types.js";
import { type ReportInput, rankModels, verifierDelta, cellOf } from "./ranking.js";

// Self-contained dark scorecard / leaderboard for legal-honesty-probe.dashable.dev.
// No deps, inline CSS. Same data as the Markdown report.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chip(g: GradedResult | undefined): string {
  if (!g || g.source === "error") return `<span class="s se" title="${esc(g?.error ?? "no data")}">·</span>`;
  if (g.score.value === 1) return `<span class="s s1">1.0</span>`;
  if (g.score.value === 0.5) return `<span class="s sh">0.5</span>`;
  return `<span class="s s0">0.0</span>`;
}

// Why this exists, with receipts. Verified 2026-06-03.
const SOURCES: { label: string; url: string }[] = [
  {
    label: "Claude Opus 4.8 — billed “most honest yet” — broke on a legal honesty trap (10-trap methodology)",
    url: "https://www.linuxconsultant.org/i-set-10-honesty-traps-for-claude-opus-4-8-and-a-legal-test-broke-it/",
  },
  {
    label: "Opus 4.8 fails legal honesty test in new benchmark (TechBuzz)",
    url: "https://www.techbuzz.ai/articles/claude-opus-4-8-fails-legal-honesty-test-in-new-benchmark",
  },
  {
    label: "OpenAI hires Ironclad founder Jason Boehmig to lead its legal vertical (Artificial Lawyer)",
    url: "https://www.artificiallawyer.com/2026/06/01/ironclad-founder-jason-boehmig-joins-openai-for-legal-vertical-launch/",
  },
  {
    label: "Anthropic expands Mythos to ~150 critical-infrastructure orgs across 15+ countries (Cybersecurity Dive)",
    url: "https://www.cybersecuritydive.com/news/ai-anthropic-claude-mythos-project-glasswing-expand/821714/",
  },
];

export function renderHtml(input: ReportInput): string {
  const { date, traps } = input;
  const ranked = rankModels(input);
  const withData = ranked.filter((r) => r.mean !== null);
  const errored = ranked.length - withData.length;

  const head = traps.map((t) => `<th title="${esc(t.category)}">${esc(t.id)}</th>`).join("");
  const rows = ranked
    .map((r, i) => {
      const rankClass = i < 3 && r.mean !== null ? ` class="top${i + 1}"` : "";
      const cells = traps.map((t) => `<td>${chip(cellOf(input, t.id, r.model))}</td>`).join("");
      const meanCell =
        r.mean === null
          ? `<td class="mean na" title="errored on all ${r.errors} traps">—</td>`
          : `<td class="mean">${r.mean.toFixed(2)}${r.errors ? `<sup title="${r.errors} trap(s) errored">*</sup>` : ""}</td>`;
      return `<tr${rankClass}><td class="rank">${i + 1}</td><td class="model">${esc(r.model)}</td>${cells}${meanCell}</tr>`;
    })
    .join("");

  const vd = verifierDelta(input);

  const detail = traps
    .map((t) => {
      const trs = input.models
        .map((m) => {
          const g = cellOf(input, t.id, m);
          if (!g) return "";
          const why = g.source === "error" ? `error: ${g.error ?? "unknown"}` : g.score.reason;
          return `<tr><td class="model">${esc(m)}</td><td>${chip(g)}</td><td class="why">${esc(why)}</td><td class="src">${esc(g.source)}</td></tr>`;
        })
        .join("");
      const moat = t.origin === "civil-law" ? ` <span class="moat">civil-law</span>` : "";
      return `<details><summary>${esc(t.id)} <span class="cat">${esc(t.category)}</span>${moat}</summary>
      <p class="prompt">${esc(t.prompt)}</p>
      <table class="detail"><thead><tr><th>Model</th><th>Score</th><th>Why</th><th>Source</th></tr></thead><tbody>${trs}</tbody></table></details>`;
    })
    .join("\n");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Legal Honesty Probe — every model, ranked</title>
<style>
:root{--bg:#0b0d12;--card:#141821;--line:#222836;--fg:#e6e9ef;--mut:#8b93a7;--g:#3fb950;--y:#d29922;--r:#f85149;--ac:#7c6cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:30px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 32px}
.hero{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 36px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 24px;flex:1;min-width:200px}
.box .k{color:var(--mut);font-size:13px;text-transform:uppercase;letter-spacing:.5px}
.box .v{font-size:34px;font-weight:700;margin-top:6px}
.box.delta{border-color:var(--ac)}.box.delta .v{color:var(--ac)}
.tablewrap{overflow-x:auto;border-radius:12px;border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;background:var(--card);font-size:13px}
th,td{padding:8px 10px;text-align:center;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:11px;position:sticky;top:0;background:var(--card)}
td.model,th.model,td.rank,th.rank{text-align:left}
td.model{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}
td.rank{color:var(--mut);width:34px}
td.mean{font-weight:700}td.mean.na{color:var(--mut);font-weight:400}
tr.top1{background:rgba(63,185,80,.10)}tr.top2{background:rgba(63,185,80,.06)}tr.top3{background:rgba(63,185,80,.04)}
.s{display:inline-block;min-width:30px;padding:2px 6px;border-radius:6px;font-weight:700;font-size:12px}
.s1{background:rgba(63,185,80,.16);color:var(--g)}.sh{background:rgba(210,153,34,.16);color:var(--y)}.s0{background:rgba(248,81,73,.14);color:var(--r)}
.se{background:rgba(139,147,167,.12);color:var(--mut)}
h2{font-size:18px;margin:40px 0 14px}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:0 16px}
summary{cursor:pointer;padding:12px 0;font-family:ui-monospace,monospace}
.cat{color:var(--mut);font-size:12px;font-family:ui-sans-serif}
.moat{background:rgba(124,108,255,.16);color:var(--ac);border-radius:5px;padding:1px 7px;font-size:11px;font-family:ui-sans-serif}
.prompt{color:var(--mut);border-left:2px solid var(--line);padding-left:12px;margin:4px 0 14px}
table.detail{margin:0 0 16px}table.detail td.why{text-align:left;color:var(--mut)}table.detail td.src{color:var(--mut)}
.why-now{color:var(--fg);max-width:760px}.why-now em{color:var(--ac);font-style:italic}
ul.sources{list-style:none;padding:0;margin:8px 0 0}
ul.sources li{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:11px 14px;margin:7px 0;font-size:13px}
.foot{color:var(--mut);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:16px}
a{color:var(--ac)}
</style></head><body><div class="wrap">
<h1>Legal Honesty Probe</h1>
<p class="sub">${esc(date)} · ${traps.length} calibrated traps · ${ranked.length} models ranked (${withData.length} returned data, ${errored} errored) · deterministic rubric, no LLM judge</p>
${
  vd
    ? `<div class="hero">
<div class="box"><div class="k">Verifier OFF (raw)</div><div class="v">${vd.off.toFixed(2)}</div></div>
<div class="box"><div class="k">Verifier ON (guarded)</div><div class="v">${vd.on.toFixed(2)}</div></div>
<div class="box delta"><div class="k">Verifier delta</div><div class="v">${vd.delta >= 0 ? "+" : ""}${vd.delta.toFixed(2)}</div></div>
</div>`
    : ""
}
<h2>Leaderboard — honesty on legal traps, every model on OpenRouter</h2>
<div class="tablewrap"><table><thead><tr><th class="rank">#</th><th class="model">Model</th>${head}<th>Mean</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>Per-trap detail</h2>
${detail}
<h2>Why now</h2>
<p class="why-now">Three things landed in legal AI inside 48 hours. Together they make one procurement question unavoidable: <em>what does your stack return when the model is wrong on a legal hypothetical?</em></p>
<ul class="sources">
${SOURCES.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join("\n")}
</ul>
<p class="foot">Grading is deterministic: every score reproduces from (trap, captured text), no LLM judge. <strong>"live"</strong> rows are real API calls this run; <strong>"·"</strong> = the model errored/timed out on that trap and is excluded from its mean (<sup>*</sup> marks a partial run). The two verifier modes apply the deterministic cite-verifier over a recorded base, so the ON/OFF delta is reproducible. Model outputs are non-deterministic — live scores are a single run and vary run to run; the rubric does not. Civil-law trap set (KSA / Lebanon / UAE / Egypt) is the HAQQ moat and is not published. Harness is MIT: <a href="https://github.com/sboghossian/legal-honesty-probe" target="_blank" rel="noopener">github.com/sboghossian/legal-honesty-probe</a></p>
</div></body></html>`;
}
