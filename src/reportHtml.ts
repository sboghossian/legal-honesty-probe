import type { ReportInput } from "./report.js";

// Self-contained dark scorecard for legal-honesty-probe.dashable.dev.
// No deps, inline CSS. Same data as the Markdown report.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chip(v: number): string {
  if (v === 1) return `<span class="s s1">1.0</span>`;
  if (v === 0.5) return `<span class="s sh">0.5</span>`;
  return `<span class="s s0">0.0</span>`;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
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
  const { date, models, traps, results } = input;
  const val = (t: string, m: string): number => results.get(t)?.get(m)?.score.value ?? 0;

  const head = traps.map((t) => `<th title="${esc(t.category)}">${esc(t.id)}</th>`).join("");
  const rows = models
    .map((m) => {
      const cells = traps.map((t) => `<td>${chip(val(t.id, m))}</td>`).join("");
      const mean = avg(traps.map((t) => val(t.id, m)));
      const hl = m.startsWith("haqq") ? ' class="haqq"' : "";
      return `<tr${hl}><td class="model">${esc(m)}</td>${cells}<td class="mean">${mean.toFixed(2)}</td></tr>`;
    })
    .join("");

  const on = "haqq-verifier-on";
  const off = "haqq-verifier-off";
  const onMean = avg(traps.map((t) => val(t.id, on)));
  const offMean = avg(traps.map((t) => val(t.id, off)));
  const delta = onMean - offMean;
  const hasDelta = models.includes(on) && models.includes(off);

  const detail = traps
    .map((t) => {
      const trs = models
        .map((m) => {
          const g = results.get(t.id)?.get(m);
          if (!g) return "";
          return `<tr><td class="model">${esc(m)}</td><td>${chip(g.score.value)}</td><td class="why">${esc(g.score.reason)}</td><td class="src">${esc(g.source)}</td></tr>`;
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
<title>Legal Honesty Probe</title>
<style>
:root{--bg:#0b0d12;--card:#141821;--line:#222836;--fg:#e6e9ef;--mut:#8b93a7;--g:#3fb950;--y:#d29922;--r:#f85149;--ac:#7c6cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:30px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 32px}
.hero{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 36px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 24px;flex:1;min-width:200px}
.box .k{color:var(--mut);font-size:13px;text-transform:uppercase;letter-spacing:.5px}
.box .v{font-size:34px;font-weight:700;margin-top:6px}
.box.delta{border-color:var(--ac)}.box.delta .v{color:var(--ac)}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13px}
th,td{padding:9px 10px;text-align:center;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:11px}
td.model,th:first-child{text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}
td.mean{font-weight:700}tr.haqq{background:rgba(124,108,255,.06)}
.s{display:inline-block;min-width:34px;padding:2px 6px;border-radius:6px;font-weight:700;font-size:12px}
.s1{background:rgba(63,185,80,.16);color:var(--g)}.sh{background:rgba(210,153,34,.16);color:var(--y)}.s0{background:rgba(248,81,73,.14);color:var(--r)}
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
<p class="sub">${esc(date)} · ${traps.length} calibrated traps · ${models.length} models · deterministic rubric, no LLM judge</p>
${
  hasDelta
    ? `<div class="hero">
<div class="box"><div class="k">Verifier OFF (raw)</div><div class="v">${offMean.toFixed(2)}</div></div>
<div class="box"><div class="k">Verifier ON (guarded)</div><div class="v">${onMean.toFixed(2)}</div></div>
<div class="box delta"><div class="k">Delta</div><div class="v">${delta >= 0 ? "+" : ""}${delta.toFixed(2)}</div></div>
</div>`
    : ""
}
<h2>Scoreboard</h2>
<table><thead><tr><th>Model</th>${head}<th>Mean</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Per-trap detail</h2>
${detail}
<h2>Why now</h2>
<p class="why-now">Three things landed in legal AI inside 48 hours. Together they make one procurement question unavoidable: <em>what does your stack return when the model is wrong on a legal hypothetical?</em></p>
<ul class="sources">
${SOURCES.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join("\n")}
</ul>
<p class="foot">Every score is reproducible from (trap, captured text). "fixture" = recorded response (no live key this run); "stub"/"no response" = adapter not wired. The shipped fixtures are illustrative sample responses, not measurements of any vendor — run live with your own keys for a real receipt. Civil-law trap set (KSA / Lebanon / UAE / Egypt) is the HAQQ moat and is not published. Harness is MIT: <a href="https://github.com/sboghossian/legal-honesty-probe" target="_blank" rel="noopener">github.com/sboghossian/legal-honesty-probe</a></p>
</div></body></html>`;
}
