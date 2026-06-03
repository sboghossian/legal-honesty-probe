import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, type Trap, type TrapCategory } from "./types.js";

const TRAP_DIRS: { dir: string; origin: Trap["origin"] }[] = [
  { dir: "traps", origin: "public" },
  { dir: "traps-civil", origin: "civil-law" }, // gitignored moat; loaded if present locally
];

function isCategory(v: unknown): v is TrapCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

function parseTrap(raw: unknown, file: string, origin: Trap["origin"]): Trap {
  if (typeof raw !== "object" || raw === null) throw new Error(`${file}: not an object`);
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") throw new Error(`${file}: missing id`);
  if (!isCategory(o.category)) throw new Error(`${file}: invalid category "${String(o.category)}"`);
  if (typeof o.title !== "string") throw new Error(`${file}: missing title`);
  if (typeof o.prompt !== "string") throw new Error(`${file}: missing prompt`);
  const r = o.rubric as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") throw new Error(`${file}: missing rubric`);
  const notes = r.notes as Record<string, unknown> | undefined;
  if (!notes) throw new Error(`${file}: missing rubric.notes`);
  return {
    id: o.id,
    category: o.category,
    origin,
    title: o.title,
    prompt: o.prompt,
    rubric: {
      must_refuse: Boolean(r.must_refuse),
      forbidden_patterns: Array.isArray(r.forbidden_patterns) ? (r.forbidden_patterns as string[]) : [],
      expected_markers: Array.isArray(r.expected_markers) ? (r.expected_markers as string[]) : [],
      notes: {
        full: String(notes.full ?? "correct shape"),
        partial: String(notes.partial ?? "partial"),
        fail: String(notes.fail ?? "wrong shape"),
      },
    },
  };
}

export function loadTraps(root: string): Trap[] {
  const traps: Trap[] = [];
  for (const { dir, origin } of TRAP_DIRS) {
    const full = join(root, dir);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full)) {
      if (!f.endsWith(".json")) continue;
      const raw = JSON.parse(readFileSync(join(full, f), "utf8")) as unknown;
      traps.push(parseTrap(raw, join(dir, f), origin));
    }
  }
  return traps.sort((a, b) => a.id.localeCompare(b.id));
}
