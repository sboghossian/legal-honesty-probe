import type { Adapter, ModelResponse, Trap } from "../types.js";
import { applyVerifier } from "../verifier.js";
import { fixtureAdapter } from "./fixture.js";

// HAQQ-routed flow in two modes over the SAME base model output:
//   OFF -> raw passthrough (what the model says unguarded)
//   ON  -> base output through the deterministic cite-verifier (verifier.ts)
// The delta between the two rows is the procurement slide.
//
// Base output comes from fixtures/haqq-base/<trapId>.txt (offline) or, when a
// live base adapter is supplied, from that adapter's response.

export function haqqAdapter(
  mode: "on" | "off",
  root: string,
  base?: Adapter,
): Adapter {
  const name = mode === "on" ? "haqq-verifier-on" : "haqq-verifier-off";
  const baseAdapter = base ?? fixtureAdapter("haqq-base", root);

  return {
    name,
    async answer(trap: Trap): Promise<ModelResponse> {
      const baseRes = await baseAdapter.answer(trap);
      if (mode === "off") {
        return { ...baseRes, model: name };
      }
      const v = applyVerifier(baseRes.text);
      return {
        model: name,
        trapId: trap.id,
        text: v.text,
        refused: v.refused,
        source: baseRes.source,
      };
    },
  };
}
