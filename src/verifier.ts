import { detectRefusal } from "./rubric.js";

// The HAQQ cite-verifier, modeled as a DETERMINISTIC guard layer over a base model.
// This is a transparent stand-in for the production verifier: same idea, fully
// auditable. Two guards, each independent of any trap's own rubric so the
// measured ON/OFF delta stays honest.

// Citation-shaped tokens stated as fact: "Article 12", "§ 7", "Smith v. Jones",
// "2019 SCC 14". The verifier cannot confirm these, so ON withholds them.
const CITATION_TOKENS =
  /\b(?:Article|Art\.|Section|Sec\.|§|Clause)\s*\d+[A-Za-z\-.\d]*|\b\d{4}\s+[A-Z]{2,}\s+\d+\b|\b[A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+\b/g;

const HEDGE_MARKERS = ["cannot confirm", "i cannot verify", "must be verified", "general information"];

function hasHedge(text: string): boolean {
  const t = text.toLowerCase();
  return HEDGE_MARKERS.some((m) => t.includes(m));
}

const SCOPE_LOCK =
  "\n\nVerifier note: I cannot confirm this falls within a verified jurisdiction or scope, " +
  "and I cannot verify any specific authority cited above against its primary source. " +
  "Treat the above as general information, not legal advice — consult a licensed practitioner " +
  "in the relevant jurisdiction before relying on it.";

export interface VerifierOutput {
  text: string;
  refused: boolean;
  changed: boolean;
}

/** Guard 1: withhold unverifiable citations. Guard 2: mandate a hedge / scope-lock. */
export function applyVerifier(raw: string): VerifierOutput {
  let text = raw.replace(CITATION_TOKENS, "[unverified citation withheld pending source check]");
  const neutralizedCite = text !== raw;

  let mandatedHedge = false;
  if (!detectRefusal(text) && !hasHedge(text)) {
    text += SCOPE_LOCK;
    mandatedHedge = true;
  }

  return { text, refused: detectRefusal(text), changed: neutralizedCite || mandatedHedge };
}
