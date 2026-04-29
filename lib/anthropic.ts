import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

// Some parent processes (e.g., agent harnesses) explicitly set ANTHROPIC_API_KEY
// to an empty string in child processes' env. Next.js's dotenv won't override
// that empty value, so process.env.ANTHROPIC_API_KEY ends up as "". When that
// happens, fall back to reading .env.local directly.
let _envCache: Record<string, string> | null = null;
function envVar(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess && fromProcess.length > 0) return fromProcess;
  if (!_envCache) {
    _envCache = {};
    try {
      const text = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        _envCache[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    } catch {}
  }
  return _envCache[name];
}

// Lazy-init so the API key is read at first-call time, not module-load time.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = envVar('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the environment');
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

const MODEL = 'claude-sonnet-4-6';

export async function generateContent(systemPrompt: string, userPrompt: string) {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    // Cache the system prompt — saves cost across batch calls.
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Strip markdown fences if Claude adds them despite instructions.
  let text = textBlock.text.trim();
  text = text.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse failed: ${(e as Error).message}\nRaw: ${text.slice(0, 200)}`);
  }
}

// Plain-text variant: returns the raw text Claude generates without JSON parsing.
// Used for text cleaning, letter generation — anywhere we want prose, not structure.
export async function generateText(args: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 1500,
    system: [{ type: 'text', text: args.systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: args.userPrompt }],
  });
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text response');
  return block.text.trim();
}
