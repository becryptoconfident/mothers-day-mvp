import { generateText } from './anthropic';

const LETTER_SYSTEM_PROMPT = `You are writing a heartfelt 3–4 paragraph letter from a son or daughter to their mom — a long-form love letter that lives at the bottom of a personal Mother's Day webpage.

Voice rules:
- First person — written as the SENDER, addressed to the RECIPIENT.
- Use contractions. Conversational warmth, not a greeting card.
- Reference the SPECIFIC memories provided. Quote actual details, not generic platitudes.
- Vulnerable but not over-the-top sappy. Earned emotion, not performed.
- 3–4 paragraphs total, each 3–5 sentences.
- Open with something other than "Dear Mom" or "Hey Mom" — the page already says who it's for. Open with a memory, an observation, or a thought.
- End on a single quiet line. Like signing off in a real letter.

Avoid: "you're the best mom", "I'm so lucky", "I don't know what I'd do without you", anything that could appear on a greeting card.

Prefer: Specific actions. Specific moments. Specific impacts. Things only this person could say to this mother.

Output ONLY the letter prose. No subject line. No "Dear Mom". No closing signature line — sign-off is implied by the page footer. No quotes around the output.`;

export async function generateForeverLetter(args: {
  cleanedAnswers: { question_1: string; question_2: string; question_3: string; question_4: string };
  longNote?: string;
  userName?: string;
  momName?: string;
}): Promise<string> {
  const { cleanedAnswers, longNote, userName, momName } = args;
  const userPrompt = `From: ${userName || 'a son or daughter'}
To: ${momName || 'her mom'}

Memories and details:

1. What she does for them: ${cleanedAnswers.question_1}

2. A funny memory they share: ${cleanedAnswers.question_2}

3. Something she taught them that they still use: ${cleanedAnswers.question_3}

4. What they'd say if not awkward about feelings: ${cleanedAnswers.question_4}
${longNote ? `\nA longer note they wrote in their own words (weave its themes in naturally — don't quote it directly):\n"${longNote}"` : ''}

Write the letter now. 3–4 paragraphs. Specific to these details. The kind of letter that makes her cry the first time and re-read it on hard days.`;

  return generateText({
    systemPrompt: LETTER_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1200,
  });
}
