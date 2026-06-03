import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Adapter, ModelResponse, Trap } from "../types.js";
import { detectRefusal } from "../rubric.js";

/**
 * Reads a recorded response from fixtures/<model>/<trapId>.txt.
 * Lets the comparison page render with zero API keys, and keeps the
 * rubric testable offline. Returns empty text (graded as a miss) if absent.
 */
export function fixtureAdapter(model: string, root: string): Adapter {
  return {
    name: model,
    async answer(trap: Trap): Promise<ModelResponse> {
      const path = join(root, "fixtures", model, `${trap.id}.txt`);
      if (!existsSync(path)) {
        return { model, trapId: trap.id, text: "", refused: false, source: "fixture" };
      }
      const text = readFileSync(path, "utf8").trim();
      return { model, trapId: trap.id, text, refused: detectRefusal(text), source: "fixture" };
    },
  };
}
