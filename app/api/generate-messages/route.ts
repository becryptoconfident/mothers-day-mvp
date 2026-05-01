import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/anthropic';
import { MESSAGES_SYSTEM_PROMPT, generateMessagesPrompt } from '@/lib/prompts';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const required = ['question_1', 'question_2', 'question_3', 'question_4'];
    for (const key of required) {
      const value = body[key];
      if (typeof value !== 'string' || value.trim().length < 20) {
        return NextResponse.json(
          { error: `${key} must be a string of at least 20 characters` },
          { status: 400 },
        );
      }
    }

    const messages = await generateContent(
      MESSAGES_SYSTEM_PROMPT,
      generateMessagesPrompt({
        question_1: body.question_1,
        question_2: body.question_2,
        question_3: body.question_3,
        mom_nickname: typeof body.mom_nickname === 'string' ? body.mom_nickname : undefined,
        mom_name: typeof body.mom_name === 'string' ? body.mom_name : undefined,
        language: typeof body.language === 'string' ? body.language : undefined,
      }),
    );

    const expectedDays = ['day_1', 'day_2', 'day_3'];
    for (const day of expectedDays) {
      if (typeof messages[day] !== 'string' || messages[day].length === 0) {
        return NextResponse.json(
          { error: `Generated payload missing or empty: ${day}` },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({
      messages: { day_1: messages.day_1, day_2: messages.day_2, day_3: messages.day_3 },
    });
  } catch (error) {
    console.error('Generate messages error:', error);
    return NextResponse.json(
      { error: 'Failed to generate messages', detail: (error as Error).message },
      { status: 500 },
    );
  }
}
