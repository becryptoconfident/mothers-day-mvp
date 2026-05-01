import { generateText } from './anthropic';

const LETTER_SYSTEM_PROMPT = `You are writing a short letter from a son or daughter to their mom — it lives below a personal Mother's Day webpage.

Structure (3 paragraphs, in this order):
- Open with the specific memory (Q1) — anchor in the actual moment.
- Mention the thing only she does (Q2) and the unsaid line (Q3).
- End looking forward to what they want with her (Q4).

Stay close to what they actually said.
- Don't infer emotions they didn't express.
- Don't add dramatic language or poetic flourishes.
- If they said "she makes soup when I'm sick" — write about the soup. Don't turn it into a meditation on unconditional love.
- Short sentences. Simple words. Sound like a person writing a letter, not a poet writing a tribute.
- The letter should feel like something they WOULD have written if they had the words. Not something a stranger wrote about their mom.
- 3 paragraphs max. Keep it tight.

Voice rules:
- First person — written as the SENDER, addressed to the RECIPIENT.
- Use contractions. Conversational, not formal.
- Reference the SPECIFIC details provided. Quote actual moments.
- Open with something other than "Dear Mom" or "Hey Mom" — the page already says who it's for. Open with the memory itself or a small observation.
- End on a single quiet line.

Avoid: "you're the best mom", "I'm so lucky", "I don't know what I'd do without you", anything that could appear on a greeting card. Avoid sweeping statements about love or family.

Prefer: Specific actions. Specific moments. Specific impacts. Things only this person could say to this mother.

Output ONLY the letter prose. No subject line. No "Dear Mom". No closing signature line — sign-off is shown separately. No quotes around the output.`;

export async function generateForeverLetter(args: {
  cleanedAnswers: { question_1: string; question_2: string; question_3: string; question_4: string };
  userName?: string;
  momNickname?: string; // what the user calls her ("Mama", "Ma", etc.)
  momName?: string; // mom's first name
  language?: string;
}): Promise<string> {
  const { cleanedAnswers, userName, momNickname, momName, language } = args;
  const lang = language && language.trim() && language.toLowerCase() !== 'english' ? language.trim() : null;
  const nick = momNickname?.trim();
  const first = momName?.trim();
  const namesLine =
    nick || first
      ? `\nThe writer calls their mom${nick ? ` "${nick}"` : ' Mom'}.${first ? ` Her first name is ${first}.` : ''} Use${nick ? ` "${nick}"` : ' "Mom"'} when addressing her in the letter — it's what they actually say.\n`
      : '';
  const userPrompt = `From: ${userName || 'a son or daughter'}
To: ${first || nick || 'her mom'}
${namesLine}
Memories and details:

Q1 — A specific moment with mom they'll never forget: ${cleanedAnswers.question_1}

Q2 — Something mom does that nobody else does: ${cleanedAnswers.question_2}

Q3 — Something they've never told mom but she should know: ${cleanedAnswers.question_3}

Q4 — Something they're looking forward to doing with mom: ${cleanedAnswers.question_4}

${lang ? `Write the letter in ${lang}. Write naturally — not like a translation. Write like a native speaker expressing love to their mother.\n\n` : ''}Write the letter now. 3–4 paragraphs. Specific to these details. Open on the memory. End looking forward to ${lang ? `the future together, in ${lang}` : 'the future together'}. The kind of letter that makes her cry the first time and re-read it on hard days.`;

  return generateText({
    systemPrompt: LETTER_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1200,
  });
}
