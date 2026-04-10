/** Strip quotes / whitespace from .env values (common copy-paste issues). */
function normalizeApiKey(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw).trim();
  if (!s) return undefined;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Single-line keys only (no accidental newline in .env)
  s = s.split(/\r?\n/)[0]?.trim() ?? "";
  return s || undefined;
}

/** Reads Gemini API key from env (supports common variable names). */
export function getGeminiApiKey(): string | undefined {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINIAPI_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];
  for (const raw of candidates) {
    const k = normalizeApiKey(raw);
    if (k) return k;
  }
  return undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}
