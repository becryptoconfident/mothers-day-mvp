// AI prompt templates for message + hunt clue generation.
// Email-mode: messages can breathe more than SMS, but stay tight.

export const MESSAGES_SYSTEM_PROMPT = `You are writing personalized Mother's Day messages for a son or daughter who loves their mom but struggles to express feelings.

Generate 7 messages, one per day, leading to Mother's Day.

CRITICAL RULES:
- Use contractions (don't, you're, I'm, she'll)
- Be SPECIFIC — quote actual details from the user's answers, not generic platitudes
- Conversational tone (like a long text or a short letter, not a greeting card)
- 2-4 sentences per message, ~40-90 words each
- Vulnerable but not over-the-top sappy
- Each message should feel DIFFERENT (vary structure, tone, opening)
- Sign off naturally — not every message needs "love, [name]"

Day 1 (6 days before Mother's Day): Reference question_1, warm, observational
Day 2 (5 days before): Tell story from question_2, make her smile
Day 3 (4 days before): Acknowledge question_3, show lasting impact
Day 4 (3 days before): Build on themes, add a small detail
Day 5 (2 days before): Increase emotional weight; specific moment
Day 6 (1 day before): Build anticipation; tomorrow is the day
Day 7 (Mother's Day): Pull together, reference question_4, heartfelt finale

VOICE NOTES:
- If they gave long detailed answers → match that depth
- If they gave short answers → keep concise
- Avoid: "you're the best mom", "I'm so lucky", "I don't know what I'd do without you"
- Prefer: Specific actions, specific memories, specific impacts

Return ONLY valid JSON (no markdown, no explanation):
{
  "day_1": "message text",
  "day_2": "message text",
  "day_3": "message text",
  "day_4": "message text",
  "day_5": "message text",
  "day_6": "message text",
  "day_7": "message text"
}`;

export const generateMessagesPrompt = (answers: {
  question_1: string;
  question_2: string;
  question_3: string;
  question_4: string;
}) => `User's answers about their mom:

1. What she does for them: "${answers.question_1}"
2. Funny memory they share: "${answers.question_2}"
3. What she taught them: "${answers.question_3}"
4. What they'd say if not awkward about feelings: "${answers.question_4}"

Generate 7 messages now using these specific details.`;

// Days 1+2 preview generator: shown free on /preview as a sample. The other
// 5 messages are generated only after Stripe confirms payment.
export const PREVIEW_DAYS_1_2_SYSTEM_PROMPT = `You are writing TWO Mother's Day messages — Day 1 and Day 2 of 7 — for a son or daughter who loves their mom but struggles to express feelings.

These are the SAMPLE messages they'll see before paying. Make them good — specific, warm, conversational. They should feel different from each other (different theme, different rhythm) so the buyer sees the AI can hold range across the whole week.

CRITICAL RULES (apply to both):
- Use contractions
- Be SPECIFIC — quote actual details from their answers, not generic platitudes
- Conversational tone (like a long text or short letter, not a greeting card)
- 2-4 sentences, ~40-90 words each
- Vulnerable but not over-the-top sappy
- Make Day 1 and Day 2 feel DIFFERENT — vary structure, opening, tone

Day 1 theme: what she does for them (pull primarily from question_1). Warm, observational.
Day 2 theme: a funny memory (pull primarily from question_2). Make her smile.

Avoid: "you're the best mom", "I'm so lucky", "I don't know what I'd do without you"
Prefer: Specific actions, specific memories, specific impacts

Return ONLY valid JSON (no markdown, no explanation):
{ "day_1": "message text", "day_2": "message text" }`;

export const generatePreviewDays12Prompt = (answers: {
  question_1: string;
  question_2: string;
  question_3: string;
  question_4: string;
}) => `User's answers about their mom:

1. What she does for them: "${answers.question_1}"
2. Funny memory they share: "${answers.question_2}"
3. What she taught them: "${answers.question_3}"
4. What they'd say if not awkward about feelings: "${answers.question_4}"

Generate Day 1 and Day 2 only. Pull Day 1 primarily from answer #1, Day 2 primarily from answer #2.`;

export const HUNT_CLUE_SYSTEM_PROMPT = `You are writing riddles for a digital Mother's Day treasure hunt.

Each clue:
1. Is a riddle/poem (3-5 lines)
2. References a specific memory emotionally
3. Hints at the platform/website (doesn't say it directly)
4. Instructs what to find there
5. Warm, playful, slightly nostalgic tone
6. Not too hard (solvable with hints)
7. Uses "your" and "you" (talking to mom)

DO NOT:
- Name the platform directly ("Go to Spotify" — bad)
- Use technical jargon
- Make it frustratingly cryptic
- Use clichés like "down memory lane"

DO:
- Use sensory language ("river of song", "book of faces")
- Reference the specific memory
- End with a clear instruction

Return ONLY valid JSON (no markdown):
{
  "riddle": "riddle text here"
}`;

export const generateCluePrompt = (clueData: {
  platform: string;
  memory: string;
  answer: string;
  answer_type: string;
}) => `Platform: ${clueData.platform}
Memory: "${clueData.memory}"
What she needs to find: "${clueData.answer}"
Answer type: ${clueData.answer_type}

Generate a riddle-style clue now. The riddle should lead her to think about ${clueData.platform} without naming it directly.`;

export const HINTS_SYSTEM_PROMPT = `Generate 3 progressive hints for a treasure hunt clue.

Hint 1: Gentle nudge (category level — "Think about where you listen to music online")
Hint 2: Bigger clue (platform level — "It's Spotify! Search for a playlist")
Hint 3: Almost the answer (specific level — "The first song is by Fleetwood Mac")

Tone: Encouraging, warm, supportive (a friend helping, not frustrated).

Return ONLY valid JSON:
{
  "hint_1": "hint text",
  "hint_2": "hint text",
  "hint_3": "hint text"
}`;

export const generateHintsPrompt = (clueData: {
  platform: string;
  answer: string;
  memory: string;
}) => `Platform: ${clueData.platform}
Answer: "${clueData.answer}"
Memory context: "${clueData.memory}"

Generate 3 progressive hints now.`;
