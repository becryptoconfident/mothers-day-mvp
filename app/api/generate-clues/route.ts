import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/anthropic';
import {
  HUNT_CLUE_SYSTEM_PROMPT,
  generateCluePrompt,
  HINTS_SYSTEM_PROMPT,
  generateHintsPrompt,
} from '@/lib/prompts';

type ClueInput = { platform: string; memory: string; answer: string; answer_type?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clues: ClueInput[] = Array.isArray(body.clues) ? body.clues : [];
    if (!clues.length) {
      return NextResponse.json({ error: 'clues array required' }, { status: 400 });
    }

    const enriched = await Promise.all(
      clues.map(async (c) => {
        if (!c.platform || !c.answer) return { ...c, riddle: '', hints: [] };
        const riddleObj = await generateContent(
          HUNT_CLUE_SYSTEM_PROMPT,
          generateCluePrompt({
            platform: c.platform,
            memory: c.memory || '',
            answer: c.answer,
            answer_type: c.answer_type || 'item',
          }),
        );
        const hintsObj = await generateContent(
          HINTS_SYSTEM_PROMPT,
          generateHintsPrompt({
            platform: c.platform,
            answer: c.answer,
            memory: c.memory || '',
          }),
        );
        return {
          ...c,
          riddle: riddleObj.riddle || '',
          hints: [hintsObj.hint_1, hintsObj.hint_2, hintsObj.hint_3].filter(Boolean),
        };
      }),
    );

    return NextResponse.json({ clues: enriched });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
