import { generateText } from './anthropic';

const CLEAN_SYSTEM_PROMPT = `You clean up user-typed text for display on a beautiful webpage.

Rules:
- Fix typos, capitalization, punctuation
- Expand abbreviations (im → I'm, u → you, dont → don't, ur → your, idk → I don't know, prob → probably, abt → about)
- Complete fragments into full sentences where the meaning is unambiguous
- Keep the voice authentic and personal — do NOT make it formal or corporate
- Preserve exact meaning and tone
- Keep contractions; don't expand them ("don't" stays "don't")
- Don't add new content the writer didn't say

Output ONLY the cleaned text. No quotes around it. No explanation. No preamble.`;

/** Clean a single piece of user-typed text. Cheap call, ~1-2 seconds. */
export async function cleanUserText(rawText: string): Promise<string> {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';
  // Don't burn an API call on already-clean short text (>=20 chars + has period + has uppercase).
  if (trimmed.length < 240 && /[.!?]$/.test(trimmed) && /^[A-Z]/.test(trimmed)) {
    return trimmed;
  }
  try {
    const cleaned = await generateText({
      systemPrompt: CLEAN_SYSTEM_PROMPT,
      userPrompt: trimmed,
      maxTokens: 600,
    });
    // Strip leading/trailing quotes that Claude sometimes adds
    return cleaned.replace(/^["'`]+|["'`]+$/g, '').trim() || trimmed;
  } catch (err) {
    console.warn('cleanUserText failed, falling back to raw:', err);
    return trimmed;
  }
}

/** Clean a batch of texts in parallel. */
export async function cleanUserTextBatch(rawTexts: string[]): Promise<string[]> {
  return Promise.all(rawTexts.map((t) => cleanUserText(t)));
}
