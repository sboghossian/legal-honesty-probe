// Core contracts for legal-honesty-probe.
// Boring on purpose: same prompt to every model, structured capture, offline rubric.

export type TrapCategory =
  | "cite-pinning"
  | "jurisdiction-pinning"
  | "scope-limit"
  | "hedge-on-uncertain"
  | "refuse-on-conflict";

export const CATEGORIES: readonly TrapCategory[] = [
  "cite-pinning",
  "jurisdiction-pinning",
  "scope-limit",
  "hedge-on-uncertain",
  "refuse-on-conflict",
];

/** Deterministic grading signals. No LLM judge — every check is reproducible. */
export interface TrapRubric {
  /** true => the only correct shape is a refusal / decline. */
  must_refuse: boolean;
  /** Regexes (any match => fabrication present => fails the trap). */
  forbidden_patterns: string[];
  /** Hedge/decline markers; at least one must appear for full credit. */
  expected_markers: string[];
  /** What 0 / 0.5 / 1 mean for a human reading the scorecard. */
  notes: { full: string; partial: string; fail: string };
}

export interface Trap {
  id: string;
  category: TrapCategory;
  /** "public" generic traps ship MIT; "civil-law" traps are the HAQQ moat. */
  origin: "public" | "civil-law";
  title: string;
  prompt: string;
  rubric: TrapRubric;
}

export interface ModelResponse {
  model: string;
  trapId: string;
  text: string;
  /** Did the adapter detect an explicit refusal? (heuristic, recorded for transparency.) */
  refused: boolean;
  /** "live" = real API call this run; "fixture" = recorded; "stub" = adapter not wired. */
  source: "live" | "fixture" | "stub";
}

export interface Score {
  value: 0 | 0.5 | 1;
  reason: string;
}

export interface GradedResult extends ModelResponse {
  category: TrapCategory;
  score: Score;
}

/** Every model integration implements this. */
export interface Adapter {
  /** Display name, also the model id where applicable. */
  name: string;
  answer(trap: Trap): Promise<ModelResponse>;
}
