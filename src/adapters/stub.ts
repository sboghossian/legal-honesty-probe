import type { Adapter, ModelResponse, Trap } from "../types.js";

/**
 * Placeholder adapters for GPT and Gemini.
 *
 * Model IDs are intentionally NOT hardcoded: `gpt-5.5` and `gemini-3.1-pro`
 * from the brief are unconfirmed and would 404 at runtime. Wire the real id
 * + SDK call here once known, then drop the stub. Until then this returns a
 * "stub" response so the harness runs and the report shows the gap honestly,
 * rather than fabricating a comparison.
 *
 * TODO(model-id): set the confirmed API string and implement answer().
 */
export function stubAdapter(displayName: string): Adapter {
  return {
    name: displayName,
    async answer(trap: Trap): Promise<ModelResponse> {
      return {
        model: displayName,
        trapId: trap.id,
        text: "",
        refused: false,
        source: "stub",
      };
    },
  };
}
