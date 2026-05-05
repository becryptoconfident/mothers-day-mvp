// AI prompt templates for message + hunt clue generation.
// Email-mode: messages can breathe more than SMS, but stay tight.

export const MESSAGES_SYSTEM_PROMPT = `You are writing 3 Mother's Day messages from a son or daughter who loves their mom but struggles to express feelings.

The person answered four questions about their mom. Three of those answers feed the three daily messages. The fourth (the future) is reserved for a separate forever-page letter — DO NOT use Question 4 in these messages.

Message arc:
- Message 1 (Friday, May 8th — two days before Mother's Day):
    Based on Question 1 (the memory). Warm opener.
    Open with something like "Hey Mom, I've been thinking about..."
    Specific. Observational. Sets the tone.
- Message 2 (Saturday, May 9th — day before Mother's Day):
    Based on Question 2 (the thing she does that nobody else does).
    Shows the writer pays attention to who she is as a person, not just "mom."
    Building emotional momentum.
- Message 3 (Sunday, May 10th — Mother's Day morning, the finale):
    Based on Question 3 (the unsaid thing).
    The most emotional one. The one that makes her cry.
    End with: "Happy Mother's Day. I love you."

CRITICAL RULES:
- Use contractions (don't, you're, I'm, she'll)
- Be SPECIFIC — quote actual details from the answers, not generic platitudes
- Conversational tone — like a long text or short letter, not a greeting card
- 40-80 words each
- Vulnerable but not over-the-top sappy
- Each message feels DIFFERENT — vary structure, opening, rhythm
- Use the mom's name if provided; otherwise "Mom"
- Match the depth of the writer's answers — long answers → match depth; short answers → stay concise

Avoid: "you're the best mom," "I'm so lucky," "I don't know what I'd do without you," "you mean the world to me"
Prefer: specific actions, specific memories, specific impacts

Return ONLY valid JSON (no markdown, no explanation):
{
  "day_1": "message text",
  "day_2": "message text",
  "day_3": "message text"
}`;

export const generateMessagesPrompt = (answers: {
  question_1: string;
  question_2: string;
  question_3: string;
  mom_nickname?: string;
  mom_name?: string;
  language?: string;
}) => {
  const lang =
    answers.language && answers.language.trim() && answers.language.toLowerCase() !== 'english'
      ? answers.language.trim()
      : null;
  const langLine = lang
    ? `\nWrite all 3 messages in ${lang}. Write naturally in that language — not translated-sounding. Write like a native speaker would text their mom.\n`
    : '';
  const nick = answers.mom_nickname?.trim();
  const first = answers.mom_name?.trim();
  const namesLine =
    nick || first
      ? `\nThe user calls their mom${nick ? ` "${nick}"` : ' Mom'}.${first ? ` Mom's first name is ${first}.` : ''} Use${nick ? ` "${nick}"` : ' "Mom"'} when addressing her in the messages — it's what they actually say.\n`
      : '';
  return `Writer's answers about their mom:

Q1 — A specific moment with mom they'll never forget: "${answers.question_1}"
Q2 — Something mom does that nobody else does: "${answers.question_2}"
Q3 — Something they've never told mom but she should know: "${answers.question_3}"
${namesLine}${langLine}
Write Message 1 (Friday) primarily from Q1, Message 2 (Saturday) primarily from Q2, Message 3 (Sunday/Mother's Day) primarily from Q3. Generate all three now.`;
};

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
