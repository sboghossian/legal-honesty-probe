// Fetch the live OpenRouter catalogue and keep only text→text chat models
// (drops image/audio/embedding endpoints). Used by ALL_MODELS mode.

export interface ORModel {
  id: string;
  name?: string;
}

interface RawModel {
  id: string;
  name?: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

function isTextChat(m: RawModel): boolean {
  const a = m.architecture ?? {};
  const im = a.input_modalities ?? [];
  const om = a.output_modalities ?? [];
  // Text in, text out, and NOT an image generator.
  return im.includes("text") && om.includes("text") && !om.includes("image");
}

/** Current account credit balance (credits granted minus usage). */
export async function fetchBalance(key: string): Promise<number | null> {
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${key}` } });
    if (!resp.ok) return null;
    const d = (await resp.json()) as { data?: { total_credits?: number; total_usage?: number } };
    if (!d.data) return null;
    return (d.data.total_credits ?? 0) - (d.data.total_usage ?? 0);
  } catch {
    return null;
  }
}

export async function fetchChatModels(key: string): Promise<ORModel[]> {
  const resp = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) throw new Error(`OpenRouter /models: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { data: RawModel[] };
  return data.data
    .filter(isTextChat)
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
